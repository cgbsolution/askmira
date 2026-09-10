import { Heart } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/ModulePlaceholder";
import { PageShell } from "@/components/common/PageShell";

export const metadata = { title: "Culture" };

export default function CulturePage() {
  return (
    <PageShell
      tier="tier2"
      title="Culture"
      description="Recognition and clubs — the layer no India-native competitor currently matches."
    >
      <ModulePlaceholder
        icon={Heart}
        tier="tier2"
        phase="V1"
        summary="Shoutouts can already be posted and read through the API; the feed UI, reactions and club membership are V1 build order step 5."
        scope={[
          "Shoutouts with reactions, value tags and company-wide visibility",
          "Clubs — interest groups independent of the org structure",
          "Participation surfaced to HR only in aggregate, never per person",
          "Points awards ride on shoutouts once the Rewards engine lands in V2",
          "Pulse surveys and Your Voice (POSH-framed anonymous reporting) are V2",
        ]}
      />
    </PageShell>
  );
}
