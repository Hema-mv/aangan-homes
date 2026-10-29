import { randomUUID } from "node:crypto";
import { valuate, median } from "./valuation.js";

const DAY = 86_400_000;

// Data access. Every query is parameterised; nothing from the request is concatenated into SQL.
export function createRepo(db) {
  const SELECT = `SELECT l.*, loc.lat, loc.lng, loc.sale_rate, loc.rent_rate, loc.source AS locality_source,
      (SELECT COUNT(*) FROM enquiries e WHERE e.listing_id = l.id) AS enquiry_count
    FROM listings l JOIN localities loc ON loc.city = l.city AND loc.name = l.locality`;

  const toListing = (r) => ({
    id: r.id, deal: r.deal, city: r.city, locality: r.locality, type: r.type, bhk: r.bhk, area: r.area, price: r.price,
    title: r.title, bath: r.bath, floor: r.floor, facing: r.facing, furnishing: r.furnishing, possession: r.possession,
    age: r.age, agent: r.agent, firm: r.firm, phone: r.phone, amenities: JSON.parse(r.amenities), hue: r.hue,
    lat: r.lat, lng: r.lng, isSample: !!r.is_sample, createdAt: r.created_at,
    daysListed: Math.max(0, Math.floor((Date.now() - Date.parse(r.created_at)) / DAY)),
    enquiryCount: r.enquiry_count ?? 0,
  });

  /** City-wide fallback rate: median of the seeded localities' indicative rates. */
  const cityPrior = (city, deal) => {
    const col = deal === "rent" ? "rent_rate" : "sale_rate";
    return median(db.prepare(`SELECT ${col} AS r FROM localities WHERE city = ? AND ${col} IS NOT NULL`).all(city).map((x) => x.r));
  };

  /** Adds estimate, diffPct and the reasoning to each listing, comparing against everything else in its city. */
  function withValuation(listings) {
    const pools = new Map(), priors = new Map();
    for (const l of listings) {
      if (!pools.has(l.city)) pools.set(l.city, db.prepare(SELECT + " WHERE l.city = ?").all(l.city).map(toListing));
    }
    return listings.map((l) => {
      const row = l._row;
      const localRate = l.deal === "rent" ? row.rent_rate : row.sale_rate;
      const key = l.city + "|" + l.deal;
      if (!priors.has(key)) priors.set(key, cityPrior(l.city, l.deal));
      const prior = localRate != null ? { rate: localRate, source: "locality" } : { rate: priors.get(key), source: "city" };
      const v = valuate(l, pools.get(l.city), prior);
      const { _row, ...clean } = l;
      return { ...clean, estimate: v.estimate, diffPct: Math.round((l.price / v.estimate - 1) * 1000) / 10, estimateBasis: v.basis, _comps: v.comps };
    });
  }

  const load = (rows) => withValuation(rows.map((r) => ({ ...toListing(r), _row: r })));
  const strip = ({ _comps, ...l }) => l;

  const SORTS = {
    new: (a, b) => b.createdAt.localeCompare(a.createdAt),
    lo: (a, b) => a.price - b.price,
    hi: (a, b) => b.price - a.price,
    psf: (a, b) => a.price / a.area - b.price / b.area,
    deal: (a, b) => a.diffPct - b.diffPct,
  };

  // Places a new locality near the city centre, offset by a hash of its name so new areas don't stack.
  function placeNewLocality(city, name) {
    const c = db.prepare("SELECT AVG(lat) AS lat, AVG(lng) AS lng FROM localities WHERE city = ? AND source = 'seed'").get(city);
    let h = 0;
    for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return { lat: c.lat + (((h & 1023) / 1023) - 0.5) * 0.05, lng: c.lng + ((((h >> 10) & 1023) / 1023) - 0.5) * 0.05 };
  }

  return {
    cities() {
      const cities = db.prepare("SELECT * FROM cities ORDER BY name").all();
      const locs = db.prepare("SELECT * FROM localities ORDER BY name").all();
      // Areas without an indicative rate show the median ₹/sq ft of their own listings instead.
      const observed = db.prepare(`SELECT city, locality, deal, price * 1.0 / area AS psf FROM listings WHERE type != 'Plot'`).all();
      const observedRate = (l, deal) => {
        const m = median(observed.filter((o) => o.city === l.city && o.locality === l.name && o.deal === deal).map((o) => o.psf));
        return m == null ? null : Math.round(m);
      };
      return cities.map((c) => ({
        name: c.name, state: c.state, depositMonths: c.deposit_months,
        localities: locs.filter((l) => l.city === c.name).map((l) => {
          const saleRate = l.sale_rate ?? observedRate(l, "buy"), rentRate = l.rent_rate ?? observedRate(l, "rent");
          return {
            name: l.name, lat: l.lat, lng: l.lng, source: l.source, saleRate, rentRate,
            rateSource: l.sale_rate != null ? "indicative" : saleRate != null || rentRate != null ? "listings" : null,
          };
        }),
      }));
    },

    cityExists(name) {
      return !!db.prepare("SELECT 1 FROM cities WHERE name = ?").get(name);
    },

    /** Returns the canonical locality name, creating the locality if it's new to this city. */
    resolveLocality(city, name) {
      const existing = db.prepare("SELECT name FROM localities WHERE city = ? AND name = ?").get(city, name); // NOCASE match
      if (existing) return { name: existing.name, created: false };
      const { lat, lng } = placeNewLocality(city, name);
      db.prepare("INSERT INTO localities (city, name, lat, lng, source, created_at) VALUES (?, ?, ?, ?, 'user', ?)")
        .run(city, name, lat, lng, new Date().toISOString());
      return { name, created: true };
    },

    /** Filters are all optional; see schemas.listingQuery for the accepted shape. */
    listings(f = {}) {
      const where = [], args = [];
      if (f.ids) { where.push(`l.id IN (${f.ids.map(() => "?").join(",")})`); args.push(...f.ids); }
      if (f.deal) { where.push("l.deal = ?"); args.push(f.deal); }
      if (f.city) { where.push("l.city = ?"); args.push(f.city); }
      if (f.type) { where.push("l.type = ?"); args.push(f.type); }
      if (f.maxPrice) { where.push("l.price <= ?"); args.push(f.maxPrice); }
      if (f.q) {
        where.push("(l.title || ' ' || l.locality || ' ' || l.type) LIKE ? ESCAPE '\\'");
        args.push("%" + f.q.replace(/[\\%_]/g, (c) => "\\" + c) + "%");
      }
      if (f.bhk?.length) {
        const exact = f.bhk.filter((b) => b !== "4+").map(Number);
        const parts = [];
        if (exact.length) { parts.push(`l.bhk IN (${exact.map(() => "?").join(",")})`); args.push(...exact); }
        if (f.bhk.includes("4+")) parts.push("l.bhk >= 4");
        where.push("(" + parts.join(" OR ") + ")");
      }
      if (f.status === "ready") where.push("l.possession NOT LIKE 'Under construction%'");
      if (f.status === "uc") where.push("l.possession LIKE 'Under construction%'");
      const rows = db.prepare(SELECT + (where.length ? " WHERE " + where.join(" AND ") : "")).all(...args);
      return load(rows).map(strip).sort(SORTS[f.sort ?? "new"]);
    },

    listing(id) {
      const r = db.prepare(SELECT + " WHERE l.id = ?").get(id);
      return r ? strip(load([r])[0]) : null;
    },

    /** The listing's estimate plus the similar homes that produced it. */
    comparables(id) {
      const r = db.prepare(SELECT + " WHERE l.id = ?").get(id);
      if (!r) return null;
      const [l] = load([r]);
      const byId = new Map(db.prepare(SELECT + " WHERE l.city = ?").all(l.city).map((x) => [x.id, toListing(x)]));
      return {
        estimate: l.estimate, basis: l.estimateBasis,
        comps: l._comps.map((c) => {
          const x = byId.get(c.id);
          return { id: x.id, title: x.title, locality: x.locality, bhk: x.bhk, area: x.area, price: x.price, type: x.type,
            psf: Math.round(x.price / x.area), daysListed: x.daysListed, distanceKm: c.distanceKm, weight: c.weight };
        }),
      };
    },

    createListing(input) {
      const id = "l_" + randomUUID().replaceAll("-", "").slice(0, 12);
      db.exec("BEGIN");
      try {
        const loc = this.resolveLocality(input.city, input.locality);
        db.prepare(`INSERT INTO listings
          (id, deal, city, locality, type, bhk, area, price, title, bath, possession, agent, firm, phone, amenities, hue, is_sample, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`)
          .run(id, input.deal, input.city, loc.name, input.type, input.bhk, input.area, input.price, input.title,
            Math.max(1, input.bhk), input.possession, input.agent, "Independent agent", input.phone,
            JSON.stringify(input.amenities ?? []), Math.floor(Math.random() * 360), new Date().toISOString());
        db.exec("COMMIT");
        return { listing: this.listing(id), newLocality: loc.created };
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },

    createEnquiry(listingId, input) {
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      db.prepare("INSERT INTO enquiries (id, listing_id, name, phone, visit, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(id, listingId, input.name, input.phone, input.visit, input.message, createdAt);
      return { id, listingId, ...input, createdAt };
    },

    /** Enquiries are only readable by whoever holds their (unguessable) ids. */
    enquiries(ids) {
      if (!ids.length) return [];
      return db.prepare(`SELECT e.*, l.title, l.locality, l.city FROM enquiries e JOIN listings l ON l.id = e.listing_id
          WHERE e.id IN (${ids.map(() => "?").join(",")}) ORDER BY e.created_at DESC`).all(...ids)
        .map((e) => ({ id: e.id, listingId: e.listing_id, title: e.title, locality: e.locality, city: e.city,
          name: e.name, phone: e.phone, visit: e.visit, message: e.message, createdAt: e.created_at }));
    },

    enquiryCount(listingId) {
      return db.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE listing_id = ?").get(listingId).n;
    },
  };
}
