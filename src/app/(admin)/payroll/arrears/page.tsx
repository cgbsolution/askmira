import { PageShell } from "@/components/common/PageShell";
import { ArrearsWorkspace } from "@/components/payroll-ops/arrears/ArrearsWorkspace";

export const metadata = { title: "Arrears" };

export default function Page() {
  return (
    <PageShell title="Arrears" description="Retrospective revisions and arrears runs.">
      <ArrearsWorkspace />
    </PageShell>
  );
}
