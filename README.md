# Aangan Homes

A full-stack property-listings app for Indian cities. You can search homes to buy or rent, view them on a locality map, compare up to three side by side, request site visits, and post your own listing. Every open browser sees new listings the moment they're posted.

| | |
|---|---|
| **Front end** | React 19, Vite 7, plain CSS (custom properties, dark mode, responsive down to 360 px) |
| **Back end** | Node.js 24, Express 5, REST + Server-Sent Events |
| **Database** | SQLite through Node's built-in `node:sqlite` (no native build step) |
| **Validation** | Zod schemas on every request |
| **Security** | Helmet (CSP and other headers), rate-limited writes, parameterised SQL, JSON body size limit |
| **Testing** | `node:test` API tests, Vitest + Testing Library on the front end |
| **CI** | GitHub Actions on Node 22 and 24: audit, tests, production build |

## Features

- **Search and filter** by buy/rent, city, locality text, BHK, property type, budget and possession, with five sort orders. Filtering and sorting run on the server.
- **Comparable-sales price estimate** for every listing, a simplified automated valuation model (see [How the estimate works](#how-the-estimate-works)). Shown as "12% below estimate" with a confidence level and the similar homes behind it.
- **Post in any locality**: type an area that isn't listed and it's created on the spot, placed on the map, and priced from nearby listings until it has data of its own.
- **Map view**: localities placed by real latitude and longitude, circles sized by ₹/sq ft, price pins linked to the cards on hover.
- **Compare up to 3 homes**: price, ₹/sq ft, EMI, cash upfront or move-in cost, area, amenities and more. The best value in each row is highlighted, and "Show differences only" hides rows that are the same.
- **EMI calculator** with sliders for down payment, interest rate and loan length.
- **Post a property**: validated on both client and server, with a locality price guide while you type.
- **Site-visit enquiries**: stored in the database and readable only through their unguessable IDs, which your browser keeps.
- **Live updates** over Server-Sent Events: new listings slide in for everyone, enquiry counts tick up in real time, and the header shows how many people are online.

## Architecture

```
Browser (React)                          Node (Express)                    SQLite
───────────────                          ──────────────                    ──────
App.jsx  ── fetch /api/listings?… ──►    routes → zod validation → repo ─► listings, localities,
         ── POST  /api/listings  ──►          │                            cities, enquiries
         ◄── EventSource /api/events ──  live hub (SSE) ◄── broadcast on writes
```

- `server/src/app.js`: routes, middleware, error handling. It's exported as a factory so tests can run it against an in-memory database.
- `server/src/repo.js`: every SQL query, all parameterised.
- `server/src/valuation.js`: the comparable-sales model, pure functions with their own unit tests.
- `server/src/db.js`: schema and versioned migrations (`PRAGMA user_version`), so existing databases upgrade in place.
- `server/src/live.js`: the Server-Sent Events hub (presence, heartbeats, broadcasts).
- `client/src/App.jsx`: app state, data loading and live-event handling.
- `client/src/lib/`: pure logic (formatting, EMI, compare table) with unit tests next to it.

## How the estimate works

Each listing is valued from **similar homes in the same city**, in the spirit of a Zestimate:

1. **Find comparables:** listings with the same deal (buy or rent) and a comparable property type (flats with flats, villas with independent houses, plots with plots).
2. **Weight each one by similarity:** distance (using map coordinates), size (on a log scale, so 1,000 vs 1,400 sq ft counts the same as 2,000 vs 2,800), BHK difference, and how long ago it was listed. Weak matches are dropped, and the best 8 are kept.
3. **Blend with a prior:** the locality's indicative ₹/sq ft rate, or the city median for a brand-new locality. It counts like 1.5 perfect comparables, so one odd listing can't swing the estimate.
4. **Report how it was reached:** which source mostly drove the number, a confidence level, and the comparables themselves (`GET /api/listings/:id/comparables`), which the detail view lists.

The model's settings live in `PARAMS` in `server/src/valuation.js`.

## Getting started

Requires **Node.js 22.13 or newer** (24 recommended).

```bash
npm install
npm run dev
```

- Web app: http://localhost:5173. Vite proxies `/api` to the API, so no CORS setup is needed.
- API: http://localhost:4000/api/health

The SQLite database is created and seeded on first run at `server/data/aangan.db`. To reset it:

```bash
npm run seed -w server
```

Open the app in two browser windows and post a listing in one to watch it appear in the other.

### Production

```bash
npm run build      # builds client/dist
npm start          # Express serves the API and the built app on one port
```

Set `PORT` and `DB_FILE` (see `.env.example`). Any Node host with a persistent disk works, such as Render, Railway, Fly.io or a VPS. SQLite needs that disk to keep data between deploys.

## Testing

```bash
npm test           # API tests, then front-end tests
```

- **API (32 tests):** filtering, sorting, LIKE-escaping, validation messages, phone normalisation, creating and matching localities, comparables, enquiry privacy, malformed JSON, the SSE stream and its heartbeat, the valuation model, and migrating an existing database.
- **Front end (33 tests):** currency formatting, EMI maths, value tags, compare-table "best" logic, the API client (including a request-cancellation race), the live-connection watchdog, and the compare tray component.

## REST API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness check plus number of connected clients |
| GET | `/api/cities` | Cities with localities and indicative rates |
| GET | `/api/listings` | Query: `deal`, `city`, `q`, `bhk` (e.g. `2,3,4+`), `type`, `maxPrice`, `status` (`ready`/`uc`), `sort` (`new`/`lo`/`hi`/`psf`/`deal`), `ids` |
| GET | `/api/listings/:id` | One listing, including `estimate`, `diffPct` and `estimateBasis` |
| GET | `/api/listings/:id/comparables` | The similar homes behind the estimate, with distance and weight |
| POST | `/api/listings` | Create a listing (a new `locality` is created if needed) → `201`, broadcasts `listing:created` |
| POST | `/api/listings/:id/enquiries` | Request a site visit → `201`, broadcasts `listing:activity` (count only) |
| GET | `/api/enquiries?ids=` | Your enquiries, by their UUIDs |
| GET | `/api/events` | Server-Sent Events: `presence`, `ping` (every 25 s), `listing:created`, `listing:activity` |

The client treats 60 seconds without any event as a dead connection. It then reconnects and refetches, because a proxy can drop the server side of a stream without telling the browser.

Validation errors return `400` with per-field messages:

```json
{ "error": "Validation failed", "fields": { "phone": "Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9." } }
```

## Security notes

- All SQL is parameterised, and user text in `LIKE` searches is escaped.
- React escapes everything it renders. A test confirms that HTML in a listing title is stored as plain text.
- Helmet sets a strict Content-Security-Policy (only Google Fonts is allowed as an outside source) and the usual hardening headers.
- Writes are rate-limited per IP (30 per 10 minutes), and JSON bodies are capped at 20 KB.
- Enquiries hold names and phone numbers, so they are never broadcast. Only their counts are.
- **Not yet done:** user accounts. Saved homes and "your listings" are kept per browser in `localStorage`.

## Roadmap

- Accounts and sessions so agents can edit or delete their listings
- Image uploads to object storage
- Playwright end-to-end tests in CI
- Postgres for multi-instance deploys, with a shared broadcast channel (e.g. Redis pub/sub) for live events

`docs/prototype.html` is the original single-file version this project grew from.
