import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { projectAccess } from "@/lib/auth";
import { buildExportPayload } from "@/lib/server/exports/data";
import { notFound } from "@/lib/server/api";

/** Data for PDF, XLSX and CSV exports; the browser builds the files. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || (await projectAccess(project)) === "none") return notFound();
  return NextResponse.json(await buildExportPayload(id), { headers: { "cache-control": "no-store" } });
}
