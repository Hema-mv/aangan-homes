// Comparable-sales valuation: a small, explainable cousin of an automated valuation model.
//
// estimate ₹/sq ft = weighted average of similar nearby listings' ₹/sq ft, blended with a
// prior (the locality's indicative rate, or the city median when the locality is new).
// Similarity weight = distance × size × bedrooms × freshness, each in (0, 1].

import { typeFactor } from "./pricing.js";

export const PARAMS = {
  distanceKm: 5,      // weight halves roughly every 3.5 km
  sizeSpread: 0.35,   // on log(area ratio): 1.4× the size ≈ 0.38 weight
  ageDays: 180,       // older listings count for less
  minWeight: 0.05,    // ignore near-irrelevant comps
  maxComps: 8,
  priorWeight: 1.5,   // the prior counts like 1.5 perfect comps
};

const TYPE_GROUP = { Apartment: "flat", Villa: "house", "Independent House": "house", Plot: "land" };

export function haversineKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** How much `comp` should inform the value of `target`, with the parts for explaining it. */
export function similarity(target, comp, now = Date.now(), p = PARAMS) {
  if (comp.id === target.id || comp.deal !== target.deal || TYPE_GROUP[comp.type] !== TYPE_GROUP[target.type]) return null;
  const distanceKm = haversineKm(target, comp);
  const ageDays = Math.max(0, (now - Date.parse(comp.createdAt)) / 86_400_000);
  const w = Math.exp(-distanceKm / p.distanceKm)
    * Math.exp(-Math.abs(Math.log(comp.area / target.area)) / p.sizeSpread)
    * (TYPE_GROUP[target.type] === "land" ? 1 : 1 / (1 + Math.abs(comp.bhk - target.bhk)))
    * Math.exp(-ageDays / p.ageDays);
  return { weight: w, distanceKm };
}

/**
 * @param target  listing { id, deal, type, bhk, area, lat, lng }
 * @param pool    candidate listings (same city), each also with price and createdAt
 * @param prior   { rate, source: "locality" | "city" } — ₹/sq ft before the type adjustment
 */
export function valuate(target, pool, prior, now = Date.now(), p = PARAMS) {
  const comps = pool
    .map((c) => ({ c, s: similarity(target, c, now, p) }))
    .filter((x) => x.s && x.s.weight >= p.minWeight)
    .sort((a, b) => b.s.weight - a.s.weight)
    .slice(0, p.maxComps);

  const priorPsf = prior.rate * typeFactor(target.type);
  const wSum = comps.reduce((s, x) => s + x.s.weight, 0);
  const psf = (comps.reduce((s, x) => s + x.s.weight * (x.c.price / x.c.area), 0) + p.priorWeight * priorPsf) / (wSum + p.priorWeight);

  return {
    estimate: Math.round(psf * target.area),
    basis: {
      method: wSum >= 0.5 ? "comps" : prior.source, // what mostly drove the number
      confidence: wSum >= 2 ? "high" : wSum >= 0.5 || prior.source === "locality" ? "medium" : "low",
      compCount: comps.length,
      priorSource: prior.source,
    },
    comps: comps.map((x) => ({ id: x.c.id, weight: Math.round(x.s.weight * 1000) / 1000, distanceKm: Math.round(x.s.distanceKm * 10) / 10 })),
  };
}

export const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
