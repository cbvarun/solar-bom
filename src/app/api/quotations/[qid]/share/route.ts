import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/server/permissions";
import { audit } from "@/lib/server/audit";
import { handleError, notFound } from "@/lib/server/api";
import { newShareToken } from "@/lib/server/proposal";

const schema = z.object({ action: z.enum(["share", "revoke"]) });

/**
 * Staff issue a quotation to the customer as a web proposal link, or revoke
 * the link. Sharing a requested quotation marks it issued.
 */
export async function POST(req: Request, { params }: { params: Promise<{ qid: string }> }) {
  const actor = await getActor();
  if (!can(actor.roles, "quotations.share")) return NextResponse.json({ error: "You don't have permission to share quotations." }, { status: 403 });
  const q = await prisma.quotation.findUnique({ where: { id: (await params).qid } });
  if (!q) return notFound();
  try {
    const { action } = schema.parse(await req.json());
    if (action === "revoke") {
      if (q.acceptedAt) return NextResponse.json({ error: "This quotation was accepted; its link stays available as the customer's record." }, { status: 409 });
      await prisma.$transaction(async (tx) => {
        await tx.quotation.update({ where: { id: q.id }, data: { shareToken: null } });
        await audit(tx, actor, { entityType: "Quotation", entityId: q.id, action: "share-revoked", oldValue: q.number });
      });
      return NextResponse.json({ shareToken: null });
    }
    if (!q.snapshot) return NextResponse.json({ error: "This quotation predates web proposals. Create a new quotation to share it online." }, { status: 409 });
    if (q.status === "CANCELLED" || q.status === "EXPIRED") return NextResponse.json({ error: `A ${q.status.toLowerCase()} quotation can't be shared.` }, { status: 409 });
    if (q.shareToken) return NextResponse.json({ shareToken: q.shareToken });
    const token = newShareToken();
    const status = q.status === "DRAFT" || q.status === "REQUESTED" ? "ISSUED" : q.status;
    await prisma.$transaction(async (tx) => {
      await tx.quotation.update({ where: { id: q.id }, data: { shareToken: token, sharedAt: new Date(), status } });
      await audit(tx, actor, { entityType: "Quotation", entityId: q.id, action: "shared", field: "status", oldValue: q.status, newValue: status });
    });
    return NextResponse.json({ shareToken: token });
  } catch (e) {
    return handleError(e);
  }
}
