import { useEffect, useRef } from "react";

/** Native <dialog> wrapper: focus trapping, Esc to close and the backdrop come from the browser. */
export default function Modal({ open, onClose, className = "", label, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={className}
      aria-label={label}
      onClose={() => open && onClose()}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {open && children}
    </dialog>
  );
}

export function CloseButton({ onClick, className = "" }) {
  return <button className={"x " + className} type="button" onClick={onClick} aria-label="Close">×</button>;
}
