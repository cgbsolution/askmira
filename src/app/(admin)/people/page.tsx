import React, { Suspense } from "react";

import { DirectoryView } from "@/components/people/DirectoryView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Employees" };

export default function PeoplePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <DirectoryView />
    </Suspense>
  );
}
