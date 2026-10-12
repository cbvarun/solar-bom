import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { changesRow } from "../../row-diff";

describe("changesRow", () => {
  const row = { name: "Module", calculatedQty: new Prisma.Decimal("12.000"), unitPrice: null, removed: false };
  it("treats equal decimals and missing values as unchanged", () => {
    expect(changesRow(row, { name: "Module", calculatedQty: new Prisma.Decimal(12), unitPrice: undefined, removed: false })).toBe(false);
  });
  it("detects a changed quantity, text or flag", () => {
    expect(changesRow(row, { calculatedQty: new Prisma.Decimal("12.5") })).toBe(true);
    expect(changesRow(row, { name: "Module 2" })).toBe(true);
    expect(changesRow(row, { removed: true })).toBe(true);
    expect(changesRow(row, { unitPrice: new Prisma.Decimal(0) })).toBe(true);
  });
});
