import "server-only";
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

export async function loadProjectOr404(id: string, need: Exclude<ProjectAccess, "none"> = "read") {
  const project = await prisma.project.findUnique({ where: { id }, include: { designInputs: true, boms: { orderBy: { createdAt: "asc" } } } });
  if (!project) notFound();
  const access = await projectAccess(project);
  if (access === "none" || (need === "edit" && access !== "edit")) notFound();
  return { project, access };
}
