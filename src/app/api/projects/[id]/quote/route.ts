import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getActor, projectAccess } from "@/lib/auth";
import { buildExportData } from "@/lib/server/exports/data";
import { bomPdf } from "@/lib/server/exports/pdf";
import { bomXlsx } from "@/lib/server/exports/xlsx";
import { saveFile } from "@/lib/server/storage";
import { notifySales } from "@/lib/server/notify";
import { audit } from "@/lib/server/audit";
import { handleError, notFound } from "@/lib/server/api";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["request-quote", "email-sales"]),
  contactName: z.string().trim().min(2, "Name is required").max(120),
  contactEmail: z.string().trim().email("Enter a valid email").max(200),
  phone: z.preprocess((v) => (v === "" ? null : v), z.string().trim().regex(/^[0-9+\-\s()]{6,20}$/, "Enter a valid phone number").nullable().optional()),
  message: z.string().trim().max(4000).optional().default(""),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || (await projectAccess(project)) === "none") return notFound();
  try {
    const b = schema.parse(await req.json());
    const actor = await getActor();
    const d = await buildExportData(id);
    const year = new Date().getFullYear();
    const count = await prisma.quotation.count({ where: { number: { startsWith: `Q-${year}-` } } });
    const number = `Q-${year}-${String(count + 1).padStart(4, "0")}`;
    const validUntil = new Date(Date.now() + d.validityDays * 86400_000);
    const pdf = await bomPdf(d, { quotationNumber: number, validUntil });
    const key = await saveFile(pdf, ".pdf", "quotations");
    const q = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.create({
        data: {
          number, projectId: id, bomId: d.bom.id, revisionNo: d.bom.currentRevision, status: "REQUESTED", validUntil,
          totals: { subtotalExGst: d.pricing.subtotalExGst, gst: d.pricing.gstTotal, total: d.pricing.grandTotal, unpricedLines: d.pricing.unpricedLines, untaxedLines: d.pricing.untaxedLines, pricesIncludeGst: d.bom.pricesIncludeGst } as Prisma.InputJsonValue,
          contactName: b.contactName, contactEmail: b.contactEmail, message: b.message, pdfStorageKey: key, createdBy: actor.label,
        },
      });
      await tx.enquiry.create({
        data: { name: b.contactName, email: b.contactEmail, phone: b.phone ?? null, message: b.message || `${b.action === "email-sales" ? "BOM sent to sales" : "Quote requested"} for ${project.reference}`, source: "quote-request", projectId: id,
          capacityKwp: d.project.designInputs?.targetCapacityKwp ?? null, location: project.location, customerType: project.customerType },
      });
      await audit(tx, actor, { entityType: "Quotation", entityId: q.id, action: b.action, newValue: number });
      return q;
    });
    const delivery = await notifySales({
      subject: `${b.action === "email-sales" ? "BOM" : "Quote request"} ${number} — ${project.reference} ${project.name}`,
      text: `${b.contactName} <${b.contactEmail}>\n\n${b.message}`,
      attachments: [{ filename: `${number}.pdf`, content: pdf }, { filename: `${project.reference}-BOM.xlsx`, content: await bomXlsx(d) }],
    });
    return NextResponse.json({ number: q.number, quotationId: q.id, delivery });
  } catch (e) {
    return handleError(e);
  }
}
