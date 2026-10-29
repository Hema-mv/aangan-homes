import { BUDGETS } from "../lib/format.js";

const BHKS = ["1", "2", "3", "4+"];

export default function Filters({ filters: f, onChange }) {
  const toggleBhk = (b) => onChange({ bhk: f.bhk.includes(b) ? f.bhk.filter((x) => x !== b) : [...f.bhk, b] });
  return (
    <section className="filters wrap" aria-label="Filters">
      <div className="inner">
        <span className="flabel">BHK</span>
        <div className="chips">
          {BHKS.map((b) => (
            <button key={b} className="chip" type="button" aria-pressed={f.bhk.includes(b)} onClick={() => toggleBhk(b)}>{b} BHK</button>
          ))}
        </div>
        <span className="flabel">Type</span>
        <select className="fsel" aria-label="Property type" value={f.type} onChange={(e) => onChange({ type: e.target.value })}>
          <option value="">All types</option>
          {["Apartment", "Villa", "Independent House", "Plot"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <span className="flabel">Budget</span>
        <select className="fsel" aria-label="Maximum budget" value={f.maxPrice} onChange={(e) => onChange({ maxPrice: e.target.value })}>
          {BUDGETS[f.deal].map(([v, t]) => <option key={t} value={v}>{t}</option>)}
        </select>
        <select className="fsel" aria-label="Possession" value={f.status} onChange={(e) => onChange({ status: e.target.value })}>
          <option value="">Any possession</option><option value="ready">Ready to move</option><option value="uc">Under construction</option>
        </select>
        <span className="spacer" />
        <select className="fsel" aria-label="Sort" value={f.sort} onChange={(e) => onChange({ sort: e.target.value })}>
          <option value="new">Newest first</option>
          <option value="lo">Price: low to high</option>
          <option value="hi">Price: high to low</option>
          <option value="psf">Best value (₹/sq ft)</option>
          <option value="deal">Biggest discount vs estimate</option>
        </select>
      </div>
    </section>
  );
}
