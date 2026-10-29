// Live updates over Server-Sent Events: one long-lived GET per browser tab,
// the server pushes JSON events (new listings, enquiry counts, how many people are online).
export function createLiveHub({ heartbeatMs = 25_000 } = {}) {
  const clients = new Set();

  const send = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const broadcast = (event, data) => { for (const res of clients) send(res, event, data); };
  const presence = () => broadcast("presence", { online: clients.size });

  function handler(req, res) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // stop nginx-style proxies from buffering the stream
    });
    res.write("retry: 3000\n\n");
    clients.add(res);
    presence();
    const beat = setInterval(() => res.write(": ping\n\n"), heartbeatMs);
    req.on("close", () => {
      clearInterval(beat);
      clients.delete(res);
      presence();
    });
  }

  function closeAll() {
    for (const res of clients) res.end();
    clients.clear();
  }

  return { handler, broadcast, closeAll, get size() { return clients.size; } };
}
