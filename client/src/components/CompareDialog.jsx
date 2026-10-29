import { useMemo } from "react";
import Modal, { CloseButton } from "./Modal.jsx";
import HouseArt from "./HouseArt.jsx";
import ValuePill from "./ValuePill.jsx";
import { useLocalStorage } from "../hooks/useLocalStorage.js";
import { compareRows, distinctAmenities } from "../lib/compare.js";
import { STAMP_DUTY_PCT } from "../lib/format.js";

export default function CompareDialog({ open, onClose, items, cities, onRemove, onOpen }) {
  const [diffOnly, setDiffOnly] = useLocalStorage("compareDiffOnly", false);
  const rows = useMemo(() => compareRows(items, cities ?? []), [items, cities]);
  const uniq = useMemo(() => distinctAmenities(items), [items]);
  const buy = items[0]?.deal !== "rent";

  return (
    <Modal open={open && items.length > 0} onClose={onClose} className="wide" label="Compare homes">
      <div className="cmpdlg">
        <CloseButton onClick={onClose} />
        <div className="cmphead">
          <h2 className="dtitle">Compare homes</h2>
          <label><input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} /> Show differences only</label>
        </div>
        <div className="cmpscroll">
          <table className={"cmpt" + (diffOnly ? " diffonly" : "")} style={{ "--n": items.length }}>
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Home</span></th>
                {items.map((l) => (
                  <td key={l.id}>
                    <div className="cmpart"><HouseArt listing={l} /></div>
                    <b className="ct">{l.title}</b>
                    <div className="note">{l.locality}, {l.city}</div>
                    <div className="cacts">
                      <button className="btn ghost sm" type="button" onClick={() => onOpen(l)}>Details</button>
                      <button className="linkbtn" type="button" onClick={() => onRemove(l)}>Remove</button>
                    </div>
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={r.same ? "same" : undefined}>
                  <th scope="row">{r.label}</th>
                  {items.map((l, i) => (
                    <td key={l.id} className={r.best[i] ? "best" : undefined}>
                      {r.kind === "pill" ? <ValuePill diffPct={l.diffPct} />
                        : r.kind === "amenities" ? (
                          l.amenities.length
                            ? <div className="amen">{l.amenities.map((a) => <span key={a} className={uniq.has(a) ? "uniq" : undefined}>{a}</span>)}</div>
                            : "—")
                        : r.texts[i]}
                      {r.best[i] && <span className="bestb">Best</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cmpfoot">
          <span><i style={{ background: "var(--good-soft)" }} />Best in row</span>
          <span><i style={{ background: "var(--accent-soft)" }} />Amenity not in every home</span>
          <span>{buy ? `EMI assumes 20% down, 8.5% for 20 years; upfront adds ~${STAMP_DUTY_PCT}% stamp duty.` : "Move-in cost is first month's rent plus deposit."}</span>
        </div>
      </div>
    </Modal>
  );
}
