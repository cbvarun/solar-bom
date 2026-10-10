import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySession, type SessionPayload, type StaffRole } from "./session";
import { ANONYMOUS, type Actor } from "./server/audit";

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const s = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  // Re-check the account is still active and roles are current.
  const user = await prisma.user.findUnique({ where: { id: s.sub }, include: { roles: { include: { role: true } } } });
  if (!user || !user.active) return null;
  return { ...s, roles: user.roles.map((r) => r.role.code as StaffRole) };
}

export async function getActor(): Promise<Actor> {
  const s = await getSession();
  if (!s) return ANONYMOUS;
  return { userId: s.sub, label: `${s.name} (${s.roles.join(", ")})`, roles: s.roles };
}

export function hasRole(s: { roles: string[] } | null, ...roles: StaffRole[]): boolean {
  if (!s) return false;
  return s.roles.includes("ADMIN") || roles.some((r) => s.roles.includes(r));
}

export async function requireStaff(...roles: StaffRole[]): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (roles.length && !hasRole(s, ...roles)) redirect("/admin?denied=1");
  return s;
}

// ---- Anonymous project ownership ----
const OWNER_COOKIE = "sb_projects";

export async function ownedProjectTokens(): Promise<Record<string, string>> {
  const jar = await cookies();
  try {
    const v = JSON.parse(jar.get(OWNER_COOKIE)?.value ?? "{}");
    return typeof v === "object" && v ? v : {};
  } catch {
    return {};
  }
}

export async function rememberOwnedProject(projectId: string, token: string) {
  const jar = await cookies();
  const cur = await ownedProjectTokens();
  cur[projectId] = token;
  // Keep the cookie bounded.
  const entries = Object.entries(cur).slice(-30);
  jar.set(OWNER_COOKIE, JSON.stringify(Object.fromEntries(entries)), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180 });
}

export type ProjectAccess = "none" | "read" | "edit";

/** Staff can edit any project; creators can edit theirs; the shared sample is read-only for the public. */
export async function projectAccess(project: { id: string; ownerToken: string | null; isSample: boolean }): Promise<ProjectAccess> {
  const s = await getSession();
  if (s) return "edit";
  const owned = await ownedProjectTokens();
  if (project.ownerToken && owned[project.id] === project.ownerToken) return "edit";
  if (project.isSample) return "read";
  return "none";
}
