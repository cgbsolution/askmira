import { PageShell } from "@/components/common/PageShell";
import { ShiftsAdmin } from "@/components/attendance/ShiftsAdmin";

export const metadata = { title: "Shifts & rosters" };

export default function Page() {
  return (
    <PageShell
      title="Shifts & rosters"
      description="Shift definitions, rosters, assignments, payroll locks, punch imports and work locations."
    >
      <ShiftsAdmin />
    </PageShell>
  );
}
