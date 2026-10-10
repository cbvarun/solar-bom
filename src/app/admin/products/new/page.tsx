import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { adminCtx } from "@/lib/server/admin-page";
import { PageHead } from "@/components/admin/Fields";
import { ProductForm } from "@/components/admin/ProductForm";

export default async function NewProduct() {
  const { can } = await adminCtx();
  if (!can("products.edit")) redirect("/admin?denied=1");
  const [cats, mfrs, taxes] = await Promise.all([
    prisma.productCategory.findMany({ where: { archived: false }, orderBy: { sortOrder: "asc" } }),
    prisma.manufacturer.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    prisma.taxClass.findMany({ orderBy: { code: "asc" } }),
  ]);
  return (
    <>
      <PageHead title="Add product">After creating the product, add its specifications, documents and supplier prices from the product page. Only enter values you can trace to a datasheet or quotation.</PageHead>
      <div className="card p-4">
        <ProductForm categories={cats.map((c) => ({ value: c.id, label: c.name }))} manufacturers={mfrs.map((m) => ({ value: m.id, label: m.name }))} taxClasses={taxes.map((t) => ({ value: t.id, label: `${t.code} · ${t.description}` }))} />
      </div>
    </>
  );
}
