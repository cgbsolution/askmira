import { PageShell } from "@/components/common/PageShell";
import { OvertimeScreen } from "@/components/time/overtime/OvertimeScreen";

export const metadata = { title: "Overtime" };

export default function Page() {
  return (
    <PageShell
      title="Overtime"
      description="Overtime from attendance, decided by the line manager or HR, priced by the location's policy and paid by the next payroll run."
    >
      <OvertimeScreen />
    </PageShell>
  );
}
