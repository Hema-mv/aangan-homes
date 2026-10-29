import { describe, expect, test } from "vitest";
import { canAddToCompare, compareRows, distinctAmenities } from "./compare.js";

const home = (id, over = {}) => ({
  id, deal: "buy", city: "Pune", locality: "Baner", type: "Apartment", bhk: 2, bath: 2, area: 1000, price: 10_000_000,
  diffPct: 0, floor: "3 of 10", facing: "East", furnishing: "Unfurnished", possession: "Ready to move", age: "2 yrs",
  daysListed: 1, enquiryCount: 0, amenities: ["Lift", "Gym"], ...over,
});

describe("canAddToCompare", () => {
  test("allows the first home", () => expect(canAddToCompare([], home("a"))).toBeNull());
  test("blocks mixing sale and rent", () => {
    expect(canAddToCompare([home("a")], home("b", { deal: "rent" }))).toMatch(/homes for sale together/);
  });
  test("caps at three", () => {
    expect(canAddToCompare([home("a"), home("b"), home("c")], home("d"))).toMatch(/up to 3/);
  });
});

describe("compareRows", () => {
  const items = [home("a", { price: 9_000_000, area: 900, diffPct: -10 }), home("b", { price: 12_000_000, area: 1400, diffPct: 4 })];
  const rows = Object.fromEntries(compareRows(items).map((r) => [r.key, r]));

  test("marks the cheaper home best on price and the bigger one best on area", () => {
    expect(rows.price.best).toEqual([true, false]);
    expect(rows.area.best).toEqual([false, true]);
    expect(rows.value.best).toEqual([true, false]);
  });

  test("flags rows where every value is identical", () => {
    expect(rows.type.same).toBe(true);
    expect(rows.price.same).toBe(false);
  });

  test("no 'best' when values tie", () => {
    const tie = compareRows([home("a"), home("b")]);
    expect(tie.find((r) => r.key === "price").best).toEqual([false, false]);
  });

  test("rentals get deposit and move-in rows instead of EMI", () => {
    const keys = compareRows([home("a", { deal: "rent", price: 40_000 })], [{ name: "Pune", depositMonths: 3 }]).map((r) => r.key);
    expect(keys).toContain("movein");
    expect(keys).not.toContain("emi");
  });
});

test("distinctAmenities lists only amenities not shared by all", () => {
  const d = distinctAmenities([home("a", { amenities: ["Lift", "Pool"] }), home("b", { amenities: ["Lift"] })]);
  expect([...d]).toEqual(["Pool"]);
});
