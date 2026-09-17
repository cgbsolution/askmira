import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { GratuityAdmin } from "@/components/payroll-ops/gratuity/GratuityAdmin";

export const metadata = { title: "Gratuity & encashment" };

export default function Page() {
  return (
    <PageShell
      title="Gratuity & encashment"
      description="Gratuity accrual and liability, payouts at exit, the rules behind them, and leave encashment."
    >
      <SectionNav section="payroll" />
      <GratuityAdmin />
    </PageShell>
  );
}
