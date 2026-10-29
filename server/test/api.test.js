import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.js";
import { createApp } from "../src/app.js";

let server, base, live;

before(async () => {
  const built = createApp({ db: openDb(":memory:"), limitWrites: false });
  live = built.live;
  server = built.app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => { live.closeAll(); server.close(); });

const get = (path) => fetch(base + path).then(async (r) => ({ status: r.status, body: await r.json() }));
const post = (path, data) => fetch(base + path, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
}).then(async (r) => ({ status: r.status, body: await r.json() }));

const validListing = {
  deal: "buy", city: "Pune", locality: "Baner", type: "Apartment", bhk: 2, area: 1000, price: 11500000,
  title: "Test 2BHK near Balewadi", possession: "Ready to move", agent: "Test Agent", phone: "98765 43210",
};

describe("GET /api/cities", () => {
  test("returns cities with localities and rates", async () => {
    const { status, body } = await get("/cities");
    assert.equal(status, 200);
    assert.equal(body.length, 5);
    const chennai = body.find((c) => c.name === "Chennai");
    assert.equal(chennai.depositMonths, 3);
    assert.ok(chennai.localities.some((l) => l.name === "Adyar" && l.saleRate === 17000));
  });
});

describe("GET /api/listings", () => {
  test("filters by deal and city", async () => {
    const { body } = await get("/listings?deal=buy&city=Chennai");
    assert.ok(body.count > 0);
    assert.ok(body.items.every((l) => l.deal === "buy" && l.city === "Chennai"));
  });

  test("filters by BHK including 4+", async () => {
    const { body } = await get("/listings?deal=buy&city=Chennai&bhk=4%2B");
    assert.ok(body.items.length > 0);
    assert.ok(body.items.every((l) => l.bhk >= 4));
  });

  test("sorts by price low to high", async () => {
    const { body } = await get("/listings?deal=buy&city=Bengaluru&sort=lo");
    const prices = body.items.map((l) => l.price);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  });

  test("searches title and locality, treating % and _ literally", async () => {
    assert.ok((await get("/listings?q=velachery")).body.count === 1);
    assert.equal((await get("/listings?q=%25")).body.count, 0);
  });

  test("fetches specific ids for compare", async () => {
    const { body } = await get("/listings?ids=s1,s8,s14");
    assert.deepEqual(body.items.map((l) => l.id).sort(), ["s1", "s14", "s8"]);
  });

  test("computes the locality estimate", async () => {
    const { body } = await get("/listings/s1"); // Adyar 1650 sq ft @ ₹17,000
    assert.equal(body.estimate, 1650 * 17000);
    assert.equal(body.phone, null, "sample listings never expose a phone number");
  });

  test("rejects invalid query values", async () => {
    const { status, body } = await get("/listings?sort=random&deal=lease");
    assert.equal(status, 400);
    assert.ok(body.fields.sort && body.fields.deal);
  });

  test("404s on an unknown listing", async () => {
    assert.equal((await get("/listings/nope")).status, 404);
  });
});

describe("POST /api/listings", () => {
  test("creates a listing and normalises the phone number", async () => {
    const { status, body } = await post("/listings", validListing);
    assert.equal(status, 201);
    assert.match(body.id, /^l_/);
    assert.equal(body.phone, "+91 98765 43210");
    assert.equal(body.isSample, false);
    assert.equal((await get(`/listings/${body.id}`)).body.title, validListing.title);
  });

  test("forces bhk to 0 for plots", async () => {
    const { body } = await post("/listings", { ...validListing, type: "Plot", bhk: 3 });
    assert.equal(body.bhk, 0);
  });

  test("returns field errors for bad input", async () => {
    const { status, body } = await post("/listings", { ...validListing, phone: "12345", title: "Hi", price: -5 });
    assert.equal(status, 400);
    assert.deepEqual(Object.keys(body.fields).sort(), ["phone", "price", "title"]);
  });

  test("rejects a locality that doesn't belong to the city", async () => {
    const { status, body } = await post("/listings", { ...validListing, locality: "Adyar" });
    assert.equal(status, 400);
    assert.ok(body.fields.locality);
  });

  test("stores text as-is (escaping is the renderer's job)", async () => {
    const title = `<img src=x onerror=alert(1)>`;
    const { body } = await post("/listings", { ...validListing, title });
    assert.equal(body.title, title);
  });

  test("rejects malformed JSON", async () => {
    const r = await fetch(base + "/listings", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{oops" });
    assert.equal(r.status, 400);
  });
});

describe("enquiries", () => {
  test("creates an enquiry, bumps the count, and is readable only by id", async () => {
    const { status, body } = await post("/listings/s2/enquiries", { name: "Asha", phone: "+91 91234 56789", visit: "This weekend", message: "Still available?" });
    assert.equal(status, 201);
    assert.match(body.id, /^[0-9a-f-]{36}$/);
    assert.equal((await get("/listings/s2")).body.enquiryCount, 1);

    const mine = await get(`/enquiries?ids=${body.id}`);
    assert.equal(mine.body.length, 1);
    assert.equal(mine.body[0].title, "2BHK near Phoenix Marketcity");
    assert.deepEqual((await get("/enquiries")).body, [], "no ids, no data");
  });

  test("validates enquiry input", async () => {
    const { status, body } = await post("/listings/s2/enquiries", { name: "", phone: "555", visit: "Tomorrow" });
    assert.equal(status, 400);
    assert.ok(body.fields.name && body.fields.phone && body.fields.visit);
  });
});

describe("GET /api/events (live updates)", () => {
  test("streams presence and new listings to connected clients", async () => {
    const ctrl = new AbortController();
    const res = await fetch(base + "/events", { signal: ctrl.signal });
    assert.equal(res.headers.get("content-type"), "text/event-stream");
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const waitFor = async (event) => {
      while (!buf.includes(`event: ${event}`)) {
        const { value, done } = await reader.read();
        if (done) throw new Error("stream ended");
        buf += dec.decode(value);
      }
      const chunk = buf.slice(buf.indexOf(`event: ${event}`));
      return JSON.parse(chunk.split("\n")[1].slice("data: ".length));
    };

    assert.ok((await waitFor("presence")).online >= 1);
    await post("/listings", { ...validListing, title: "Live listing broadcast" });
    assert.equal((await waitFor("listing:created")).title, "Live listing broadcast");
    ctrl.abort();
  });
});
