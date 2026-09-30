import { OnboardingTransactionScreen } from "@/components/onboarding/OnboardingTransactionScreen";

export const metadata = { title: "Asset assignment" };

export default function Page() {
  return <OnboardingTransactionScreen kind="assets" />;
}
