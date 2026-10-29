import { useEffect, useState } from "react";

/** useState that persists to localStorage. Storage can be blocked (private mode), so every access is guarded. */
export function useLocalStorage(key, initial) {
  const k = "aangan:" + key;
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(k, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }, [k, value]);
  return [value, setValue];
}
