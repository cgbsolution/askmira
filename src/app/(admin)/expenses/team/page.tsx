import { PageShell } from "@/components/common/PageShell";
import { TeamApprovalsWorkspace } from "@/components/expenses/TeamApprovalsWorkspace";

export const metadata = { title: "Team approvals" };

export default function Page() {
  return (
    <PageShell
      title="Team approvals"
      description="Expense claims and travel requests from your team, before finance sees them."
    >
      <TeamApprovalsWorkspace />
    </PageShell>
  );
}
