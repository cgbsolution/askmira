import { PageShell } from "@/components/common/PageShell";
import { TaxSelfService } from "@/components/tax/TaxSelfService";

export const metadata = { title: "Tax declarations" };

export default function Page() {
  return (
    <PageShell
      title="Tax declarations"
      description="Regime choice, investment declarations, proofs, Form 12BB and Form 16."
    >
      <TaxSelfService />
    </PageShell>
  );
}
