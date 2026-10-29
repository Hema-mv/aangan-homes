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
- **Locality price estimate** for every listing (locality rate × area, adjusted for type), shown as "12% below estimate".
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
- `server/src/live.js`: the Server-Sent Events hub (presence, heartbeats, broadcasts).
- `client/src/App.jsx`: app state, data loading and live-event handling.
- `client/src/lib/`: pure logic (formatting, EMI, compare table) with unit tests next to it.

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

- **API (18 tests):** filtering, sorting, LIKE-escaping, validation errors, phone normalisation, the locality/city foreign key, enquiry privacy, malformed JSON, and the SSE stream itself.
- **Front end (26 tests):** currency formatting, EMI maths, value tags, compare-table "best" logic, and the compare tray component.

## REST API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness check plus number of connected clients |
| GET | `/api/cities` | Cities with localities and indicative rates |
| GET | `/api/listings` | Query: `deal`, `city`, `q`, `bhk` (e.g. `2,3,4+`), `type`, `maxPrice`, `status` (`ready`/`uc`), `sort` (`new`/`lo`/`hi`/`psf`/`deal`), `ids` |
| GET | `/api/listings/:id` | One listing |
| POST | `/api/listings` | Create a listing → `201`, broadcasts `listing:created` |
| POST | `/api/listings/:id/enquiries` | Request a site visit → `201`, broadcasts `listing:activity` (count only) |
| GET | `/api/enquiries?ids=` | Your enquiries, by their UUIDs |
| GET | `/api/events` | Server-Sent Events: `presence`, `listing:created`, `listing:activity` |

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
