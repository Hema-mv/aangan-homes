import { randomUUID } from "node:crypto";
import { estimate } from "./pricing.js";

const DAY = 86_400_000;

// Data access. Every query is parameterised; nothing from the request is concatenated into SQL.
export function createRepo(db) {
  const rowToListing = (r) => {
    const est = estimate(r, r);
    return {
      id: r.id, deal: r.deal, city: r.city, locality: r.locality, type: r.type, bhk: r.bhk, area: r.area, price: r.price,
      title: r.title, bath: r.bath, floor: r.floor, facing: r.facing, furnishing: r.furnishing, possession: r.possession,
      age: r.age, agent: r.agent, firm: r.firm, phone: r.phone, amenities: JSON.parse(r.amenities), hue: r.hue,
      isSample: !!r.is_sample, createdAt: r.created_at,
      daysListed: Math.max(0, Math.floor((Date.now() - Date.parse(r.created_at)) / DAY)),
      estimate: Math.round(est),
      diffPct: Math.round((r.price / est - 1) * 1000) / 10,
      enquiryCount: r.enquiry_count ?? 0,
    };
  };

  const SELECT = `SELECT l.*, loc.sale_rate, loc.rent_rate,
      (SELECT COUNT(*) FROM enquiries e WHERE e.listing_id = l.id) AS enquiry_count
    FROM listings l JOIN localities loc ON loc.city = l.city AND loc.name = l.locality`;

  const SORTS = {
    new: (a, b) => b.createdAt.localeCompare(a.createdAt),
    lo: (a, b) => a.price - b.price,
    hi: (a, b) => b.price - a.price,
    psf: (a, b) => a.price / a.area - b.price / b.area,
    deal: (a, b) => a.diffPct - b.diffPct,
  };

  return {
    cities() {
      const cities = db.prepare("SELECT * FROM cities ORDER BY name").all();
      const locs = db.prepare("SELECT * FROM localities ORDER BY name").all();
      return cities.map((c) => ({
        name: c.name, state: c.state, depositMonths: c.deposit_months,
        localities: locs.filter((l) => l.city === c.name)
          .map((l) => ({ name: l.name, lat: l.lat, lng: l.lng, saleRate: l.sale_rate, rentRate: l.rent_rate })),
      }));
    },

    locality(city, name) {
      return db.prepare("SELECT * FROM localities WHERE city = ? AND name = ?").get(city, name);
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
      const sql = SELECT + (where.length ? " WHERE " + where.join(" AND ") : "");
      return db.prepare(sql).all(...args).map(rowToListing).sort(SORTS[f.sort ?? "new"]);
    },

    listing(id) {
      const r = db.prepare(SELECT + " WHERE l.id = ?").get(id);
      return r ? rowToListing(r) : null;
    },

    createListing(input) {
      const id = "l_" + randomUUID().replaceAll("-", "").slice(0, 12);
      db.prepare(`INSERT INTO listings
        (id, deal, city, locality, type, bhk, area, price, title, bath, possession, agent, firm, phone, amenities, hue, is_sample, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`)
        .run(id, input.deal, input.city, input.locality, input.type, input.bhk, input.area, input.price, input.title,
          Math.max(1, input.bhk), input.possession, input.agent, "Independent agent", input.phone,
          JSON.stringify(input.amenities ?? []), Math.floor(Math.random() * 360), new Date().toISOString());
      return this.listing(id);
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
