// Locality-based price estimate: rate × area, adjusted for property type.
export function typeFactor(type) {
  if (type === "Villa" || type === "Independent House") return 1.08;
  if (type === "Plot") return 0.95;
  return 1;
}

export function estimate({ deal, type, area }, { sale_rate, rent_rate }) {
  return (deal === "rent" ? rent_rate : sale_rate) * area * typeFactor(type);
}
