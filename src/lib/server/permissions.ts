import type { StaffRole } from "@/lib/session";

/** Role-based access for the admin area. ADMIN always passes. */
export const PERMISSIONS = {
  "products.edit": ["PROCUREMENT", "DESIGN_ENGINEER"],
  "products.import": ["PROCUREMENT"],
  "products.specs": ["DESIGN_ENGINEER", "PROCUREMENT"],
  "pricing.edit": ["PROCUREMENT"],
  "tax.edit": ["PROCUREMENT"],
  "suppliers.edit": ["PROCUREMENT"],
  "manufacturers.edit": ["PROCUREMENT", "DESIGN_ENGINEER"],
  "categories.edit": [],
  "rules.edit": ["DESIGN_ENGINEER"],
  "compatibility.edit": ["DESIGN_ENGINEER"],
  "compliance.edit": ["DESIGN_ENGINEER"],
  "documents.upload": ["DESIGN_ENGINEER", "PROCUREMENT"],
  "enquiries.manage": ["SALES_ENGINEER"],
  "projects.assign": ["SALES_ENGINEER", "DESIGN_ENGINEER"],
  "revisions.review": ["DESIGN_ENGINEER"],
  "users.manage": [],
} as const satisfies Record<string, StaffRole[]>;
export type Permission = keyof typeof PERMISSIONS;

export function can(roles: string[], p: Permission): boolean {
  return roles.includes("ADMIN") || (PERMISSIONS[p] as readonly string[]).some((r) => roles.includes(r));
}
