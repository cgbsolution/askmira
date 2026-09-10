import { FileText } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/ModulePlaceholder";
import { PageShell } from "@/components/common/PageShell";

export const metadata = { title: "Documents" };

export default function DocsPage() {
  return (
    <PageShell
      title="Documents"
      description="The employee document vault — offer letters, ID proofs, policy acknowledgements."
    >
      <ModulePlaceholder
        icon={FileText}
        phase="V1"
        summary="Document records are modelled against the employee; upload, preview and access control land with Core HR in V1 build order step 2."
        scope={[
          "Per-employee vault with category, expiry and employee-visibility flags",
          "Storage on Supabase Storage, addressed by signed URL",
          "Policy documents with acknowledgement tracking",
          "Statutory report archive with 24-month retrieval arrives in V2",
        ]}
      />
    </PageShell>
  );
}
