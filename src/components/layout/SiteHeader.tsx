"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { Logo } from "./Logo";

const NAV = [
  { href: "/catalogue", label: "Components" },
  { href: "/packages", label: "Packages" },
  { href: "/configure", label: "Configure project" },
  { href: "/projects", label: "Projects" },
  { href: "/compliance", label: "Compliance" },
  { href: "/#enquiry", label: "Contact" },
];

export function SiteHeader({ user }: { user: { name: string; roles: string[] } | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = user ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-14 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 no-underline" aria-label="Home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {items.map((n) => (
            <Link key={n.href} href={n.href}
              className={clsx("rounded px-3 py-1.5 text-sm no-underline", path.startsWith(n.href) && n.href !== "/#enquiry" ? "bg-brand-50 font-medium text-brand-900" : "text-ink-muted hover:text-ink")}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <form action="/api/auth/logout" method="post">
              <span className="mr-2 text-xs text-ink-muted">{user.name}</span>
              <button className="btn-secondary btn-sm" type="submit">Sign out</button>
            </form>
          ) : (
            <Link href="/login" className="text-sm text-ink-muted no-underline hover:text-ink">Staff sign in</Link>
          )}
          <Link href="/configure" className="btn-accent btn-sm">Build your solar BOM</Link>
        </div>
        <button className="btn-ghost btn-sm md:hidden" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}>
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-slate-200 bg-white md:hidden">
          <div className="container-page flex flex-col py-2">
            {items.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded px-2 py-2 text-sm text-ink no-underline hover:bg-slate-50">{n.label}</Link>
            ))}
            {user ? (
              <form action="/api/auth/logout" method="post" className="px-2 py-2"><button className="btn-secondary btn-sm" type="submit">Sign out</button></form>
            ) : (
              <Link href="/login" className="px-2 py-2 text-sm no-underline">Staff sign in</Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
