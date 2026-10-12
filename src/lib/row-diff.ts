import { Prisma } from "@prisma/client";

/** Normalise a column value so a stored row and an update payload compare equal when they hold the same value. */
const norm = (v: unknown) => (v instanceof Prisma.Decimal ? Number(v.toString()) : v instanceof Date ? v.toISOString() : v === undefined ? null : v);

/** True when applying `data` would change `row`. Used to skip writes that would change nothing. */
export function changesRow(row: Record<string, unknown>, data: Record<string, unknown>) {
  return Object.entries(data).some(([k, v]) => norm(row[k]) !== norm(v));
}
