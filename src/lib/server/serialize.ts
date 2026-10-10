import type { LoadedBom } from "./bom";

const n = (v: unknown) => (v == null ? null : Number(v));

export type BomItemDTO = ReturnType<typeof serializeItems>[number];

export function serializeItems(bom: LoadedBom) {
  return bom.items.map((i) => ({
    id: i.id, section: i.section, lineNo: i.lineNo, itemCode: i.itemCode, name: i.name, specification: i.specification, unit: i.unit,
    calculatedQty: n(i.calculatedQty), procurementQty: n(i.procurementQty), quantityStatus: i.quantityStatus, quantityBasis: i.quantityBasis,
    productId: i.productId, productSku: i.product?.sku ?? null, categorySlug: i.product?.category.slug ?? null,
    manufacturer: i.manufacturer, model: i.model, unitPrice: n(i.unitPrice), priceProvenance: i.priceProvenance, gstRatePercent: n(i.gstRatePercent),
    taxClassCode: i.taxClassCode, complianceReq: i.complianceReq, complianceStatus: i.complianceStatus, technicalNotes: i.technicalNotes,
    supplierRemarks: i.supplierRemarks, supplierName: i.supplierName, availability: i.availability, isManual: i.isManual, removed: i.removed, ruleKey: i.ruleKey,
  }));
}
