import { PageShell } from "@/components/common/PageShell";
import { MyTasksScreen } from "@/components/onboarding/MyTasksScreen";

export const metadata = { title: "My onboarding tasks" };

export default function Page() {
  return (
    <PageShell
      tier="tier2"
      title="My tasks"
      description="Onboarding work that is yours for new joiners: as their manager, buddy, or the IT, HR or finance owner."
    >
      <MyTasksScreen />
    </PageShell>
  );
}
