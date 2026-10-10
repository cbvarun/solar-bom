import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bomItemPatchSchema } from "@/lib/validation";
import { patchItem } from "@/lib/server/bom";
import { editableBom, handleError, notFound } from "@/lib/server/api";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const ctx = await editableBom(id);
  if (!ctx) return notFound();
  try {
    const patch = bomItemPatchSchema.parse(await req.json());
    const item = await patchItem(prisma, ctx.bom.id, itemId, patch, ctx.actor);
    return NextResponse.json({ id: item.id });
  } catch (e) {
    return handleError(e);
  }
}
