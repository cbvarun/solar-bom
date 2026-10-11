import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/server/permissions";
import { handleError, notFound } from "@/lib/server/api";
import { createProjectFromPackage } from "@/lib/server/packages";

const opt = (max: number) => z.preprocess((v) => (v === "" || v == null ? null : String(v).trim()), z.string().max(max).nullable());
const schema = z.object({
  name: z.string().trim().min(2, "Project name is required").max(200),
  location: opt(200),
  customerType: z.preprocess((v) => (v === "" ? null : v), z.enum(["RESIDENTIAL", "APARTMENT", "COMMERCIAL", "INDUSTRIAL"]).nullable()),
  customerName: opt(120),
  customerEmail: z.preprocess((v) => (v === "" || v == null ? null : String(v).trim()), z.string().email("Enter a valid email").max(200).nullable()),
  customerPhone: z.preprocess((v) => (v === "" || v == null ? null : String(v).trim()), z.string().regex(/^[0-9+\-\s()]{6,20}$/, "Enter a valid phone number").nullable()),
  enquiryId: opt(64).optional(),
});

/** Staff start a project whose BOM is a copy of a standard package. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!can(actor.roles, "packages.use")) return NextResponse.json({ error: "Your role can't create projects from packages." }, { status: 403 });
  const pkg = await prisma.standardPackage.findUnique({ where: { id: (await params).id } });
  if (!pkg) return notFound();
  if (!pkg.active) return NextResponse.json({ error: "This package is inactive." }, { status: 409 });
  try {
    const p = await createProjectFromPackage(prisma, pkg.id, schema.parse(await req.json()), actor);
    return NextResponse.json({ projectId: p.id, reference: p.reference });
  } catch (e) {
    return handleError(e);
  }
}
