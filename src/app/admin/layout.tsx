import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { can, type Permission } from "@/lib/server/permissions";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

const NAV: { href: string; label: string; perm?: Permission }[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/projects", label: "Projects & BOMs" },
  { href: "/admin/enquiries", label: "Enquiries & quotes" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/import", label: "Bulk import", perm: "products.import" },
  { href: "/admin/manufacturers", label: "Manufacturers" },
  { href: "/admin/suppliers", label: "Suppliers" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/pricing", label: "Pricing & GST" },
  { href: "/admin/rules", label: "Engineering rules" },
  { href: "/admin/compliance", label: "Compliance library" },
  { href: "/admin/users", label: "Users & roles", perm: "users.manage" },
  { href: "/admin/audit", label: "Audit log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStaff();
  const items = NAV.filter((n) => !n.perm || can(s.roles, n.perm));
  return (
    <div className="container-page grid gap-6 py-6 lg:grid-cols-[200px_1fr]">
      <aside className="min-w-0">
        <p className="eyebrow">Administration</p>
        <p className="mt-1 text-xs text-ink-muted">{s.name} · {s.roles.map((r) => r.replace("_", " ").toLowerCase()).join(", ")}</p>
        <AdminNav items={items} />
        <Link href="/" className="mt-4 block text-xs">← Back to site</Link>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
