import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { GstWorkspace } from "@/components/expenses/GstWorkspace";

export const metadata = { title: "GST credits" };

export default function Page() {
  return (
    <PageShell
      title="GST credits"
      description="Input tax credit on expenses: eligibility, the register, and GSTR-2B reconciliation."
    >
      <SectionNav section="expenses" />
      <GstWorkspace />
    </PageShell>
  );
}
