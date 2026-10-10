import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fieldErrors, projectSchema } from "@/lib/validation";
import { getActor, hasRole, projectAccess } from "@/lib/auth";
import { updateProject } from "@/lib/server/projects";
import { sanitizeProvenance } from "@/lib/server/guards";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || (await projectAccess(project)) !== "edit") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = projectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  const actor = await getActor();
  await updateProject(prisma, id, sanitizeProvenance(parsed.data, hasRole(actor, "DESIGN_ENGINEER")), actor);
  return NextResponse.json({ id });
}
