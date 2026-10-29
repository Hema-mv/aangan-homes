import { useEffect, useRef } from "react";

/**
 * Uses the Popover API so the toast renders in the top layer, above open <dialog>s.
 * `toast` is { id, text } — a new id re-shows the same text.
 */
export default function Toast({ toast, onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!toast || !el) return;
    try { el.showPopover?.(); } catch { /* already showing */ }
    const t = setTimeout(() => { try { el.hidePopover?.(); } catch { /* noop */ } onDone(); }, 2600);
    return () => clearTimeout(t);
  }, [toast, onDone]);
  return <div ref={ref} className="toast" popover="manual" role="status" aria-live="polite">{toast?.text}</div>;
}
