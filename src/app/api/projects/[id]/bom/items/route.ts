import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bomItemCreateSchema } from "@/lib/validation";
import { addItem } from "@/lib/server/bom";
import { editableBom, handleError, notFound } from "@/lib/server/api";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await editableBom((await params).id);
  if (!ctx) return notFound();
  try {
    const body = await req.json();
    if (body.productId && !body.name) {
      const p = await prisma.product.findUnique({ where: { id: String(body.productId) }, include: { category: true } });
      if (p) Object.assign(body, { name: p.name, unit: p.unit, section: body.section ?? p.category.bomSection ?? "CABLE_MGMT" });
    }
    const input = bomItemCreateSchema.parse(body);
    const item = await addItem(prisma, ctx.bom.id, input, ctx.actor);
    return NextResponse.json({ id: item.id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
