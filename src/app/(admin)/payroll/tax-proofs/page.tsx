import { PageShell } from "@/components/common/PageShell";
import { TaxProofsWorkspace } from "@/components/tax/TaxProofsWorkspace";

export const metadata = { title: "Tax proofs" };

export default function Page() {
  return (
    <PageShell
      title="Tax proofs"
      description="Investment proof verification queue, and the declaration and proof windows."
    >
      <TaxProofsWorkspace />
    </PageShell>
  );
}
