import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { ArrearsWorkspace } from "@/components/payroll-ops/arrears/ArrearsWorkspace";

export const metadata = { title: "Arrears" };

export default function Page() {
  return (
    <PageShell title="Arrears" description="Retrospective revisions and arrears runs.">
      <SectionNav section="payroll" />
      <ArrearsWorkspace />
    </PageShell>
  );
}
