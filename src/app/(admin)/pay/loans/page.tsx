import { PageShell } from "@/components/common/PageShell";
import { EarnedWageCard } from "@/components/pay/EarnedWageAccess";
import { MyLoansArea } from "@/components/payroll-ops/loans/MyLoansArea";

export const metadata = { title: "Loans & reimbursements" };

export default function Page() {
  return (
    <PageShell
      title="Loans & reimbursements"
      description="Your loans and repayment schedules, reimbursement claims, leave encashment and pay you have already earned."
    >
      <div className="grid gap-6">
        <EarnedWageCard />
        <MyLoansArea />
      </div>
    </PageShell>
  );
}
