import Link from "next/link";
import { loadProjectOr404 } from "@/lib/server/access";
import { Badge } from "@/components/ui/Badge";
import { ProjectTabs } from "@/components/project/ProjectTabs";
import { DuplicateButton } from "@/components/project/DuplicateButton";
import { CUSTOMER_TYPE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, access } = await loadProjectOr404(id);
  const bom = project.boms[0];
  return (
    <div className="container-page py-6">
      <nav aria-label="Breadcrumb" className="text-xs text-ink-muted"><Link href="/projects">Projects</Link> / {project.reference}</nav>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl">{project.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <span className="font-mono text-xs">{project.reference}</span>
            <span>· {project.location ?? "Location TBC"}</span>
            {project.customerType && <span>· {CUSTOMER_TYPE_LABEL[project.customerType]}</span>}
            {project.isSample && <Badge tone="yellow">Illustrative sample</Badge>}
            {bom && <Badge tone={bom.status === "APPROVED" ? "green" : bom.status === "REJECTED" ? "red" : bom.status === "SUBMITTED" ? "blue" : "gray"}>BOM rev {bom.currentRevision} · {bom.status.toLowerCase()}</Badge>}
            {access === "read" && <Badge>Read-only</Badge>}
          </p>
        </div>
        <DuplicateButton projectId={project.id} primary={access === "read"} />
      </div>
      <ProjectTabs id={project.id} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
