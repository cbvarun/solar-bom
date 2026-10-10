import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { submitForReview } from "@/lib/server/bom";
import { editableBom, handleError, notFound } from "@/lib/server/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await editableBom((await params).id);
  if (!ctx) return notFound();
  try {
    await submitForReview(prisma, ctx.bom.id, ctx.actor);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
