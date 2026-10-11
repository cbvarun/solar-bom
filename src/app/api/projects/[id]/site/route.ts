import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActor, projectAccess } from "@/lib/auth";
import { siteSchema } from "@/lib/validation";
import { saveSite } from "@/lib/server/site-save";
import { handleError, notFound } from "@/lib/server/api";

/** Save the site location, roof outline and savings inputs. Changing anything the yield depends on clears the old estimate. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || (await projectAccess(project)) !== "edit") return notFound();
  try {
    const r = await saveSite(id, siteSchema.parse(await req.json()), await getActor());
    return NextResponse.json({ ok: true, roofOutlineAreaM2: r.area, yieldCleared: r.yieldCleared, regenerated: r.regenerated });
  } catch (e) {
    return handleError(e);
  }
}
