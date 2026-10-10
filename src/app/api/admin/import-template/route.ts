import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { IMPORT_COLUMNS } from "@/lib/server/import";

/** Blank CSV template for bulk product import (header row plus one commented example). */
export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const headers = [...IMPORT_COLUMNS, "spec:pmax_w[W]", "spec:voc_v[V]", "spec:bom_role"];
  const example = ["EXAMPLE-SKU-1", "Example module (replace)", "MODEL-X", "pv-modules", "Sample Manufacturer A (illustrative)", "nos", "", "UNKNOWN", "", "", "", "", "", "", "", "", "ILLUSTRATIVE", "", "", "module"];
  const csv = "﻿" + [headers, example].map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\r\n") + "\r\n";
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="product-import-template.csv"' } });
}
