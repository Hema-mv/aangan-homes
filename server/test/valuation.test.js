import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { valuate, similarity, haversineKm, median } from "../src/valuation.js";

const NOW = Date.parse("2026-10-28T00:00:00Z");
const daysAgo = (d) => new Date(NOW - d * 86_400_000).toISOString();
const BANER = { lat: 18.559, lng: 73.7868 }, KHARADI = { lat: 18.5515, lng: 73.9348 };
const flat = (id, over = {}) => ({ id, deal: "buy", type: "Apartment", bhk: 2, area: 1000, price: 11_000_000, createdAt: daysAgo(3), ...BANER, ...over });
const prior = { rate: 10_000, source: "locality" };

describe("haversineKm", () => {
  test("Baner to Kharadi is about 15.6 km", () => assert.ok(Math.abs(haversineKm(BANER, KHARADI) - 15.6) < 0.3));
});

describe("similarity", () => {
  test("ignores the listing itself, other deals, and other property groups", () => {
    const t = flat("t");
    assert.equal(similarity(t, t, NOW), null);
    assert.equal(similarity(t, flat("r", { deal: "rent" }), NOW), null);
    assert.equal(similarity(t, flat("p", { type: "Plot", bhk: 0 }), NOW), null);
  });

  test("villas and independent houses count as comparable", () => {
    assert.ok(similarity(flat("t", { type: "Villa" }), flat("c", { type: "Independent House" }), NOW));
  });

  test("closer, similar-sized, same-BHK, fresher comps weigh more", () => {
    const t = flat("t");
    const base = similarity(t, flat("c"), NOW).weight;
    assert.ok(similarity(t, flat("far", KHARADI), NOW).weight < base);
    assert.ok(similarity(t, flat("big", { area: 2000 }), NOW).weight < base);
    assert.ok(similarity(t, flat("3bhk", { bhk: 3 }), NOW).weight < base);
    assert.ok(similarity(t, flat("old", { createdAt: daysAgo(300) }), NOW).weight < base);
  });
});

describe("valuate", () => {
  test("with no comps, falls back to the prior × type factor", () => {
    const r = valuate(flat("t"), [], prior, NOW);
    assert.equal(r.estimate, 10_000_000);
    assert.equal(r.basis.method, "locality");
    assert.equal(r.basis.compCount, 0);

    const villa = valuate(flat("v", { type: "Villa" }), [], prior, NOW);
    assert.equal(villa.estimate, 10_800_000, "+8% for independent homes");
  });

  test("strong nearby comps pull the estimate toward their ₹/sq ft", () => {
    const pool = [flat("a", { price: 13_000_000 }), flat("b", { price: 13_000_000 }), flat("c", { price: 13_000_000 })];
    const r = valuate(flat("t"), pool, prior, NOW);
    assert.equal(r.basis.method, "comps");
    assert.ok(r.estimate > 11_500_000 && r.estimate < 13_000_000, `got ${r.estimate}`);
    assert.equal(r.comps.length, 3);
  });

  test("a distant, dissimilar listing barely moves the number", () => {
    const outlier = flat("x", { ...KHARADI, area: 3000, bhk: 4, price: 90_000_000 });
    const r = valuate(flat("t"), [outlier], prior, NOW);
    assert.equal(r.basis.compCount, 0, "dropped below minimum weight");
    assert.equal(r.estimate, 10_000_000);
  });

  test("a new locality with only a city prior has low confidence", () => {
    const r = valuate(flat("t"), [], { rate: 9_000, source: "city" }, NOW);
    assert.equal(r.basis.confidence, "low");
    assert.equal(r.basis.method, "city");
  });

  test("caps the number of comps used", () => {
    const pool = Array.from({ length: 20 }, (_, i) => flat("c" + i));
    assert.equal(valuate(flat("t"), pool, prior, NOW).comps.length, 8);
  });
});

test("median", () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});
