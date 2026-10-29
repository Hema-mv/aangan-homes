import { inr, jitter, shortPrice } from "../lib/format.js";

const W = 440, H = 520;

/** Schematic locality map: positions from real lat/lng, circles sized by ₹/sq ft, one price pin per listing. */
export default function MapView({ city, deal, listings, hotId, onHover, onOpen }) {
  if (!city) return null;
  const locs = city.localities;
  const lats = locs.map((l) => l.lat), lngs = locs.map((l) => l.lng);
  let a = Math.min(...lats), b = Math.max(...lats), x0 = Math.min(...lngs), x1 = Math.max(...lngs);
  const padY = (b - a) * 0.18 + 0.01, padX = (x1 - x0) * 0.18 + 0.01;
  a -= padY; b += padY; x0 -= padX; x1 += padX;
  const s = Math.min(W / (x1 - x0), H / (b - a)), ox = (W - (x1 - x0) * s) / 2, oy = (H - (b - a) * s) / 2;
  const P = (lat, lng) => [ox + (lng - x0) * s, oy + (b - lat) * s];
  const rateOf = (l) => (deal === "rent" ? l.rentRate : l.saleRate);
  const rates = locs.map(rateOf), rmax = Math.max(...rates), rmin = Math.min(...rates);
  const byName = Object.fromEntries(locs.map((l) => [l.name, l]));
  const pts = locs.map((l) => ({ l, p: P(l.lat, l.lng) }));

  // Draw the highlighted pin last so it sits on top.
  const pins = [...listings].sort((p, q) => (p.id === hotId) - (q.id === hotId));

  return (
    <svg id="map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map of ${city.name} localities with listing pins`}>
      <rect width={W} height={H} fill="var(--mapbg)" />
      {Array.from({ length: Math.floor(W / 40) }, (_, i) => <line key={"v" + i} x1={(i + 1) * 40} y1="0" x2={(i + 1) * 40} y2={H} stroke="var(--mapgrid)" />)}
      {Array.from({ length: Math.floor(H / 40) }, (_, i) => <line key={"h" + i} x1="0" y1={(i + 1) * 40} x2={W} y2={(i + 1) * 40} stroke="var(--mapgrid)" />)}
      {pts.map(({ p }, i) => {
        const n = pts[(i + 1) % pts.length].p;
        return <line key={"r" + i} x1={p[0]} y1={p[1]} x2={n[0]} y2={n[1]} stroke="var(--line)" strokeWidth="4" strokeLinecap="round" />;
      })}
      {pts.map(({ l, p }) => {
        const rate = rateOf(l), rad = 22 + (26 * (rate - rmin)) / (rmax - rmin || 1), ty = Math.min(H - 8, p[1] + rad + 14);
        return (
          <g key={l.name}>
            <circle cx={p[0]} cy={p[1]} r={rad} fill="var(--brand)" fillOpacity=".07" stroke="var(--muted)" strokeOpacity=".5" strokeDasharray="3 3" />
            <text x={p[0]} y={ty} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)">{l.name}</text>
            <text x={p[0]} y={ty + 13} textAnchor="middle" fontSize="10" fill="var(--muted)">₹{inr(rate)}/sq ft{deal === "rent" ? "/mo" : ""}</text>
          </g>
        );
      })}
      {pins.map((l) => {
        const loc = byName[l.locality];
        if (!loc) return null;
        const j = jitter(l.id), [x, y] = P(loc.lat + j[0], loc.lng + j[1]);
        const t = shortPrice(l), w = t.length * 7 + 14, left = Math.max(2, Math.min(W - w - 2, x - w / 2));
        return (
          <g key={l.id} className={"pin" + (l.id === hotId ? " hot" : "")} tabIndex={0} role="button" aria-label={`${l.title}, ${t}`}
            onClick={() => onOpen(l)} onMouseEnter={() => onHover(l.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(l); } }}>
            <rect x={left} y={y - 24} width={w} height="20" rx="10" />
            <text x={left + w / 2} y={y - 10} textAnchor="middle">{t}</text>
          </g>
        );
      })}
    </svg>
  );
}
