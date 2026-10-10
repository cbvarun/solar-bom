"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="mt-3">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {items.map((n) => {
          const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
          return (
            <li key={n.href}>
              <Link href={n.href} aria-current={active ? "page" : undefined} className={clsx("block whitespace-nowrap rounded px-2.5 py-1.5 text-sm no-underline", active ? "bg-brand-800 text-white" : "text-ink-muted hover:bg-slate-100 hover:text-ink")}>{n.label}</Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
