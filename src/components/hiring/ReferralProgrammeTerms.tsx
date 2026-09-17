import { Info } from "lucide-react";
import React from "react";

import { Money } from "@/components/common/Money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReferralProgramme, ShareLinkResult } from "@/lib/types/hiring";

type Milestones = ReferralProgramme["milestones"];

/** Bonus by grade, as the programme states it. Money stays a string. */
export function ReferralBonusList({ bonus }: { bonus: Record<string, string> }) {
  const grades = Object.keys(bonus).sort();
  if (grades.length === 0) {
    return <p className="text-sm text-muted-foreground">No bonus amounts are set.</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {grades.map((grade) => (
        <li key={grade} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Grade {grade}</span>
          <Money value={bonus[grade]} className="font-medium text-foreground" />
        </li>
      ))}
    </ul>
  );
}

/** When the bonus is paid: each milestone's share and the days after joining. */
export function ReferralMilestoneList({ milestones }: { milestones: Milestones }) {
  if (milestones.length === 0) {
    return <p className="text-sm text-muted-foreground">No payment milestones are set.</p>;
  }
  return (
    <ul className="space-y-1 text-sm">
      {milestones.map((milestone) => (
        <li key={milestone.key} className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-foreground">{milestone.label}</span>
          <span className="tabular-nums text-muted-foreground">
            {milestone.share_percent}% · {milestone.days_after_joining} days after joining
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The duplicate rule and tax note, shown wherever a referral link is shared. */
export function ReferralShareTerms({ terms }: { terms: ShareLinkResult["terms"] }) {
  return (
    <div className="grid gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
      <p className="font-medium text-foreground">Terms</p>
      <p className="text-muted-foreground">{terms.duplicate_rule}</p>
      <ReferralBonusList bonus={terms.bonus_by_grade} />
      <ReferralMilestoneList milestones={terms.milestones} />
      <p className="text-xs text-muted-foreground">{terms.tax_note}</p>
    </div>
  );
}

/** A referral programme's terms in full: bonus, milestones, rules, tax and payroll notes. */
export function ReferralProgrammeTerms({ programme }: { programme: ReferralProgramme }) {
  const { rules } = programme;
  const ruleLines = [
    rules.duplicate_rule,
    rules.require_confirmed ? "The referrer must be a confirmed employee." : null,
    rules.exclude_on_pip ? "Employees on an improvement plan are not eligible." : null,
    rules.exclude_hiring_team ? "Members of a role's hiring team are not eligible for it." : null,
  ].filter((line): line is string => Boolean(line));

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {programme.name}
          {programme.is_active ? (
            <Badge variant="success">Running</Badge>
          ) : (
            <Badge variant="muted">Not running</Badge>
          )}
        </CardTitle>
        {programme.description && <CardDescription>{programme.description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <section className="grid content-start gap-2">
          <p className="text-sm font-medium text-foreground">Bonus by grade</p>
          <ReferralBonusList bonus={programme.bonus_by_grade} />
        </section>
        <section className="grid content-start gap-2">
          <p className="text-sm font-medium text-foreground">When it is paid</p>
          <ReferralMilestoneList milestones={programme.milestones} />
          {programme.eligible_roles.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Open to: {programme.eligible_roles.join(", ")}
            </p>
          )}
        </section>
        <section className="grid content-start gap-2 md:col-span-2">
          <p className="text-sm font-medium text-foreground">Rules</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {ruleLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{programme.tax_note}</p>
        </section>
        <Alert className="md:col-span-2">
          <Info />
          <AlertTitle>How payouts reach payroll</AlertTitle>
          <AlertDescription>{programme.payroll_note}</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
