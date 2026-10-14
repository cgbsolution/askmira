import React, { Suspense } from "react";

import { PageShell } from "@/components/common/PageShell";
import { LedgerMappingScreen } from "@/components/payroll/accounting/LedgerMappingScreen";

export const metadata = { title: "Payroll accounting" };

export default function Page() {
  return (
    <PageShell
      title="Payroll accounting"
      description="Map payslip lines to your ledgers, then export any approved run as a journal for Tally, Zoho Books or your accounting system."
    >
      <Suspense>
        <LedgerMappingScreen />
      </Suspense>
    </PageShell>
  );
}
