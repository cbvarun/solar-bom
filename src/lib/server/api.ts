import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { getActor, projectAccess } from "@/lib/auth";
import { fieldErrors } from "@/lib/validation";
import { BomError } from "./bom";

/** Resolve a project the caller may edit, plus its BOM and the acting user. */
export async function editableBom(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || (await projectAccess(project)) !== "edit") return null;
  const bom = await prisma.bOMHeader.findFirst({ where: { projectId }, orderBy: { createdAt: "asc" } });
  if (!bom) return null;
  return { project, bom, actor: await getActor() };
}

export function handleError(e: unknown) {
  if (e instanceof BomError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ errors: fieldErrors(e) }, { status: 422 });
  console.error(e);
  return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
}

export const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
