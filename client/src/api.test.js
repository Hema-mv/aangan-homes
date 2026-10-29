import { afterEach, describe, expect, test, vi } from "vitest";
import { api, ApiError } from "./api.js";

const abortError = () => Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
const response = (status, body) => ({ ok: status < 400, status, json: () => (body instanceof Error ? Promise.reject(body) : Promise.resolve(body)) });

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  test("builds the query string, skipping empty filters", async () => {
    const fetch = vi.fn().mockResolvedValue(response(200, { items: [] }));
    vi.stubGlobal("fetch", fetch);
    await api.listings({ deal: "buy", city: "Pune", q: "", bhk: ["2", "4+"], maxPrice: "", ids: [] });
    expect(fetch.mock.calls[0][0]).toBe("/api/listings?deal=buy&city=Pune&bhk=2%2C4%2B");
  });

  // Regression: a search cancelled while its body was still streaming used to resolve
  // with `undefined` items and blank the page.
  test("a request aborted mid-body rejects instead of resolving empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, abortError())));
    await expect(api.listings({})).rejects.toMatchObject({ name: "AbortError" });
  });

  test("surfaces field errors from a 400", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(400, { error: "Validation failed", fields: { phone: "bad" } })));
    const err = await api.createListing({}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.fields).toEqual({ phone: "bad" });
  });

  test("explains a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api.cities()).rejects.toThrow(/Can't reach the server/);
  });
});
