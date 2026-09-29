import { PageShell } from "@/components/common/PageShell";
import { MyLoansArea } from "@/components/payroll-ops/loans/MyLoansArea";

export const metadata = { title: "Loans & reimbursements" };

export default function Page() {
  return (
    <PageShell
      title="Loans & reimbursements"
      description="Your loans and repayment schedules, reimbursement claims, and leave encashment."
    >
      <MyLoansArea />
    </PageShell>
  );
}
