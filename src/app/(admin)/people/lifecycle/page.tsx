import React, { Suspense } from "react";

import { LifecycleScreen } from "@/components/people/lifecycle/LifecycleScreen";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Lifecycle events" };

export default function Page() {
  // The events tab reads `?employee=` to preselect whom an event is raised for.
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <LifecycleScreen />
    </Suspense>
  );
}
