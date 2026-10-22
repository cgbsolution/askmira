import React, { Suspense } from "react";

import { NewEmployeeView } from "@/components/people/NewEmployeeView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Add employees" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <NewEmployeeView />
    </Suspense>
  );
}
