import "server-only";
import { prisma } from "@/lib/db";

/** 192-bit random, URL-safe. Uses Web Crypto so it works on Workers and Node. */
export function newShareToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

/** A quotation the customer may view by link. Revoked links (token cleared) and cancelled quotations are not found. */
export async function loadSharedQuotation(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const q = await prisma.quotation.findUnique({ where: { shareToken: token } });
  if (!q || q.status === "CANCELLED" || !q.snapshot) return null;
  return q;
}

export function isExpired(q: { validUntil: Date | null; acceptedAt: Date | null }, now = new Date()) {
  return !q.acceptedAt && q.validUntil != null && q.validUntil.getTime() < now.getTime();
}

/** Best-effort client address: Cloudflare sets cf-connecting-ip; elsewhere the first x-forwarded-for hop. */
export function clientIp(h: Headers): string | null {
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}
