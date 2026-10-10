import Link from "next/link";
import { company } from "@/lib/company";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-brand-950 text-brand-100">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-3 text-xs leading-relaxed text-brand-200">{company.name}<br />{company.address}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Platform</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link className="text-brand-200 no-underline hover:text-white" href="/catalogue">Component catalogue</Link></li>
            <li><Link className="text-brand-200 no-underline hover:text-white" href="/configure">Project configurator</Link></li>
            <li><Link className="text-brand-200 no-underline hover:text-white" href="/projects">Saved projects</Link></li>
            <li><Link className="text-brand-200 no-underline hover:text-white" href="/compliance">Compliance sources</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Contact</p>
          <ul className="mt-2 space-y-1 text-sm text-brand-200">
            <li>{company.phone}</li>
            <li><a className="text-brand-200" href={`mailto:${company.email}`}>{company.email}</a></li>
            <li>{company.gstin}</li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Important</p>
          <p className="mt-2 text-xs leading-relaxed text-brand-200">
            BOMs and estimates generated here are preliminary. They do not replace an approved electrical and structural design or BESCOM approval.
            Estimated generation, savings and payback are never guaranteed.
          </p>
        </div>
      </div>
      <div className="border-t border-brand-900 py-4 text-center text-xs text-brand-300">© {new Date().getFullYear()} {company.name}</div>
    </footer>
  );
}
