import { Construction } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/ModulePlaceholder";
import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";

export const metadata = { title: "Approvals" };

export default function Page() {
  return (
    <PageShell title="Approvals" description="Everything waiting on your decision, in one place.">
      <SectionNav section="approvals" />
      <ModulePlaceholder
        icon={Construction}
        phase="V1"
        summary="This screen is being built. It shows nothing until it reads real data from the API."
        scope={[]}
      />
    </PageShell>
  );
}
