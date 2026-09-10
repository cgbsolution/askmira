import { CalendarClock } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/ModulePlaceholder";
import { PageShell } from "@/components/common/PageShell";

export const metadata = { title: "Time" };

export default function TimePage() {
  return (
    <PageShell
      title="Time off"
      description="Leave policies, balances and approvals — configurable by location and grade."
    >
      <ModulePlaceholder
        icon={CalendarClock}
        phase="V1"
        summary="Leave types, holiday calendars and requests are modelled and readable via the API; the request and approval flow is V1 build order step 3."
        scope={[
          "Policies by location and grade, with accrual and carry-forward rules",
          "Multi-step approval chains, snapshotted onto each request",
          "State-wise holiday calendars driven by a location's state code",
          "Balances per leave type per leave year",
          "Attendance and shift scheduling arrive in V2",
        ]}
      />
    </PageShell>
  );
}
