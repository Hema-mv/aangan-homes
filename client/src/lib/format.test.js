import { describe, expect, test } from "vitest";
import { buyCosts, emi, money, shortPrice, valueTag, daysAgo } from "./format.js";

describe("money", () => {
  test.each([
    [29500000, "₹2.95 Cr"],
    [10000000, "₹1 Cr"],
    [9800000, "₹98 L"],
    [650000, "₹6.5 L"],
    [38000, "₹38,000"],
    [125000000, "₹12.5 Cr"],
  ])("%d → %s", (n, out) => expect(money(n)).toBe(out));
});

describe("shortPrice", () => {
  test("rent shows thousands", () => expect(shortPrice({ deal: "rent", price: 38000 })).toBe("₹38k"));
  test("sale drops the space", () => expect(shortPrice({ deal: "buy", price: 29500000 })).toBe("₹2.95Cr"));
});

describe("emi", () => {
  test("matches the standard amortisation formula", () => {
    // ₹50 L at 8.5% for 20 years ≈ ₹43,391/month
    expect(Math.round(emi(5_000_000, 8.5, 20))).toBe(43391);
  });
  test("handles a 0% loan", () => expect(emi(120_000, 0, 1)).toBe(10_000));
  test("buyCosts splits down payment and upfront cash", () => {
    const c = buyCosts(10_000_000, { downPct: 20 });
    expect(c.loan).toBe(8_000_000);
    expect(c.downPayment).toBe(2_000_000);
    expect(c.upfront).toBe(2_700_000); // 20% down + 7% stamp duty
  });
});

describe("valueTag", () => {
  test("within 3% is in line", () => expect(valueTag(2.4).kind).toBe("flat"));
  test("below estimate is good", () => expect(valueTag(-12)).toEqual({ kind: "good", label: "▼ 12% below estimate" }));
  test("above estimate is bad", () => expect(valueTag(8).kind).toBe("bad"));
});

test("daysAgo", () => {
  expect(daysAgo(0)).toBe("today");
  expect(daysAgo(1)).toBe("yesterday");
  expect(daysAgo(5)).toBe("5 days ago");
});
