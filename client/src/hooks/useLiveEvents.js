import { useEffect, useRef, useState } from "react";

/**
 * Subscribes to the server's Server-Sent Events stream.
 * `handlers` maps event names to callbacks; the latest handlers are always used without reconnecting.
 * EventSource reconnects on its own; we just surface the connection state.
 */
export function useLiveEvents(handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  const [status, setStatus] = useState("connecting");
  const [online, setOnline] = useState(0);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource("/api/events");
    es.onopen = () => setStatus("live");
    es.onerror = () => setStatus(es.readyState === EventSource.CLOSED ? "offline" : "connecting");
    es.addEventListener("presence", (e) => setOnline(JSON.parse(e.data).online));
    const names = ["listing:created", "listing:activity"];
    const subs = names.map((name) => {
      const fn = (e) => ref.current[name]?.(JSON.parse(e.data));
      es.addEventListener(name, fn);
      return [name, fn];
    });
    return () => {
      subs.forEach(([n, fn]) => es.removeEventListener(n, fn));
      es.close();
    };
  }, []);

  return { status, online };
}
