import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enquirySchema, fieldErrors } from "@/lib/validation";
import { Prisma } from "@prisma/client";
import { audit, ANONYMOUS } from "@/lib/server/audit";
import { notifySales } from "@/lib/server/notify";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = enquirySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  const d = parsed.data;
  if (d.projectId && !(await prisma.project.findUnique({ where: { id: d.projectId } }))) {
    return NextResponse.json({ errors: { projectId: "Unknown project" } }, { status: 422 });
  }
  const e = await prisma.enquiry.create({
    data: { ...d, capacityKwp: d.capacityKwp == null ? null : new Prisma.Decimal(d.capacityKwp) },
  });
  await audit(prisma, ANONYMOUS, { entityType: "Enquiry", entityId: e.id, action: "create", newValue: d.source });
  const delivery = await notifySales({ subject: `New ${d.source} from ${d.name}`, text: `${d.message}\n\nEnquiry ID: ${e.id}` });
  return NextResponse.json({ id: e.id, delivery });
}
