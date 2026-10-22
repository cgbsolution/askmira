import React, { Suspense } from "react";

import { PlansScreen } from "@/components/onboarding/PlansScreen";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "New joiners" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <PlansScreen />
    </Suspense>
  );
}
