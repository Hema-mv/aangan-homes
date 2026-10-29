import { useEffect, useRef, useState } from "react";

const EVENTS = ["listing:created", "listing:activity"];
export const STALE_MS = 60_000;   // server pings every 25 s; two missed pings means the stream is dead
const CHECK_MS = 10_000;

/**
 * Subscribes to the server's Server-Sent Events stream.
 * `handlers` maps event names to callbacks; the latest handlers are always used without reconnecting.
 * `handlers.resync` runs after a reconnect, so the caller can refetch whatever it may have missed.
 *
 * EventSource retries on its own when a connection errors, but a proxy can also leave the browser
 * holding a stream the server has already dropped. A watchdog catches that: no message
 * (including heartbeats) for STALE_MS means close and reconnect.
 */
export function useLiveEvents(handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  const [status, setStatus] = useState("connecting");
  const [online, setOnline] = useState(0);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    let es, lastSeen = Date.now(), opened = 0, disposed = false;

    const seen = () => { lastSeen = Date.now(); };
    function connect() {
      es = new EventSource("/api/events");
      es.onopen = () => {
        seen();
        setStatus("live");
        if (opened++ > 0) ref.current.resync?.(); // a reconnect, not the first connection
      };
      es.onerror = () => setStatus(es.readyState === EventSource.CLOSED ? "offline" : "connecting");
      es.addEventListener("ping", seen);
      es.addEventListener("presence", (e) => { seen(); setOnline(JSON.parse(e.data).online); });
      for (const name of EVENTS) es.addEventListener(name, (e) => { seen(); ref.current[name]?.(JSON.parse(e.data)); });
    }

    connect();
    const watchdog = setInterval(() => {
      if (disposed || Date.now() - lastSeen < STALE_MS) return;
      es.close();
      setStatus("connecting");
      seen(); // give the new connection a full window
      connect();
    }, CHECK_MS);

    return () => { disposed = true; clearInterval(watchdog); es.close(); };
  }, []);

  return { status, online };
}
