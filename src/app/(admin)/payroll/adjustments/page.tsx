import { PageShell } from "@/components/common/PageShell";
import { AdjustmentsScreen } from "@/components/payroll/adjustments/AdjustmentsScreen";

export const metadata = { title: "Payroll adjustments" };

export default function Page() {
  return (
    <PageShell
      title="Payroll adjustments"
      description="Earnings and deductions outside the salary structure — incentives, one-off bonuses, recoveries and court attachments."
    >
      <AdjustmentsScreen />
    </PageShell>
  );
}
