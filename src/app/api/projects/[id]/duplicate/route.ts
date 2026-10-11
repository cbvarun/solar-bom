import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActor, projectAccess, rememberOwnedProject } from "@/lib/auth";
import { duplicateProject } from "@/lib/server/projects";
import { createProjectFromPackage } from "@/lib/server/packages";
import { handleError, notFound } from "@/lib/server/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const src = await prisma.project.findUnique({ where: { id }, include: { boms: { orderBy: { createdAt: "asc" }, take: 1 } } });
  if (!src || (await projectAccess(src)) === "none") return notFound();
  try {
    const actor = await getActor();
    // A package-based project is copied from its package, so the copy keeps a package BOM rather than an engine one.
    const pkgId = src.boms[0]?.sourcePackageId;
    const { project, ownerToken } = pkgId
      ? await createProjectFromPackage(prisma, pkgId, { name: `${src.name} (copy)`, location: src.location, customerType: src.customerType, customerName: null, customerEmail: null, customerPhone: null }, actor)
          .then((p) => ({ project: p, ownerToken: p.ownerToken! }))
      : await duplicateProject(prisma, id, actor);
    if (!actor.userId) await rememberOwnedProject(project.id, ownerToken);
    return NextResponse.json({ id: project.id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
