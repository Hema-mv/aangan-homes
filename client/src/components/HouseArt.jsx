import { useId } from "react";

/** Procedural illustration: apartment block, plot, or house, tinted by the listing's hue. No image files needed. */
export default function HouseArt({ listing }) {
  const gid = useId();
  const { hue: h, type, bhk, area } = listing;
  const sky1 = `hsl(${(h + 190) % 360} 60% 82%)`, sky2 = `hsl(${(h + 200) % 360} 55% 93%)`;
  const wall = `hsl(${h} 35% 88%)`, wall2 = `hsl(${h} 30% 74%)`, trim = `hsl(${(h + 20) % 360} 45% 38%)`, win = "hsl(200 40% 36%)";

  let building;
  if (type === "Apartment") {
    const floors = bhk >= 3 ? 9 : 7, w = 110, x = 145, top = 170 - floors * 14;
    building = (
      <>
        <rect x={x - 70} y={top + 40} width="70" height={170 - top - 40} fill={wall2} />
        <rect x={x} y={top} width={w} height={170 - top} fill={wall} />
        <rect x={x - 4} y={top - 6} width={w + 8} height="8" fill={trim} />
        {Array.from({ length: floors }, (_, f) => [0, 1, 2, 3].map((c) => (
          <rect key={`${f}-${c}`} x={x + 10 + c * 25} y={top + 8 + f * 14} width="16" height="8" rx="1" fill={(f * 4 + c + h) % 7 === 0 ? "#F6D27A" : win} />
        )))}
        {[0, 1, 2, 3, 4].map((f) => <rect key={f} x={x - 60} y={top + 50 + f * 14} width="50" height="7" fill={win} opacity=".55" />)}
        <rect x={x + w + 10} y={top + 60} width="60" height={170 - top - 60} fill={wall2} opacity=".8" />
      </>
    );
  } else if (type === "Plot") {
    building = (
      <>
        <polygon points="40,150 360,150 330,120 80,120" fill="hsl(40 45% 70%)" />
        {[[80, 120], [330, 120], [40, 150], [360, 150]].map(([px, py]) => (
          <rect key={px + "-" + py} x={px - 3} y={py - 12} width="6" height="12" fill="#fff" stroke={trim} />
        ))}
        <rect x="190" y="88" width="4" height="40" fill={trim} />
        <rect x="160" y="72" width="64" height="24" rx="2" fill="#fff" stroke={trim} />
        <text x="192" y="88" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill={trim}>{area} sq ft</text>
      </>
    );
  } else {
    const tall = type === "Villa";
    building = (
      <>
        <rect x="120" y={tall ? 80 : 95} width="160" height={tall ? 90 : 75} fill={wall} />
        <polygon points={`108,${tall ? 82 : 97} 200,${tall ? 40 : 58} 292,${tall ? 82 : 97}`} fill={trim} />
        <rect x="185" y="125" width="30" height="45" fill={trim} />
        <rect x="135" y={tall ? 95 : 110} width="30" height="22" fill={win} />
        <rect x="235" y={tall ? 95 : 110} width="30" height="22" fill={win} />
        {tall && (
          <>
            <rect x="135" y="135" width="30" height="22" fill={win} />
            <rect x="235" y="135" width="30" height="22" fill="#F6D27A" />
            <rect x="225" y="122" width="50" height="4" fill={trim} />
          </>
        )}
        <rect x="290" y="130" width="70" height="40" fill={wall2} />
      </>
    );
  }

  return (
    <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky1} />
          <stop offset="1" stopColor={sky2} />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill={`url(#${gid})`} />
      <circle cx="340" cy="45" r="18" fill="hsl(42 95% 70%)" />
      <rect y="165" width="400" height="85" fill="hsl(95 30% 62%)" />
      <rect y="200" width="400" height="22" fill="hsl(220 8% 55%)" />
      <line x1="0" y1="211" x2="400" y2="211" stroke="#fff" strokeWidth="2" strokeDasharray="14 12" />
      {building}
      {/* coconut palm */}
      <path d="M60 170 Q64 120 70 92" stroke="hsl(30 35% 35%)" strokeWidth="5" fill="none" />
      <g fill="hsl(120 35% 36%)">
        <path d="M70 92 q-30 -4 -40 14 q18 -14 40 -14z" />
        <path d="M70 92 q30 -6 40 10 q-20 -10 -40 -10z" />
        <path d="M70 92 q-14 -24 -34 -26 q20 10 34 26z" />
        <path d="M70 92 q12 -26 32 -28 q-18 12 -32 28z" />
      </g>
    </svg>
  );
}
