import { PageShell } from "@/components/common/PageShell";
import { MySalaryReimbursements } from "@/components/payroll-ops/loans/MyReimbursements";

export const metadata = { title: "Salary reimbursements" };

export default function Page() {
  return (
    <PageShell
      title="Salary reimbursements"
      description="Reimbursement components of your salary — fuel, phone and the like. Claim them against bills; what HR accepts is paid with your salary."
    >
      <MySalaryReimbursements />
    </PageShell>
  );
}
