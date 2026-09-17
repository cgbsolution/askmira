import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { SettlementsWorkspace } from "@/components/exits/SettlementsWorkspace";

export const metadata = { title: "Full & final" };

export default function Page() {
  return (
    <PageShell title="Full & final" description="Exit settlements, holds and approvals.">
      <SectionNav section="payroll" />
      <SettlementsWorkspace />
    </PageShell>
  );
}
