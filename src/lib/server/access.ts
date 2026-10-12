import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, ownedProjectTokens, projectAccess, type ProjectAccess } from "@/lib/auth";

/** Projects the current visitor can edit: all for staff, own projects for customers. */
export async function editableProjects() {
  const s = await getSession();
  if (s) return prisma.project.findMany({ orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, name: true, reference: true } });
  const owned = await ownedProjectTokens();
  const ids = Object.keys(owned);
  if (!ids.length) return [];
  const rows = await prisma.project.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, reference: true, ownerToken: true }, orderBy: { updatedAt: "desc" } });
  return rows.filter((r) => r.ownerToken === owned[r.id]).map(({ ownerToken: _t, ...r }) => r);
}

/**
 * Load a project the visitor may see, or 404. Cached per request, so the
 * project layout and its page share one query. BOM headers are trimmed to the
 * fields pages use; the calculation snapshot is loaded only where needed.
 */
export const loadProjectOr404 = cache(async (id: string, need: Exclude<ProjectAccess, "none"> = "read") => {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { designInputs: true, boms: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, currentRevision: true, sourcePackageId: true } } },
  });
  if (!project) notFound();
  const access = await projectAccess(project);
  if (access === "none" || (need === "edit" && access !== "edit")) notFound();
  return { project, access };
});
