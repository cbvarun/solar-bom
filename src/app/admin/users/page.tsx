import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { adminCtx } from "@/lib/server/admin-page";
import { PageHead, Field, Hidden, Check } from "@/components/admin/Fields";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { saveUser } from "../actions";

const ROLES = [
  { code: "ADMIN", label: "Administrator", desc: "Everything, including users and categories" },
  { code: "SALES_ENGINEER", label: "Sales engineer", desc: "Enquiries, quotations, BOM assignment" },
  { code: "DESIGN_ENGINEER", label: "Design engineer", desc: "Rules, specs, compliance, verification and approval" },
  { code: "PROCUREMENT", label: "Procurement", desc: "Products, suppliers, prices, GST, import" },
];

export default async function Users() {
  const { can } = await adminCtx();
  if (!can("users.manage")) redirect("/admin?denied=1");
  const users = await prisma.user.findMany({ include: { roles: { include: { role: true } } }, orderBy: { name: "asc" } });
  const form = (u?: (typeof users)[number]) => {
    const has = new Set(u?.roles.map((r) => r.role.code));
    return (
      <ActionForm action={saveUser} resetOnSuccess={!u}>
        <Hidden name="id" value={u?.id} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name" name="name" defaultValue={u?.name} required />
          <Field label="Email" name="email" type="email" defaultValue={u?.email} required />
          <Field label={u ? "New password (leave blank to keep)" : "Password"} name="password" type="password" required={!u} hint="At least 12 characters" />
        </div>
        <fieldset className="mt-3">
          <legend className="label text-xs">Roles</legend>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2">
            {ROLES.map((r) => <span key={r.code} title={r.desc}><Check label={r.label} name="roles" value={r.code} defaultChecked={has.has(r.code as never)} /></span>)}
          </div>
        </fieldset>
        <div className="mt-3 flex items-center justify-between gap-3"><Check label="Active" name="active" defaultChecked={u?.active ?? true} /><Submit variant={u ? "secondary" : "primary"}>{u ? "Save user" : "Create user"}</Submit></div>
      </ActionForm>
    );
  };
  return (
    <>
      <PageHead title="Users & roles">Staff accounts. Customers do not need accounts; they work on their own projects in their browser.</PageHead>
      <dl className="mb-4 grid gap-2 text-xs sm:grid-cols-2">{ROLES.map((r) => <div key={r.code}><dt className="font-semibold">{r.label}</dt><dd className="text-ink-muted">{r.desc}</dd></div>)}</dl>
      <ul className="space-y-3">{users.map((u) => <li key={u.id} className="card p-4">{form(u)}</li>)}</ul>
      <details className="card mt-4 p-4"><summary className="cursor-pointer text-sm font-medium">Add user</summary><div className="mt-3">{form()}</div></details>
    </>
  );
}
