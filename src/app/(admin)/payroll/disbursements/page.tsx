import { PageShell } from "@/components/common/PageShell";
import { DisbursementsWorkspace } from "@/components/payroll-ops/disbursements/DisbursementsWorkspace";

export const metadata = { title: "Bank files" };

export default function Page() {
  return (
    <PageShell title="Bank files" description="Salary disbursement files with maker-checker.">
      <DisbursementsWorkspace />
    </PageShell>
  );
}
