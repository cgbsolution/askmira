import { PageShell } from "@/components/common/PageShell";
import { ExitsWorkspace } from "@/components/exits/ExitsWorkspace";

export const metadata = { title: "Exits" };

export default function Page() {
  return (
    <PageShell title="Exits" description="Resignations, clearance and last working days.">
      <ExitsWorkspace />
    </PageShell>
  );
}
