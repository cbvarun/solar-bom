import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Alert } from "@/components/ui/Alert";
import { Badge, VerificationBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Standards & approvals" };
export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const standards = await prisma.complianceStandard.findMany({ where: { active: true }, orderBy: [{ authority: "asc" }, { code: "asc" }] });
  const authorities = [...new Set(standards.map((s) => s.authority))];
  return (
    <div className="container-page py-8">
      <p className="eyebrow">Bengaluru, Karnataka</p>
      <h1 className="mt-1 text-3xl">Standards, regulations and approvals</h1>
      <p className="mt-2 max-w-3xl text-ink-muted">
        The sources our engineers check rooftop solar projects against. Requirements are set by these bodies and change over time, so always rely on the official publication linked here. Each project gets its own checklist, reviewed by a design engineer.
      </p>
      <Alert tone="info" className="mt-4 max-w-3xl">Status shows whether our team has checked this record against the current official publication. It does not describe any particular project or product.</Alert>
      {authorities.map((a) => (
        <section key={a} className="mt-8">
          <h2 className="section-title">{a}</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {standards.filter((s) => s.authority === a).map((s) => (
              <li key={s.id} className="card p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{s.code}</p>
                  <VerificationBadge status={s.verificationStatus} />
                </div>
                <p className="mt-1">{s.title}</p>
                <p className="mt-1 text-xs text-ink-muted"><Badge>{s.scope}</Badge> {s.revision ? `Revision ${s.revision}${s.revisionDate ? `, ${formatDate(s.revisionDate)}` : ""}` : "Revision to be recorded"}</p>
                {s.applicabilityNotes && <p className="mt-2 text-xs">{s.applicabilityNotes}</p>}
                {s.officialUrl && <a className="mt-2 inline-block text-xs" href={s.officialUrl} target="_blank" rel="noopener noreferrer">Official source ↗</a>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
