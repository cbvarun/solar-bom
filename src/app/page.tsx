import Link from "next/link";
import { prisma } from "@/lib/db";
import { company } from "@/lib/company";
import { EnquiryForm } from "@/components/forms/EnquiryForm";
import { HeroIllustration } from "@/components/HeroIllustration";
import { ProductImage } from "@/components/ProductImage";

export const dynamic = "force-dynamic";

const SOLUTIONS = [
  { title: "Residential", body: "Independent homes and villas, typically single-phase supply, net-metered grid-tied systems with optional battery backup." },
  { title: "Apartments", body: "Common-area loads for housing societies: shared roofs, multiple meters and approval from the association." },
  { title: "Commercial", body: "Offices, schools, hospitals and retail with three-phase supply, larger RCC roofs and daytime load matching." },
  { title: "Industrial", body: "Factories and warehouses with high sanctioned loads, export-limited options and multi-inverter monitoring." },
];
const BENEFITS = [
  { title: "Engineering-led design", body: "String sizing, inverter compatibility and cable sizing come from a rules engine with every assumption shown." },
  { title: "Transparent procurement", body: "Line-item BOMs with units, quantity basis, GST treatment and supplier remarks. Export to Excel, CSV or PDF." },
  { title: "Compliant equipment", body: "Track BIS/IEC certifications, ALMM applicability and BESCOM requirements against source documents — verified by engineers, not assumed." },
  { title: "Lifecycle support", body: "Revisions, audit trail and engineering approvals keep the BOM accurate from enquiry to commissioning." },
];

export default async function Home() {
  const categories = await prisma.productCategory.findMany({ where: { archived: false }, orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: { where: { status: "ACTIVE" } } } } } });
  const featured = categories.slice(0, 8);
  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-brand-50/60 to-white">
        <div className="container-page grid items-center gap-10 py-12 lg:grid-cols-2 lg:py-16">
          <div>
            <p className="eyebrow">Rooftop solar · Bengaluru, Karnataka</p>
            <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">Plan, Specify and Procure Your Rooftop Solar System.</h1>
            <p className="mt-4 max-w-xl text-base text-ink-muted">
              Browse a structured catalogue of solar components, configure your rooftop project and generate a detailed, editable bill of materials —
              with module counts, inverter compatibility checks, indicative cable and protection lists, and cost estimates you can export or send for quotation.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/configure" className="btn-accent">Build Your Solar BOM</Link>
              <Link href="/catalogue" className="btn-secondary">Explore Components</Link>
              <Link href="/packages" className="btn-secondary">Standard Packages</Link>
            </div>
            <p className="mt-4 text-xs text-ink-muted">Generated BOMs are preliminary and are verified by our design engineers before procurement.</p>
          </div>
          <HeroIllustration />
        </div>
      </section>

      <section className="container-page py-12">
        <h2 className="text-2xl">Solutions for every rooftop</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SOLUTIONS.map((s) => (
            <div key={s.title} className="card p-5">
              <h3 className="text-base">{s.title}</h3>
              <p className="mt-2 text-sm text-ink-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50/60">
        <div className="container-page grid gap-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b) => (
            <div key={b.title}>
              <div className="h-1 w-10 rounded bg-solar-400" />
              <h3 className="mt-3 text-base">{b.title}</h3>
              <p className="mt-2 text-sm text-ink-muted">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl">Component categories</h2>
          <Link href="/catalogue" className="text-sm">All 16 categories →</Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {featured.map((c) => (
            <Link key={c.id} href={`/catalogue?category=${c.slug}`} className="card group overflow-hidden no-underline hover:border-brand-300">
              <div className="aspect-[16/10]"><ProductImage category={c.slug} alt={c.name} /></div>
              <div className="p-3">
                <p className="text-sm font-medium text-ink group-hover:text-brand-800">{c.name}</p>
                <p className="text-xs text-ink-muted">{c._count.products} item{c._count.products === 1 ? "" : "s"}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section id="enquiry" className="border-t border-slate-200 bg-brand-50/40">
        <div className="container-page grid gap-10 py-12 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <h2 className="text-2xl">Project enquiry</h2>
            <p className="mt-2 text-sm text-ink-muted">Tell us about your site. A sales engineer will review it and arrange a site survey.</p>
            <div className="card mt-6 p-5"><EnquiryForm /></div>
          </div>
          <div className="lg:col-span-2">
            <h2 className="text-2xl">Contact and coverage</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div><dt className="font-medium">Company</dt><dd className="text-ink-muted">{company.name}</dd></div>
              <div><dt className="font-medium">Office</dt><dd className="text-ink-muted">{company.address}</dd></div>
              <div><dt className="font-medium">Phone</dt><dd className="text-ink-muted">{company.phone}</dd></div>
              <div><dt className="font-medium">Email</dt><dd><a href={`mailto:${company.email}`}>{company.email}</a></dd></div>
            </dl>
            <h3 className="mt-6 text-base">Bengaluru service coverage</h3>
            <ul className="mt-2 grid gap-1 text-sm text-ink-muted">
              {company.serviceAreas.map((a) => <li key={a} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />{a}</li>)}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
