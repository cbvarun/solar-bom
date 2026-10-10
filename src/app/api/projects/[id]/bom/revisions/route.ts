import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { saveRevision } from "@/lib/server/bom";
import { editableBom, handleError, notFound } from "@/lib/server/api";

const schema = z.object({ summary: z.string().trim().min(3, "Describe the change").max(500) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await editableBom((await params).id);
  if (!ctx) return notFound();
  try {
    const { summary } = schema.parse(await req.json());
    const rev = await saveRevision(prisma, ctx.bom.id, summary, ctx.actor);
    return NextResponse.json({ revisionNo: rev.revisionNo });
  } catch (e) {
    return handleError(e);
  }
}
