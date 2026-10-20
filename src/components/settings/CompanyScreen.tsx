"use client";

import { useEffect, useState } from "react";

import { AiSettingsPanel } from "@/components/ai/AiSettingsPanel";
import { CompanionSettingsPanel } from "@/components/companion/CompanionSettingsPanel";
import { PageShell } from "@/components/common/PageShell";
import { OperatorAccessPanel } from "@/components/operators/OperatorAccessPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ApprovalRulesPanel } from "./ApprovalRulesPanel";
import { AuditTrailPanel } from "./AuditTrailPanel";
import { CompanyLogoCard } from "./CompanyLogoCard";
import { CustomFieldsPanel } from "./CustomFieldsPanel";
import { IntegrationsPanel } from "./IntegrationsPanel";
import { CustomTablesPanel } from "@/components/people/CustomTables";
import { PermissionsPanel } from "./PermissionsPanel";
import { SchedulerPanel } from "./SchedulerPanel";
import { WorkspacePanel } from "./WorkspacePanel";

/**
 * Settings → Company.
 *
 * Four things an administrator is asked about in an audit and has nowhere else
 * to look: what the workspace is configured as, who can do what, what has
 * happened, and whether the scheduled work is actually running.
 */
const TABS = [
  "workspace", "permissions", "approvals", "fields", "integrations", "ai", "operators", "audit", "jobs",
];

export function CompanyScreen() {
  // `/settings?tab=ai` opens on that tab: other pages link straight to it.
  const [tab, setTab] = useState("workspace");
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted && TABS.includes(wanted)) setTab(wanted);
  }, []);

  return (
    <PageShell
      title="Company"
      description="Workspace configuration, the permission matrix, the audit trail and the background jobs."
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="approvals">Approval rules</TabsTrigger>
          <TabsTrigger value="fields">Custom fields</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="operators">Operators</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
          <TabsTrigger value="jobs">Background jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="mt-4">
          <div className="grid gap-6">
            <WorkspacePanel />
            <CompanyLogoCard />
          </div>
        </TabsContent>
        <TabsContent value="permissions" className="mt-4">
          <PermissionsPanel />
        </TabsContent>
        <TabsContent value="approvals" className="mt-4">
          <ApprovalRulesPanel />
        </TabsContent>
        <TabsContent value="fields" className="mt-4">
          <div className="grid gap-6">
            <CustomFieldsPanel />
            <CustomTablesPanel />
          </div>
        </TabsContent>
        <TabsContent value="integrations" className="mt-4">
          <IntegrationsPanel />
        </TabsContent>
        <TabsContent value="ai" className="mt-4">
          <div className="grid gap-6">
            <AiSettingsPanel />
            <CompanionSettingsPanel />
          </div>
        </TabsContent>
        <TabsContent value="operators" className="mt-4">
          <OperatorAccessPanel />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditTrailPanel />
        </TabsContent>
        <TabsContent value="jobs" className="mt-4">
          <SchedulerPanel />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
