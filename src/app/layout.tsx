import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getSession } from "@/lib/auth";
import { company } from "@/lib/company";

export const metadata: Metadata = {
  title: { default: `Solar Component Catalogue & BOM Generator — ${company.name}`, template: `%s — ${company.shortName} Solar` },
  description: "Plan, specify and procure rooftop solar systems in Bengaluru: component catalogue, project configurator, preliminary BOM generation and quotations.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#163527" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="en-IN">
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
        <SiteHeader user={session ? { name: session.name, roles: session.roles } : null} />
        <main id="main" className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
