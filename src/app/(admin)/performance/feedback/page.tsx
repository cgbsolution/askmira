import React, { Suspense } from "react";

import { FeedbackScreen } from "@/components/performance/Feedback";

export const metadata = { title: "Feedback" };

export default function FeedbackPage() {
  // The inbox links here with ?tab=give; reading it needs a Suspense boundary.
  return (
    <Suspense>
      <FeedbackScreen />
    </Suspense>
  );
}
