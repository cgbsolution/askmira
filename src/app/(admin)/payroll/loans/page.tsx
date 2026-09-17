import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { LoansAdmin } from "@/components/payroll-ops/loans/LoansAdmin";

export const metadata = { title: "Loans & reimbursements" };

export default function Page() {
  return (
    <PageShell
      title="Loans & reimbursements"
      description="Loan schemes, applications, disbursal and recovery — and reimbursement claims against bills."
    >
      <SectionNav section="payroll" />
      <LoansAdmin />
    </PageShell>
  );
}
