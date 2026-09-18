import type { AwardCycleStatus } from "@/lib/types/culture";

export const CYCLE_STATUS: Record<AwardCycleStatus, { label: string; variant: "secondary" | "warning" | "success" | "outline" | "muted" }> = {
  draft: { label: "Draft", variant: "outline" },
  nominations_open: { label: "Nominations open", variant: "success" },
  jury_scoring: { label: "Jury scoring", variant: "warning" },
  decided: { label: "Decided", variant: "secondary" },
  announced: { label: "Announced", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "muted" },
};
