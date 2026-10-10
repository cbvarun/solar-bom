import "server-only";
import { getSession } from "@/lib/auth";
import type { Actor } from "./audit";
import { can, type Permission } from "./permissions";

export class Forbidden extends Error {}

/** For server actions: returns the acting staff member or throws. */
export async function requirePermission(p: Permission): Promise<Actor> {
  const s = await getSession();
  if (!s) throw new Forbidden("Sign in required");
  if (!can(s.roles, p)) throw new Forbidden("Your role does not allow this action");
  return { userId: s.sub, label: `${s.name} (${s.roles.join(", ")})`, roles: s.roles };
}

export type ActionResult = { ok: boolean; message?: string; errors?: Record<string, string> };

export async function guarded(p: Permission, fn: (actor: Actor) => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    const actor = await requirePermission(p);
    return (await fn(actor)) ?? { ok: true, message: "Saved." };
  } catch (e) {
    if (e instanceof Forbidden) return { ok: false, message: e.message };
    const { ZodError } = await import("zod");
    if (e instanceof ZodError) {
      const errors: Record<string, string> = {};
      for (const i of e.issues) errors[i.path.join(".")] ??= i.message;
      return { ok: false, message: "Please correct the highlighted fields.", errors };
    }
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") return { ok: false, message: "A record with this unique value already exists." };
    console.error(e);
    return { ok: false, message: e instanceof Error ? e.message : "Unexpected error" };
  }
}
