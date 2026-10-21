import { PageShell } from "@/components/common/PageShell";
import { EarnedWageCard } from "@/components/pay/EarnedWageAccess";
import { MyLoansArea } from "@/components/payroll-ops/loans/MyLoansArea";

export const metadata = { title: "Loans & encashment" };

export default function Page() {
  return (
    <PageShell
      title="Loans & encashment"
      description="Your loans and repayment schedules, leave encashment and pay you have already earned. Salary reimbursements are under Expenses."
    >
      <div className="grid gap-6">
        <EarnedWageCard />
        <MyLoansArea />
      </div>
    </PageShell>
  );
}
