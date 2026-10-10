import { prisma } from "@/lib/db";
import { projectAccess } from "@/lib/auth";
import { loadFile } from "@/lib/server/storage";
import { notFound } from "@/lib/server/api";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ qid: string }> }) {
  const q = await prisma.quotation.findUnique({ where: { id: (await params).qid }, include: { project: true } });
  if (!q || !q.pdfStorageKey || (await projectAccess(q.project)) !== "edit") return notFound();
  const buf = await loadFile(q.pdfStorageKey);
  return new Response(new Uint8Array(buf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${q.number}.pdf"`, "cache-control": "no-store" } });
}
