"use client";

import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AuditTrailPanel } from "./AuditTrailPanel";
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
export function CompanyScreen() {
  return (
    <PageShell
      title="Company"
      description="Workspace configuration, the permission matrix, the audit trail and the background jobs."
    >
      <SectionNav section="settings" />

      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
          <TabsTrigger value="jobs">Background jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="mt-4">
          <WorkspacePanel />
        </TabsContent>
        <TabsContent value="permissions" className="mt-4">
          <PermissionsPanel />
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
