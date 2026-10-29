import { buyCosts, daysAgo, inr, money, valueTag } from "./format.js";

export const MAX_COMPARE = 3;

/**
 * Decides whether a listing can join the compare set.
 * Returns an error message, or null if it can be added.
 */
export function canAddToCompare(current, listing) {
  if (current.some((l) => l.id === listing.id)) return null;
  if (current.length && current[0].deal !== listing.deal) {
    return `Compare ${current[0].deal === "buy" ? "homes for sale" : "rentals"} together. Clear the tray to switch.`;
  }
  if (current.length >= MAX_COMPARE) return `You can compare up to ${MAX_COMPARE} homes. Remove one first.`;
  return null;
}

/**
 * Builds the side-by-side table. Each row carries the display text per listing,
 * whether every value is the same, and which cells are the best in that row.
 */
export function compareRows(items, cities = []) {
  const buy = items[0]?.deal !== "rent";
  const dep = (l) => cities.find((c) => c.name === l.city)?.depositMonths ?? 3;

  const rows = [
    { key: "price", label: "Price", text: (l) => money(l.price) + (buy ? "" : "/mo"), score: (l) => l.price, better: "min" },
    buy && { key: "psf", label: "Price per sq ft", text: (l) => "₹" + inr(l.price / l.area), score: (l) => l.price / l.area, better: "min" },
    { key: "value", label: "vs estimate", kind: "pill", text: (l) => valueTag(l.diffPct).label, score: (l) => l.diffPct, better: "min" },
    buy
      ? { key: "emi", label: "Monthly EMI", text: (l) => "₹" + inr(buyCosts(l.price).monthly), score: (l) => buyCosts(l.price).monthly, better: "min" }
      : { key: "deposit", label: "Deposit", text: (l) => `₹${inr(l.price * dep(l))} (${dep(l)} mo)`, score: (l) => l.price * dep(l), better: "min" },
    buy
      ? { key: "upfront", label: "Cash upfront", text: (l) => "₹" + inr(buyCosts(l.price).upfront), score: (l) => buyCosts(l.price).upfront, better: "min" }
      : { key: "movein", label: "Move-in cost", text: (l) => "₹" + inr(l.price * (1 + dep(l))), score: (l) => l.price * (1 + dep(l)), better: "min" },
    { key: "config", label: "Configuration", text: (l) => (l.bhk ? `${l.bhk} BHK · ${l.bath} bath` : "Plot") },
    { key: "area", label: "Super built-up", text: (l) => inr(l.area) + " sq ft", score: (l) => l.area, better: "max" },
    { key: "type", label: "Type", text: (l) => l.type },
    { key: "location", label: "Location", text: (l) => `${l.locality}, ${l.city}` },
    { key: "possession", label: "Possession", text: (l) => l.possession },
    { key: "floor", label: "Floor", text: (l) => l.floor },
    { key: "facing", label: "Facing", text: (l) => l.facing },
    { key: "furnishing", label: "Furnishing", text: (l) => l.furnishing },
    { key: "age", label: "Age", text: (l) => l.age },
    { key: "listed", label: "Listed", text: (l) => daysAgo(l.daysListed) },
    { key: "enquiries", label: "Enquiries", text: (l) => String(l.enquiryCount) },
    { key: "amenities", label: "Amenities", kind: "amenities", text: (l) => l.amenities.join(", ") || "—" },
  ].filter(Boolean);

  return rows.map((r) => {
    const texts = items.map(r.text);
    const same = items.length > 1 && texts.every((t) => t === texts[0]);
    let best = items.map(() => false);
    if (r.score && items.length > 1) {
      const s = items.map(r.score);
      const target = r.better === "min" ? Math.min(...s) : Math.max(...s);
      if (!s.every((v) => v === s[0])) best = s.map((v) => Math.abs(v - target) < 1e-6);
    }
    return { key: r.key, label: r.label, kind: r.kind ?? "text", texts, same, best };
  });
}

/** Amenities present in some but not all of the compared homes. */
export function distinctAmenities(items) {
  const all = new Set(items.flatMap((l) => l.amenities));
  return new Set([...all].filter((a) => !items.every((l) => l.amenities.includes(a))));
}
