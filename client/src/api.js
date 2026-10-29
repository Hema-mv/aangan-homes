export class ApiError extends Error {
  constructor(status, message, fields = {}) { super(message); this.status = status; this.fields = fields; }
}

async function request(path, { method = "GET", body, signal } = {}) {
  let res;
  try {
    res = await fetch("/api" + path, {
      method, signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new ApiError(0, "Can't reach the server. Check that the API is running.");
  }
  // A cancelled request can reject mid-body; re-throw so callers never mistake it for an empty success.
  const data = await res.json().catch((e) => { if (e.name === "AbortError") throw e; return {}; });
  if (!res.ok) {
    const fallback = res.status >= 500 ? "The server isn't responding. Check that the API is running." : `Request failed (${res.status})`;
    throw new ApiError(res.status, data.error ?? fallback, data.fields);
  }
  return data;
}

const qs = (params) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) continue;
    p.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const s = p.toString();
  return s ? "?" + s : "";
};

export const api = {
  cities: () => request("/cities"),
  listings: (filters, signal) => request("/listings" + qs(filters), { signal }).then((r) => r.items),
  listing: (id) => request(`/listings/${encodeURIComponent(id)}`),
  createListing: (body) => request("/listings", { method: "POST", body }),
  createEnquiry: (listingId, body) => request(`/listings/${encodeURIComponent(listingId)}/enquiries`, { method: "POST", body }),
  enquiries: (ids) => (ids.length ? request("/enquiries" + qs({ ids })) : Promise.resolve([])),
};
