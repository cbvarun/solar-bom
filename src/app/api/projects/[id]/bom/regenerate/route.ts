import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateAndSaveBom } from "@/lib/server/projects";
import { editableBom, handleError, notFound } from "@/lib/server/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await editableBom(id);
  if (!ctx) return notFound();
  try {
    const r = await generateAndSaveBom(prisma, id, ctx.actor, "Recalculated with current catalogue and rules");
    return NextResponse.json({ revisionNo: r.revisionNo });
  } catch (e) {
    return handleError(e);
  }
}
