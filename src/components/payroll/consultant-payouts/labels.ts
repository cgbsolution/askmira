import type {
  PayoutRunStatus,
  TdsSection,
} from "@/lib/types/consultant-payouts";

export const PAYOUT_STATUS: Record<
  PayoutRunStatus,
  {
    label: string;
    variant:
      "default" | "accent" | "success" | "warning" | "destructive" | "muted";
  }
> = {
  draft: { label: "Draft", variant: "muted" },
  approved: { label: "Approved · locked", variant: "accent" },
  paid: { label: "Paid", variant: "success" },
};

export const SECTION_LABEL: Record<TdsSection, string> = {
  "194C": "194C",
  "194J_professional": "194J (professional)",
  "194J_technical": "194J (technical)",
};

/** "10.000" becomes "10%": the rate as shown next to the section. */
export function percent(rate: string): string {
  return `${Number.parseFloat(rate)}%`;
}

/** True when a money string holds more than zero. Used only to decide what to show. */
export function hasAmount(value: string | null | undefined): boolean {
  return Number.parseFloat(value ?? "0") > 0;
}

/** A held line: left out of the run by a problem, not by HR. */
export function isHeld(line: {
  excluded: boolean;
  excluded_reason: string | null;
}): boolean {
  return line.excluded && !line.excluded_reason;
}
