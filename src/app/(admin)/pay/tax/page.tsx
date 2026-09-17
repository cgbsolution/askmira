import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { TaxSelfService } from "@/components/tax/TaxSelfService";

export const metadata = { title: "Tax declarations" };

export default function Page() {
  return (
    <PageShell
      title="Tax declarations"
      description="Regime choice, investment declarations, proofs and Form 12BB."
    >
      <SectionNav section="pay" />
      <TaxSelfService />
    </PageShell>
  );
}
