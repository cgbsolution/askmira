import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { ExitsWorkspace } from "@/components/exits/ExitsWorkspace";

export const metadata = { title: "Exits" };

export default function Page() {
  return (
    <PageShell title="Exits" description="Resignations, clearance and last working days.">
      <SectionNav section="people" />
      <ExitsWorkspace />
    </PageShell>
  );
}
