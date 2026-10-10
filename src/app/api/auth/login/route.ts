import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, signSession, type StaffRole } from "@/lib/session";
import { audit } from "@/lib/server/audit";

const schema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

// Simple in-memory throttle per email (sufficient for a single instance; use a shared store in production).
const attempts = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your email and password." }, { status: 422 });
  const email = parsed.data.email.toLowerCase();
  const a = attempts.get(email);
  if (a && a.n >= 5 && a.until > Date.now()) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });

  const user = await prisma.user.findUnique({ where: { email }, include: { roles: { include: { role: true } } } });
  const ok = user && user.active && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!ok || !user) {
    attempts.set(email, { n: (a?.n ?? 0) + 1, until: Date.now() + 5 * 60_000 });
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }
  attempts.delete(email);
  const token = await signSession({ sub: user.id, name: user.name, email: user.email, roles: user.roles.map((r) => r.role.code as StaffRole) });
  await audit(prisma, { userId: user.id, label: user.name, roles: [] }, { entityType: "User", entityId: user.id, action: "login" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 3600 });
  return res;
}
