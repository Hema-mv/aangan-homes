// Property-type adjustment applied to per-sq-ft rates.
export function typeFactor(type) {
  if (type === "Villa" || type === "Independent House") return 1.08;
  if (type === "Plot") return 0.95;
  return 1;
}
