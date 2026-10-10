import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { setCostItems } from "@/lib/server/bom";
import { editableBom, handleError, notFound } from "@/lib/server/api";

const n = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).max(1e10).nullable());
const schema = z.object({
  pricesIncludeGst: z.boolean(),
  items: z.array(z.object({ label: z.string().trim().min(1, "Label required").max(120), amount: n, gstRatePercent: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).max(100).nullable()), notes: z.string().max(300).nullable().optional() })).max(30),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await editableBom((await params).id);
  if (!ctx) return notFound();
  try {
    const b = schema.parse(await req.json());
    await setCostItems(prisma, ctx.bom.id, b.items, b.pricesIncludeGst, ctx.actor);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
