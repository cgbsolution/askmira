import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { PoliciesWorkspace } from "@/components/expenses/PoliciesWorkspace";

export const metadata = { title: "Policies & rates" };

export default function Page() {
  return (
    <PageShell
      title="Policies & rates"
      description="Expense policy rules, city tiers, mileage, per-diem and exchange rates."
    >
      <SectionNav section="expenses" />
      <PoliciesWorkspace />
    </PageShell>
  );
}
