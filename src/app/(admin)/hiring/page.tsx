import { Briefcase } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/ModulePlaceholder";
import { PageShell } from "@/components/common/PageShell";

export const metadata = { title: "Hiring" };

export default function HiringPage() {
  return (
    <PageShell
      title="Hiring"
      description="The AnytimeHire ATS, re-platformed so pre-hire signal carries into the employee record."
    >
      <ModulePlaceholder
        icon={Briefcase}
        phase="V1"
        summary="Requisitions and candidates are modelled and readable. Before this module appears in any customer-facing demo, the two scoring defects carried over from AnytimeHire must be fixed and independently re-verified — a blocking gate at M1, not a parallel workstream."
        scope={[
          "AI job-description drafting, versioned on publish",
          "Candidate pipeline with resume parsing and stage transitions",
          "Fit Score must vary with AI Round Score — a regression test blocks release",
          "Proctoring status must use factual, non-judgemental wording",
          "Candidate converts to an employee inside the same schema, preserving signal",
        ]}
      />
    </PageShell>
  );
}
