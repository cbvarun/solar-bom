import { NextResponse } from "next/server";
import { loadSharedQuotation } from "@/lib/server/proposal";
import { notFound } from "@/lib/server/api";

/** Snapshot for the customer's PDF download from the web proposal. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const q = await loadSharedQuotation((await params).token);
  if (!q) return notFound();
  return NextResponse.json(q.snapshot, { headers: { "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" } });
}
