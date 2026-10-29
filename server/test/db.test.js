import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../src/db.js";

test("migrates a version-1 database without losing data", () => {
  const dir = mkdtempSync(join(tmpdir(), "aangan-"));
  const file = join(dir, "v1.db");
  try {
    // Build a database the way version 1 of the app did: rates NOT NULL, no source column.
    const v1 = new DatabaseSync(file);
    v1.exec(`
      CREATE TABLE cities (name TEXT PRIMARY KEY, state TEXT NOT NULL, deposit_months INTEGER NOT NULL);
      CREATE TABLE localities (city TEXT NOT NULL REFERENCES cities(name), name TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
        sale_rate INTEGER NOT NULL, rent_rate INTEGER NOT NULL, PRIMARY KEY (city, name));
      CREATE TABLE listings (id TEXT PRIMARY KEY, deal TEXT NOT NULL, city TEXT NOT NULL, locality TEXT NOT NULL, type TEXT NOT NULL,
        bhk INTEGER NOT NULL, area INTEGER NOT NULL, price INTEGER NOT NULL, title TEXT NOT NULL, bath INTEGER NOT NULL DEFAULT 0,
        floor TEXT NOT NULL DEFAULT '—', facing TEXT NOT NULL DEFAULT '—', furnishing TEXT NOT NULL DEFAULT '—', possession TEXT NOT NULL,
        age TEXT NOT NULL DEFAULT '—', agent TEXT NOT NULL, firm TEXT NOT NULL, phone TEXT, amenities TEXT NOT NULL DEFAULT '[]',
        hue INTEGER NOT NULL, is_sample INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
        FOREIGN KEY (city, locality) REFERENCES localities(city, name));
      INSERT INTO cities VALUES ('Pune', 'MH', 3);
      INSERT INTO localities VALUES ('Pune', 'Baner', 18.559, 73.7868, 11500, 34);
      INSERT INTO listings (id, deal, city, locality, type, bhk, area, price, title, possession, agent, firm, hue, created_at)
        VALUES ('old1', 'buy', 'Pune', 'Baner', 'Apartment', 2, 1000, 11000000, 'Kept through migration', 'Ready to move', 'A', 'F', 1, '2026-10-01T00:00:00Z');
      PRAGMA user_version = 1;
    `);
    v1.close();

    const db = openDb(file);
    assert.equal(db.prepare("PRAGMA user_version").get().user_version, 2);
    assert.equal(db.prepare("SELECT title FROM listings WHERE id = 'old1'").get().title, "Kept through migration");
    const baner = db.prepare("SELECT * FROM localities WHERE name = 'baner'").get(); // NOCASE now
    assert.equal(baner.source, "seed");
    assert.equal(baner.sale_rate, 11500);
    // New localities can now be added without rates.
    db.prepare("INSERT INTO localities (city, name, lat, lng, source) VALUES ('Pune', 'Aundh', 18.56, 73.81, 'user')").run();
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
    db.close();

    // Re-opening is a no-op.
    openDb(file).close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
