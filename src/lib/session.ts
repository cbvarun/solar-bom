import { SignJWT, jwtVerify } from "jose";

/** Edge-safe session token helpers (used by middleware and server code). */
export const SESSION_COOKIE = "sb_session";
export const STAFF_ROLES = ["ADMIN", "SALES_ENGINEER", "DESIGN_ENGINEER", "PROCUREMENT"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export interface SessionPayload {
  sub: string;
  name: string;
  email: string;
  roles: StaffRole[];
}

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(s);
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ name: p.name, email: p.email, roles: p.roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return { sub: payload.sub as string, name: payload.name as string, email: payload.email as string, roles: (payload.roles as StaffRole[]) ?? [] };
  } catch {
    return null;
  }
}
