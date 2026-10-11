import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { handleError, notFound } from "@/lib/server/api";
import { notifySales } from "@/lib/server/notify";
import { clientIp, isExpired, loadSharedQuotation } from "@/lib/server/proposal";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().email("Enter a valid email").max(200),
  note: z.string().trim().max(1000).optional().default(""),
  agree: z.literal(true, { errorMap: () => ({ message: "Tick the box to confirm" }) }),
});

/**
 * Customer accepts the proposal. This records who accepted, when and from
 * where; it is an electronic acceptance record, not a certified digital
 * signature, and starts the site survey rather than finalising the design.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const q = await loadSharedQuotation(token);
  if (!q) return notFound();
  try {
    const b = schema.parse(await req.json());
    if (q.acceptedAt) return NextResponse.json({ error: "This proposal has already been accepted." }, { status: 409 });
    if (isExpired(q)) return NextResponse.json({ error: "This proposal has expired. Please ask us for an updated quotation." }, { status: 409 });
    if (q.status !== "ISSUED") return NextResponse.json({ error: "This proposal can't be accepted online. Please contact us." }, { status: 409 });
    const now = new Date();
    const data = {
      status: "ACCEPTED" as const, acceptedAt: now, acceptedByName: b.name, acceptedByEmail: b.email, acceptanceNote: b.note || null,
      acceptedIp: clientIp(req.headers)?.slice(0, 64) ?? null, acceptedUserAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    };
    const ok = await prisma.$transaction(async (tx) => {
      // Conditional update so two submissions can't both accept.
      const r = await tx.quotation.updateMany({ where: { id: q.id, shareToken: token, acceptedAt: null, status: "ISSUED" }, data });
      if (r.count !== 1) return false;
      await audit(tx, { userId: null, label: `Customer (web proposal): ${b.name} <${b.email}>`, roles: [] }, { entityType: "Quotation", entityId: q.id, action: "accepted", field: "status", oldValue: q.status, newValue: "ACCEPTED", reason: b.note || undefined });
      return true;
    });
    if (!ok) return NextResponse.json({ error: "This proposal has already been accepted or changed. Please reload the page." }, { status: 409 });
    const delivery = await notifySales({ subject: `Proposal ${q.number} accepted by ${b.name}`, text: `${b.name} <${b.email}> accepted ${q.number} on ${now.toISOString()}.\n\n${b.note}` });
    return NextResponse.json({ ok: true, acceptedAt: now.toISOString(), delivery: delivery.message });
  } catch (e) {
    return handleError(e);
  }
}
