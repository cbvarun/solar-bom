import type { Metadata } from "next";
import { ConfigureForm } from "@/components/configurator/ConfigureForm";
import { configuratorOptions } from "@/lib/server/configurator";
import { getSession, hasRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Configure your rooftop solar project" };
export const dynamic = "force-dynamic";

export default async function ConfigurePage() {
  const [options, session] = await Promise.all([configuratorOptions(), getSession()]);
  return (
    <div className="container-page py-8">
      <p className="eyebrow">Project configurator</p>
      <h1 className="mt-1 text-2xl">Configure Your Rooftop Solar Project</h1>
      <p className="mt-1 max-w-3xl text-sm text-ink-muted">Answer what you know. Anything left blank is marked <em>To be confirmed during site survey</em> and flagged in the BOM. Only the project name is required to save; a target capacity is needed to size the system.</p>
      <div className="mt-6"><ConfigureForm options={options} canSetVerified={hasRole(session, "DESIGN_ENGINEER")} /></div>
    </div>
  );
}
