import { PageShell } from "@/components/common/PageShell";
import { MyOnboarding } from "@/components/onboarding/MyOnboarding";

export const metadata = { title: "My onboarding" };

export default function Page() {
  return (
    <PageShell
      tier="tier2"
      title="My onboarding"
      description="Everything to get ready before you join and settle in during your first weeks."
    >
      <MyOnboarding />
    </PageShell>
  );
}
