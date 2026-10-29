import HouseArt from "./HouseArt.jsx";
import { MAX_COMPARE } from "../lib/compare.js";
import { shortPrice } from "../lib/format.js";

export default function CompareTray({ items, onRemove, onCompare, onClear }) {
  if (!items.length) return null;
  return (
    <div className="tray" role="region" aria-label="Homes to compare">
      <div className="slots">
        {Array.from({ length: MAX_COMPARE }, (_, i) => {
          const l = items[i];
          if (!l) return <div className="slot open" key={"open" + i}>+ Add home</div>;
          return (
            <div className="slot" key={l.id}>
              <div className="mini"><HouseArt listing={l} /></div>
              <div className="t"><b>{shortPrice(l)}</b><span>{l.locality}</span></div>
              <button className="rm" type="button" aria-label={`Remove ${l.title} from compare`} onClick={() => onRemove(l)}>×</button>
            </div>
          );
        })}
      </div>
      <div className="acts">
        <button className="btn" type="button" disabled={items.length < 2} onClick={onCompare}>Compare {items.length}</button>
        <button className="linkbtn" type="button" onClick={onClear}>Clear</button>
      </div>
    </div>
  );
}
