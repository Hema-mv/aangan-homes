import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { CITIES, LISTINGS } from "./seed-data.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cities (
  name           TEXT PRIMARY KEY,
  state          TEXT NOT NULL,
  deposit_months INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS localities (
  city      TEXT NOT NULL REFERENCES cities(name),
  name      TEXT NOT NULL,
  lat       REAL NOT NULL,
  lng       REAL NOT NULL,
  sale_rate INTEGER NOT NULL,   -- ₹ per sq ft
  rent_rate INTEGER NOT NULL,   -- ₹ per sq ft per month
  PRIMARY KEY (city, name)
);
CREATE TABLE IF NOT EXISTS listings (
  id          TEXT PRIMARY KEY,
  deal        TEXT NOT NULL CHECK (deal IN ('buy','rent')),
  city        TEXT NOT NULL,
  locality    TEXT NOT NULL,
  type        TEXT NOT NULL,
  bhk         INTEGER NOT NULL,
  area        INTEGER NOT NULL,
  price       INTEGER NOT NULL,
  title       TEXT NOT NULL,
  bath        INTEGER NOT NULL DEFAULT 0,
  floor       TEXT NOT NULL DEFAULT '—',
  facing      TEXT NOT NULL DEFAULT '—',
  furnishing  TEXT NOT NULL DEFAULT '—',
  possession  TEXT NOT NULL,
  age         TEXT NOT NULL DEFAULT '—',
  agent       TEXT NOT NULL,
  firm        TEXT NOT NULL,
  phone       TEXT,                -- NULL for sample listings
  amenities   TEXT NOT NULL DEFAULT '[]',  -- JSON array
  hue         INTEGER NOT NULL,
  is_sample   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  FOREIGN KEY (city, locality) REFERENCES localities(city, name)
);
CREATE INDEX IF NOT EXISTS idx_listings_search ON listings(deal, city, price);
CREATE TABLE IF NOT EXISTS enquiries (
  id          TEXT PRIMARY KEY,     -- random UUID, doubles as the read key
  listing_id  TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  visit       TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_enquiries_listing ON enquiries(listing_id);
`;

/**
 * Schema migrations, applied in order and tracked with PRAGMA user_version.
 * Never edit a released migration; add a new one.
 */
const MIGRATIONS = [
  // 1: initial schema
  (db) => db.exec(SCHEMA),
  // 2: localities can be added by users when they post. Their rates start unknown
  //    (NULL) and are filled in from nearby listings by the valuation model.
  (db) => db.exec(`
    CREATE TABLE localities_v2 (
      city      TEXT NOT NULL REFERENCES cities(name),
      name      TEXT NOT NULL COLLATE NOCASE,
      lat       REAL NOT NULL,
      lng       REAL NOT NULL,
      sale_rate INTEGER,              -- indicative ₹/sq ft; NULL for user-added localities
      rent_rate INTEGER,
      source    TEXT NOT NULL DEFAULT 'seed' CHECK (source IN ('seed','user')),
      created_at TEXT,
      PRIMARY KEY (city, name)
    );
    INSERT INTO localities_v2 (city, name, lat, lng, sale_rate, rent_rate, source)
      SELECT city, name, lat, lng, sale_rate, rent_rate, 'seed' FROM localities;
    DROP TABLE localities;
    ALTER TABLE localities_v2 RENAME TO localities;
    CREATE INDEX IF NOT EXISTS idx_listings_locality ON listings(city, locality);
  `),
];

function migrate(db) {
  const current = db.prepare("PRAGMA user_version").get().user_version;
  if (current >= MIGRATIONS.length) return;
  // Table rebuilds need FK enforcement off; it is re-checked before commit.
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("BEGIN");
  try {
    for (let v = current; v < MIGRATIONS.length; v++) MIGRATIONS[v](db);
    const broken = db.prepare("PRAGMA foreign_key_check").all();
    if (broken.length) throw new Error(`Migration left ${broken.length} broken foreign keys`);
    db.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

/** Opens (and if needed creates, migrates and seeds) the database. Pass ":memory:" for tests. */
export function openDb(file = ":memory:", { seed = true } = {}) {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  migrate(db);
  db.exec("PRAGMA foreign_keys = ON;");
  if (seed && db.prepare("SELECT COUNT(*) AS n FROM cities").get().n === 0) seedDb(db);
  return db;
}

export function seedDb(db, now = Date.now()) {
  const city = db.prepare("INSERT INTO cities (name, state, deposit_months) VALUES (?, ?, ?)");
  const loc = db.prepare("INSERT INTO localities (city, name, lat, lng, sale_rate, rent_rate) VALUES (?, ?, ?, ?, ?, ?)");
  const listing = db.prepare(`INSERT INTO listings
    (id, deal, city, locality, type, bhk, area, price, title, bath, floor, facing, furnishing, possession, age, agent, firm, phone, amenities, hue, is_sample, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 1, ?)`);
  db.exec("BEGIN");
  try {
    for (const [name, c] of Object.entries(CITIES)) {
      city.run(name, c.state, c.deposit);
      for (const [n, [lat, lng, sale, rent]] of Object.entries(c.localities)) loc.run(name, n, lat, lng, sale, rent);
    }
    LISTINGS.forEach((l, i) => {
      // Spread seed listings over the past few days so "listed N days ago" looks natural.
      const created = new Date(now - l.days * 86_400_000 - (i % 5) * 3_600_000).toISOString();
      listing.run("s" + (i + 1), l.deal, l.city, l.locality, l.type, l.bhk, l.area, l.price, l.title, l.bath, l.floor, l.facing,
        l.furnishing, l.possession, l.age, l.agent, l.firm, JSON.stringify(l.amenities), (i * 47) % 360, created);
    });
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
