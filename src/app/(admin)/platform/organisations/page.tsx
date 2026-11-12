import { Suspense } from "react";

import { PlatformConsole } from "@/components/platform/PlatformConsole";

export const metadata = { title: "Organisations" };

export default function Page() {
  // The page reads its deep links (?open=, ?new=, ?search=) from the address.
  return (
    <Suspense>
      <PlatformConsole />
    </Suspense>
  );
}
