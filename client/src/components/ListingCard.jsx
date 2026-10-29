import HouseArt from "./HouseArt.jsx";
import ValuePill, { CompareButton, PriceLine } from "./ValuePill.jsx";
import { inr, isUnderConstruction } from "../lib/format.js";

export default function ListingCard({ listing: l, hot, fresh, saved, mine, comparing, onOpen, onHover, onToggleSave, onToggleCompare }) {
  return (
    <article
      className={"card" + (hot ? " hot" : "") + (fresh ? " fresh" : "")}
      data-id={l.id}
      tabIndex={0}
      role="button"
      aria-label={`${l.title}, ${l.locality}`}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen(); } }}
      onMouseEnter={onHover}
    >
      <div className="thumb">
        <HouseArt listing={l} />
        <div className="tags">
          {fresh && <span className="tag live">Just listed</span>}
          {!fresh && l.daysListed <= 2 && <span className="tag new">New</span>}
          {isUnderConstruction(l) ? <span className="tag">Under construction</span> : l.deal === "buy" && <span className="tag">Ready to move</span>}
          {mine && <span className="tag">Your listing</span>}
        </div>
        <button className="heart" type="button" aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save"}
          onClick={(e) => { e.stopPropagation(); onToggleSave(); }}>
          <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9.2-8.8C1.3 8.1 3.3 4.5 6.8 4.5c2 0 3.4 1.1 4.2 2.4.8-1.3 2.2-2.4 4.2-2.4 3.5 0 5.5 3.6 4 6.7C19 15.6 12 20 12 20z" fill="none" stroke="#13232C" strokeWidth="1.8" /></svg>
        </button>
      </div>
      <div className="cbody">
        <PriceLine listing={l} />
        <div className="facts">
          {l.bhk > 0 && <span>{l.bhk} BHK</span>}<span>{inr(l.area)} sq ft</span><span>{l.type}</span>
        </div>
        <div className="where">{l.title} · {l.locality}, {l.city}</div>
        {l.enquiryCount > 0 && <div className="activity">{l.enquiryCount} {l.enquiryCount === 1 ? "enquiry" : "enquiries"} so far</div>}
        <div className="crow">
          <ValuePill diffPct={l.diffPct} />
          <CompareButton active={comparing} onClick={onToggleCompare} />
        </div>
      </div>
    </article>
  );
}
