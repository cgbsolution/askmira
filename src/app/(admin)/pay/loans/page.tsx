import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { MyLoansArea } from "@/components/payroll-ops/loans/MyLoansArea";

export const metadata = { title: "Loans & reimbursements" };

export default function Page() {
  return (
    <PageShell
      title="Loans & reimbursements"
      description="Your loans and repayment schedules, reimbursement claims, and leave encashment."
    >
      <SectionNav section="pay" />
      <MyLoansArea />
    </PageShell>
  );
}
