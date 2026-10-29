export const inr = (n) => Math.round(n).toLocaleString("en-IN");

/** ₹2.95 Cr / ₹98 L / ₹38,000 */
export function money(n) {
  if (n >= 1e7) return "₹" + (n / 1e7).toFixed(n >= 1e8 ? 1 : 2).replace(/\.?0+$/, "") + " Cr";
  if (n >= 1e5) return "₹" + (n / 1e5).toFixed(1).replace(/\.0$/, "") + " L";
  return "₹" + inr(n);
}

/** Compact label for map pins: ₹2.95Cr, ₹38k */
export function shortPrice({ deal, price }) {
  if (deal === "rent") return price >= 1e5 ? "₹" + (price / 1e5).toFixed(1).replace(/\.0$/, "") + "L" : "₹" + Math.round(price / 1000) + "k";
  return money(price).replace(" ", "");
}

/** Monthly EMI on principal P at an annual rate (%) over years. */
export function emi(P, annualPct, years) {
  const n = years * 12;
  if (annualPct === 0) return P / n;
  const r = annualPct / 1200;
  return (P * r * (1 + r) ** n) / ((1 + r) ** n - 1);
}

/** How a price compares with its locality estimate. */
export function valueTag(diffPct) {
  if (Math.abs(diffPct) < 3) return { kind: "flat", label: "In line with locality estimate" };
  return diffPct < 0
    ? { kind: "good", label: `▼ ${Math.abs(diffPct).toFixed(0)}% below estimate` }
    : { kind: "bad", label: `▲ ${diffPct.toFixed(0)}% above estimate` };
}

export const daysAgo = (d) => (d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`);

export const isUnderConstruction = (l) => /^Under construction/.test(l.possession);

/** Stable small offset so pins in the same locality don't stack exactly. */
export function jitter(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return [((h & 255) / 255 - 0.5) * 0.012, (((h >> 8) & 255) / 255 - 0.5) * 0.012];
}

/** Buy-side costs used in the compare table and EMI panel. */
export const STAMP_DUTY_PCT = 7;
export function buyCosts(price, { downPct = 20, rate = 8.5, years = 20 } = {}) {
  const loan = price * (1 - downPct / 100);
  const monthly = emi(loan, rate, years);
  return {
    loan, monthly,
    downPayment: price - loan,
    upfront: price * (downPct + STAMP_DUTY_PCT) / 100,
    totalInterest: monthly * years * 12 - loan,
  };
}

export const BUDGETS = {
  buy: [["", "Any budget"], [5e6, "Up to ₹50 L"], [7.5e6, "Up to ₹75 L"], [1e7, "Up to ₹1 Cr"], [1.5e7, "Up to ₹1.5 Cr"], [2e7, "Up to ₹2 Cr"], [3e7, "Up to ₹3 Cr"], [5e7, "Up to ₹5 Cr"]],
  rent: [["", "Any rent"], [20000, "Up to ₹20k/mo"], [35000, "Up to ₹35k/mo"], [50000, "Up to ₹50k/mo"], [75000, "Up to ₹75k/mo"], [100000, "Up to ₹1 L/mo"]],
};
