import { Settings } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/ModulePlaceholder";
import { PageShell } from "@/components/common/PageShell";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageShell title="Settings" description="Workspace configuration, roles and the audit trail.">
      <ModulePlaceholder
        icon={Settings}
        phase="V1"
        summary="Workspace details, per-module permissions and the audit log are readable through the API; the admin UI is part of V1 build order step 1."
        scope={[
          "Per-module role permissions, with field-level restrictions on payroll data",
          "A user can never elevate their own role",
          "Immutable audit trail, filterable to AI actions specifically",
          "Custom field definitions for the employee record",
          "Module toggles per workspace",
        ]}
      />
    </PageShell>
  );
}
