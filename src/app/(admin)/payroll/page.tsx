import { CircleDollarSign } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/ModulePlaceholder";
import { PageShell } from "@/components/common/PageShell";

export const metadata = { title: "Payroll" };

export default function PayrollPage() {
  return (
    <PageShell
      title="Payroll & compliance"
      description="PF, ESI, Professional Tax and TDS — computed against versioned, effective-dated rule sets."
    >
      <ModulePlaceholder
        icon={CircleDollarSign}
        phase="V1"
        summary="Rule sets and run history are modelled and readable; the computation engine is V1 build order step 4. No placeholder figures appear here on purpose — a payroll number that looks right but is not is worse than no number."
        scope={[
          "PF, ESI, state-wise PT and TDS for the top 5 states by client concentration",
          "Rule sets versioned by jurisdiction and effective date, never edited in place",
          "Variance flagging against the prior cycle, blocking approval until acknowledged",
          "Compliance SME sign-off required before a rule set can be used",
          "Payslips carry a full computation trace, not just totals",
          "Pan-India coverage and Form 16 / 24Q follow in V2",
        ]}
      />
    </PageShell>
  );
}
