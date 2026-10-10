import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { projectAccess } from "@/lib/auth";
import { notFound } from "@/lib/server/api";

/** The data a quotation was issued with, so the browser can rebuild its PDF exactly. */
export async function GET(_req: Request, { params }: { params: Promise<{ qid: string }> }) {
  const q = await prisma.quotation.findUnique({ where: { id: (await params).qid }, include: { project: true } });
  if (!q || !q.snapshot || (await projectAccess(q.project)) !== "edit") return notFound();
  return NextResponse.json(q.snapshot, { headers: { "cache-control": "no-store" } });
}
