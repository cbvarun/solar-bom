"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function ProjectTabs({ id }: { id: string }) {
  const path = usePathname();
  const tabs = [
    { href: `/projects/${id}`, label: "Summary" },
    { href: `/projects/${id}/bom`, label: "Bill of materials" },
    { href: `/projects/${id}/site`, label: "Site & savings" },
    { href: `/projects/${id}/compliance`, label: "Compliance" },
    { href: `/projects/${id}/quote`, label: "Quote & export" },
    { href: `/projects/${id}/configure`, label: "Configuration" },
    { href: `/projects/${id}/history`, label: "Revisions & audit" },
  ];
  return (
    <nav aria-label="Project sections" className="mt-4 overflow-x-auto border-b border-slate-200">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const active = path === t.href;
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined}
                className={clsx("block border-b-2 px-3 py-2 text-sm no-underline", active ? "border-solar-400 font-medium text-brand-900" : "border-transparent text-ink-muted hover:text-ink")}>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
