import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActor, projectAccess, rememberOwnedProject } from "@/lib/auth";
import { duplicateProject } from "@/lib/server/projects";
import { handleError, notFound } from "@/lib/server/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const src = await prisma.project.findUnique({ where: { id } });
  if (!src || (await projectAccess(src)) === "none") return notFound();
  try {
    const actor = await getActor();
    const { project, ownerToken } = await duplicateProject(prisma, id, actor);
    if (!actor.userId) await rememberOwnedProject(project.id, ownerToken);
    return NextResponse.json({ id: project.id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
