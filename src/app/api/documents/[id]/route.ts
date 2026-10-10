import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, projectAccess } from "@/lib/auth";
import { loadFile } from "@/lib/server/storage";

/**
 * Serve a stored document. Product datasheets/certificates and regulatory
 * sources are public; documents attached to a project need access to that project.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.complianceDocument.findUnique({ where: { id }, include: { project: true } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.project) {
    const access = await projectAccess(doc.project);
    if (access === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  } else if (!doc.productId && !doc.standardId && !(await getSession())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!doc.storageKey) {
    if (doc.externalUrl?.startsWith("https://")) return NextResponse.redirect(doc.externalUrl);
    return NextResponse.json({ error: "No file stored" }, { status: 404 });
  }
  const buf = await loadFile(doc.storageKey);
  const name = (doc.fileName ?? "document").replace(/[^\w.\- ]/g, "_");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, max-age=300",
    },
  });
}
