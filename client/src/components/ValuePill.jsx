import { valueTag, money, inr } from "../lib/format.js";

export default function ValuePill({ diffPct }) {
  const { kind, label } = valueTag(diffPct);
  return <span className={`pill ${kind}`}>{label}</span>;
}

export function CompareButton({ active, onClick }) {
  return (
    <button className="cmpbtn" type="button" aria-pressed={active} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {active ? "✓ Comparing" : "+ Compare"}
    </button>
  );
}

export function PriceLine({ listing: l }) {
  return (
    <div className="price">
      {money(l.price)}
      <small>{l.deal === "rent" ? "/month" : `₹${inr(l.price / l.area)}/sq ft`}</small>
    </div>
  );
}
