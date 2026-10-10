import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { reviewRevision } from "@/lib/server/bom";
import { handleError } from "@/lib/server/api";

const schema = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), notes: z.string().trim().max(1000).nullable().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ revId: string }> }) {
  const actor = await getActor();
  if (!actor.userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const b = schema.parse(await req.json());
    if (b.decision === "REJECTED" && !b.notes) return NextResponse.json({ errors: { notes: "Give a reason for rejecting" } }, { status: 422 });
    await reviewRevision(prisma, (await params).revId, b.decision, b.notes ?? null, actor);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
