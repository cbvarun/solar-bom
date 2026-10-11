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
  const { packageCode, ...d } = parsed.data;
  // A package enquiry must name an active package; its capacity fills in when the visitor left it blank.
  let pkg: { id: string; name: string; capacityKwp: Prisma.Decimal } | null = null;
  if (packageCode) {
    pkg = await prisma.standardPackage.findFirst({ where: { code: packageCode, active: true }, select: { id: true, name: true, capacityKwp: true } });
    if (!pkg) return NextResponse.json({ errors: { form: "That package is no longer offered. Please send a general enquiry instead." } }, { status: 422 });
  }
  if (d.projectId && !(await prisma.project.findUnique({ where: { id: d.projectId } }))) {
    return NextResponse.json({ errors: { projectId: "Unknown project" } }, { status: 422 });
  }
  const e = await prisma.enquiry.create({
    data: {
      ...d,
      source: pkg ? "package-quote" : d.source === "package-quote" ? "website" : d.source,
      packageId: pkg?.id ?? null,
      capacityKwp: d.capacityKwp != null ? new Prisma.Decimal(d.capacityKwp) : pkg ? pkg.capacityKwp : null,
    },
  });
  await audit(prisma, ANONYMOUS, { entityType: "Enquiry", entityId: e.id, action: "create", newValue: e.source });
  const delivery = await notifySales({ subject: pkg ? `New enquiry about ${pkg.name} from ${d.name}` : `New ${d.source} from ${d.name}`, text: `${pkg ? `Package: ${pkg.name}\n\n` : ""}${d.message}\n\nEnquiry ID: ${e.id}` });
  return NextResponse.json({ id: e.id, delivery });
}
