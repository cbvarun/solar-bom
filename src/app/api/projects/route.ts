import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fieldErrors, projectSchema } from "@/lib/validation";
import { getActor, hasRole, rememberOwnedProject } from "@/lib/auth";
import { createProject } from "@/lib/server/projects";
import { sanitizeProvenance } from "@/lib/server/guards";

export async function POST(req: Request) {
  const parsed = projectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  const actor = await getActor();
  const data = sanitizeProvenance(parsed.data, hasRole(actor, "DESIGN_ENGINEER"));
  const { project, ownerToken } = await createProject(prisma, data, actor);
  if (!actor.userId) await rememberOwnedProject(project.id, ownerToken);
  return NextResponse.json({ id: project.id, reference: project.reference }, { status: 201 });
}
