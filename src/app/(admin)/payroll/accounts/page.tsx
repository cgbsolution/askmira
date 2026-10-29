import { Suspense } from "react";

import { PageShell } from "@/components/common/PageShell";
import { AccountsScreen } from "@/components/payroll/accounts/AccountsScreen";

export const metadata = { title: "Account P&L" };

export default function Page() {
  return (
    <PageShell
      title="Account P&L"
      description="What each client account billed against the payroll cost of the people on it and its other direct costs."
    >
      <Suspense fallback={null}>
        <AccountsScreen />
      </Suspense>
    </PageShell>
  );
}
