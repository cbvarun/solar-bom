import { ConfigureForm } from "@/components/configurator/ConfigureForm";
import { configuratorOptions, formInitial } from "@/lib/server/configurator";
import { loadProjectOr404 } from "@/lib/server/access";
import { getSession, hasRole } from "@/lib/auth";
import { Alert } from "@/components/ui/Alert";

export default async function ProjectConfigurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, access } = await loadProjectOr404(id);
  const [options, session] = await Promise.all([configuratorOptions(), getSession()]);
  return (
    <>
      {access === "read" && <Alert tone="note" className="mb-4">This sample project is read-only. Use “Duplicate to edit” to create your own copy.</Alert>}
      {access === "edit" ? (
        <ConfigureForm options={options} initial={formInitial(project)} projectId={project.id} canSetVerified={hasRole(session, "DESIGN_ENGINEER")} />
      ) : (
        <ConfigureForm options={options} initial={formInitial(project)} canSetVerified={false} />
      )}
    </>
  );
}
