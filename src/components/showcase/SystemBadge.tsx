import React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { SystemKey } from "./types";

/** Each connected product's colour, from the tokens in globals.css. */
const TONE: Record<SystemKey, string> = {
  saleinx: "border-tool-saleinx/30 bg-tool-saleinx/10 text-tool-saleinx",
  hrms: "border-tool-hrms/30 bg-tool-hrms/10 text-tool-hrms",
  anytimehire: "border-tool-anytimehire/30 bg-tool-anytimehire/10 text-tool-anytimehire",
  procureflow: "border-tool-procureflow/30 bg-tool-procureflow/10 text-tool-procureflow",
  helpdesk: "border-tool-helpdesk/30 bg-tool-helpdesk/10 text-tool-helpdesk",
  expensegenie: "border-tool-expensegenie/30 bg-tool-expensegenie/10 text-tool-expensegenie",
  accounts: "border-tool-accounts/30 bg-tool-accounts/10 text-tool-accounts",
};

const DOT: Record<SystemKey, string> = {
  saleinx: "bg-tool-saleinx",
  hrms: "bg-tool-hrms",
  anytimehire: "bg-tool-anytimehire",
  procureflow: "bg-tool-procureflow",
  helpdesk: "bg-tool-helpdesk",
  expensegenie: "bg-tool-expensegenie",
  accounts: "bg-tool-accounts",
};

export const SYSTEM_LABEL: Record<SystemKey, string> = {
  saleinx: "Saleinx",
  hrms: "HRMS",
  anytimehire: "AnytimeHire",
  procureflow: "ProcureFlow",
  helpdesk: "CGB Helpdesk",
  expensegenie: "Expense Genie",
  accounts: "Accounts",
};

/** A product's name in its own colour: where a step of the story happened. */
export function SystemBadge({ system, className }: { system: SystemKey; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-semibold", TONE[system], className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", DOT[system])} />
      {SYSTEM_LABEL[system] ?? system}
    </Badge>
  );
}

/** Just the product's colour dot, for tight places (the activity list). */
export function SystemDot({ system, className }: { system: SystemKey; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", DOT[system], className)} />;
}
