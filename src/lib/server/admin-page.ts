import "server-only";
import { requireStaff } from "@/lib/auth";
import { can, type Permission } from "./permissions";

/** Session plus a permission checker for admin pages. Pages are viewable by all staff; edit controls are gated. */
export async function adminCtx() {
  const s = await requireStaff();
  return { session: s, can: (p: Permission) => can(s.roles, p) };
}

/** Prisma Decimal (or null) to number for display and form defaults. */
export const n = (v: { toString(): string } | null | undefined) => (v == null ? null : Number(v));
