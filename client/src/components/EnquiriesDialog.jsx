import { useEffect, useState } from "react";
import Modal, { CloseButton } from "./Modal.jsx";
import { api } from "../api.js";

export default function EnquiriesDialog({ open, onClose, ids }) {
  const [state, setState] = useState({ loading: true, items: [], error: null });

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api.enquiries(ids)
      .then((items) => alive && setState({ loading: false, items, error: null }))
      .catch((e) => alive && setState({ loading: false, items: [], error: e.message }));
    return () => { alive = false; };
  }, [open, ids]);

  return (
    <Modal open={open} onClose={onClose} label="Your enquiries">
      <div className="postdlg">
        <CloseButton onClick={onClose} />
        <h2 className="dtitle">Enquiries</h2>
        <p className="note" style={{ margin: 0 }}>Site-visit requests you've sent from this browser.</p>
        <div className="leads">
          {state.loading ? <div className="note">Loading…</div>
            : state.error ? <div className="err">{state.error}</div>
            : state.items.length === 0 ? <div className="empty">No enquiries yet. Open any listing and use “Request a site visit”.</div>
            : state.items.map((x) => (
              <div className="lead" key={x.id}>
                <b>{x.name} · {x.phone}</b>
                <div className="note">
                  {x.title} — {x.locality}, {x.city} · {x.visit} ·{" "}
                  {new Date(x.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </div>
                {x.message && <div>{x.message}</div>}
              </div>
            ))}
        </div>
      </div>
    </Modal>
  );
}
