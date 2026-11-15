import { describe, it, expect } from "vitest";
import {
  allocate,
  balances,
  transfers,
  newRow,
  people,
  toCents,
  validUrl,
  type Row,
} from "./model";
describe("expense splitting", () => {
  it("allocates every cent exactly once, even when four shares do not divide evenly", () => {
    expect(
      allocate(
        1001,
        people.map((p) => p.id),
      ),
    ).toEqual({ gaba: 251, janek: 250, konrad: 250, julia: 250 });
  });
  it("keeps totals zero and settles the actual debts", () => {
    const dinner = newRow(
      "expense",
      {
        title: "Dinner",
        amount: 180000,
        currency: "COP",
        rate: 4500,
        paidBy: "julia",
        split: ["gaba", "julia"],
      },
      "konrad",
    );
    const taxi = newRow(
      "expense",
      {
        title: "Taxi",
        amount: 45000,
        currency: "COP",
        rate: 4500,
        paidBy: "janek",
        split: people.map((p) => p.id),
      },
      "gaba",
    );
    const balance = balances([dinner, taxi]);
    expect(balance).toEqual({
      gaba: -2250,
      janek: 750,
      konrad: -250,
      julia: 1750,
    });
    expect(Object.values(balance).reduce((a, b) => a + b, 0)).toBe(0);
    const payments = transfers(balance).map((t) =>
      newRow(
        "settlement",
        {
          title: "Payment",
          amount: t.cents / 100,
          rate: 1,
          paidBy: t.from,
          to: t.to,
        },
        "konrad",
      ),
    );
    expect(balances([dinner, taxi, ...payments])).toEqual({
      gaba: 0,
      janek: 0,
      konrad: 0,
      julia: 0,
    });
  });
  it("preserves historical currency rates and excludes removed expenses", () => {
    const row = newRow(
      "expense",
      {
        title: "Dinner",
        amount: 45000,
        rate: 4500,
        paidBy: "konrad",
        split: ["gaba", "konrad"],
      },
      "konrad",
    );
    expect(toCents(row.data)).toBe(1000);
    expect(balances([{ ...row, deleted: true }])).toEqual({
      gaba: 0,
      janek: 0,
      konrad: 0,
      julia: 0,
    });
  });
  it("honors unequal custom shares", () => {
    const row = newRow(
      "expense",
      {
        title: "Different meals",
        amount: 30,
        rate: 1,
        paidBy: "gaba",
        split: ["gaba", "janek"],
        shares: { gaba: 1000, janek: 2000 },
      },
      "gaba",
    );
    expect(balances([row])).toEqual({
      gaba: 2000,
      janek: -2000,
      konrad: 0,
      julia: 0,
    });
  });
  it("rejects an empty split", () => expect(() => allocate(100, [])).toThrow());
  it("handles hundreds of mixed expenses without creating or losing cents", () => {
    const rows: Row[] = Array.from({ length: 301 }, (_, i) =>
      newRow(
        "expense",
        {
          title: "Expense",
          amount: i * 123 + 1,
          rate: 4500,
          paidBy: people[i % 4].id,
          split: people.filter((_, j) => (i + j) % 3 !== 0).map((p) => p.id),
        },
        "konrad",
      ),
    );
    const result = balances(rows);
    expect(Object.values(result).reduce((a, b) => a + b, 0)).toBe(0);
    const paid = transfers(result).map((t) =>
      newRow(
        "settlement",
        {
          title: "Paid",
          amount: t.cents / 100,
          rate: 1,
          paidBy: t.from,
          to: t.to,
        },
        "konrad",
      ),
    );
    expect(Object.values(balances([...rows, ...paid]))).toEqual([0, 0, 0, 0]);
  });
});
describe("external links", () => {
  it("allows web links but never script or data URLs", () => {
    expect(validUrl("javascript:alert(1)")).toBeUndefined();
    expect(validUrl("data:text/html,test")).toBeUndefined();
    expect(validUrl("https://www.airbnb.com/rooms/123")).toBe(
      "https://www.airbnb.com/rooms/123",
    );
  });
});
