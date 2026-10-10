import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { setRemoved } from "@/lib/server/bom";
import { editableBom, handleError, notFound } from "@/lib/server/api";

const schema = z.object({ removed: z.boolean(), reason: z.string().trim().max(500).nullable().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const ctx = await editableBom(id);
  if (!ctx) return notFound();
  try {
    const b = schema.parse(await req.json());
    await setRemoved(prisma, ctx.bom.id, itemId, b.removed, b.reason ?? null, ctx.actor);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
