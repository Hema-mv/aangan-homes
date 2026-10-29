import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRepo } from "./repo.js";
import { createLiveHub } from "./live.js";
import { listingQuery, newListing, newEnquiry, fieldErrors } from "./schemas.js";

class HttpError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields; }
}

function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, "Validation failed", fieldErrors(r.error));
  return r.data;
}

/**
 * Builds the Express app. Kept separate from index.js so tests can run it
 * against an in-memory database on a random port.
 */
export function createApp({ db, staticDir, limitWrites = true, live = createLiveHub() }) {
  const repo = createRepo(db);
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
        "img-src": ["'self'", "data:"],
      },
    },
  }));
  app.use(express.json({ limit: "20kb" }));

  // Writes are rate-limited per IP to blunt spam; reads are not.
  const writeLimiter = limitWrites
    ? rateLimit({ windowMs: 10 * 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false,
        message: { error: "Too many requests, please try again in a few minutes." } })
    : (_req, _res, next) => next();

  const api = express.Router();

  api.get("/health", (_req, res) => res.json({ ok: true, online: live.size }));

  api.get("/cities", (_req, res) => {
    // Not cached: users can add localities, and their rates move as listings arrive.
    res.set("Cache-Control", "no-cache").json(repo.cities());
  });

  api.get("/listings", (req, res) => {
    const f = parse(listingQuery, req.query);
    const items = repo.listings(f);
    res.json({ items, count: items.length });
  });

  api.get("/listings/:id", (req, res) => {
    const l = repo.listing(req.params.id);
    if (!l) throw new HttpError(404, "Listing not found");
    res.json(l);
  });

  api.get("/listings/:id/comparables", (req, res) => {
    const c = repo.comparables(req.params.id);
    if (!c) throw new HttpError(404, "Listing not found");
    res.json(c);
  });

  api.post("/listings", writeLimiter, (req, res) => {
    const input = parse(newListing, req.body);
    if (!repo.cityExists(input.city)) throw new HttpError(400, "Validation failed", { city: "We don't cover this city yet" });
    const { listing, newLocality } = repo.createListing(input);
    live.broadcast("listing:created", { ...listing, newLocality });
    res.status(201).location(`/api/listings/${listing.id}`).json({ ...listing, newLocality });
  });

  api.post("/listings/:id/enquiries", writeLimiter, (req, res) => {
    if (!repo.listing(req.params.id)) throw new HttpError(404, "Listing not found");
    const enquiry = repo.createEnquiry(req.params.id, parse(newEnquiry, req.body));
    // Broadcast only the count: enquiry contents (names, phones) never leave the requester.
    live.broadcast("listing:activity", { id: req.params.id, enquiryCount: repo.enquiryCount(req.params.id) });
    res.status(201).json(enquiry);
  });

  api.get("/enquiries", (req, res) => {
    const ids = String(req.query.ids ?? "").split(",").filter((s) => /^[0-9a-f-]{36}$/.test(s)).slice(0, 100);
    res.json(repo.enquiries(ids));
  });

  api.get("/events", live.handler);

  api.use((_req, _res) => { throw new HttpError(404, "Not found"); });
  app.use("/api", api);

  // In production the built React app is served from the same origin.
  if (staticDir && existsSync(staticDir)) {
    app.use(express.static(staticDir, { maxAge: "1h", index: false }));
    app.get("/{*splat}", (_req, res) => res.sendFile(join(staticDir, "index.html")));
  }

  // Express recognises error handlers by their four parameters, so _next must stay.
  app.use((err, _req, res, _next) => {
    if (err.type === "entity.parse.failed") err = new HttpError(400, "Malformed JSON");
    if (err.type === "entity.too.large") err = new HttpError(413, "Request body too large");
    const status = err.status ?? 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? "Internal server error" : err.message, ...(err.fields && { fields: err.fields }) });
  });

  return { app, live };
}
