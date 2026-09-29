import { PageShell } from "@/components/common/PageShell";
import { FilingsWorkspace } from "@/components/payroll-ops/filings/FilingsWorkspace";

export const metadata = { title: "Return filings" };

export default function Page() {
  return (
    <PageShell title="Return filings" description="PF ECR, ESIC, PT and TDS 24Q return files.">
      <FilingsWorkspace />
    </PageShell>
  );
}
