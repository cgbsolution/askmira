import { PageShell } from "@/components/common/PageShell";
import { SettlementsWorkspace } from "@/components/exits/SettlementsWorkspace";
import { SettlementPayments } from "@/components/payroll/SettlementPayments";

export const metadata = { title: "Full & final" };

export default function Page() {
  return (
    <PageShell
      title="Full & final"
      description="Exit settlements, holds, approvals and payment."
    >
      <SettlementsWorkspace />
      <SettlementPayments />
    </PageShell>
  );
}
