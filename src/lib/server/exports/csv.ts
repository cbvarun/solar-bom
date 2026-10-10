import Papa from "papaparse";
import type { ExportData } from "./data";

/** Flat, procurement-ready BOM: one row per active line, stable column names for ERP import. */
export function bomCsv(d: ExportData): string {
  const rows = d.items.map((i, n) => {
    const p = d.priced.get(i.id);
    return {
      project_reference: d.project.reference,
      bom_revision: d.bom.currentRevision,
      line_no: n + 1,
      section: d.sectionLabel(i.section),
      item_code: i.itemCode,
      description: i.name,
      specification: i.specification ?? "",
      manufacturer: i.manufacturer ?? "",
      model: i.model ?? "",
      uom: i.unit,
      calculated_qty: i.calculatedQty ?? "",
      procurement_qty: i.procurementQty ?? "",
      quantity_status: i.quantityStatus,
      unit_price_inr: i.unitPrice ?? "",
      prices_include_gst: d.bom.pricesIncludeGst ? "Y" : "N",
      price_source: i.priceProvenance ?? "",
      subtotal_excl_gst_inr: p?.subtotal ?? "",
      gst_rate_pct: i.gstRatePercent ?? "",
      gst_inr: p?.gst ?? "",
      total_inr: p?.total ?? "",
      tax_class: i.taxClassCode ?? "",
      availability: i.availability,
      supplier: i.supplierName ?? "",
      compliance_status: i.complianceStatus,
      compliance_requirement: i.complianceReq ?? "",
      quantity_basis: i.quantityBasis ?? "",
      technical_notes: i.technicalNotes ?? "",
      supplier_remarks: i.supplierRemarks ?? "",
    };
  });
  // BOM for Excel compatibility with UTF-8 characters such as ² and °.
  return "﻿" + Papa.unparse(rows, { newline: "\r\n" });
}
