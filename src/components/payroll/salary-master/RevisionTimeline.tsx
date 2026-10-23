"use client";

import { IndianRupee, Lock, Paperclip, Pencil, Trash2 } from "lucide-react";
import React from "react";

import { Money } from "@/components/common/Money";
import { revisionDate } from "@/components/payroll/salary-master/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SalaryRevision } from "@/lib/types/payroll";
import { cn, todayISO } from "@/lib/utils";

type Phase = "current" | "upcoming" | "past";

function phaseOf(revision: SalaryRevision, today: string): Phase {
  if (revision.effective_from > today) return "upcoming";
  if (revision.effective_to && revision.effective_to < today) return "past";
  return "current";
}

const DOT: Record<Phase, string> = {
  current: "bg-success",
  upcoming: "bg-primary",
  past: "bg-muted-foreground/40",
};

/**
 * One person's salary revisions, newest first, as a timeline of cards: the
 * date it applies from, CTC and gross a month, basic, and the file behind it.
 * A revision payroll has paid on is locked and says why.
 */
export function RevisionTimeline({
  revisions,
  onView,
  onEdit,
  onDelete,
  onDownload,
}: {
  revisions: SalaryRevision[];
  onView: (revision: SalaryRevision) => void;
  onEdit: (revision: SalaryRevision) => void;
  onDelete: (revision: SalaryRevision) => void;
  onDownload: (revision: SalaryRevision) => void;
}) {
  const today = todayISO();
  return (
    <ol className="relative grid gap-4">
      <span aria-hidden className="absolute top-2 bottom-2 left-[11px] w-px bg-border" />
      {revisions.map((revision) => {
        const phase = phaseOf(revision, today);
        return (
          <li key={revision.id} className="relative pl-10">
            <span
              aria-hidden
              className={cn("absolute top-6 left-1 size-[15px] rounded-full ring-4 ring-background", DOT[phase])}
            />
            <Card tier="tier1" className="gap-0 py-4">
              <CardContent className="grid gap-4 px-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="link"
                      className="h-auto p-0 text-base font-semibold tracking-wide uppercase"
                      onClick={() => onView(revision)}
                    >
                      {revisionDate(revision.effective_from)}
                    </Button>
                    {phase === "current" && <Badge variant="success">Current</Badge>}
                    {phase === "upcoming" && <Badge variant="accent">Upcoming</Badge>}
                    {revision.locked && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="muted" tabIndex={0}>
                            <Lock /> Locked
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-72">
                          Locked: {revision.locked_reason}. A correction is a new revision plus arrears.
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <IconAction label="See the full breakdown" onClick={() => onView(revision)}>
                      <IndianRupee />
                    </IconAction>
                    <IconAction
                      label={revision.locked ? "Locked, so it can't be edited" : "Edit this revision"}
                      disabled={revision.locked}
                      onClick={() => onEdit(revision)}
                    >
                      <Pencil />
                    </IconAction>
                    <IconAction
                      label={revision.locked ? "Locked, so it can't be deleted" : "Delete this revision"}
                      disabled={revision.locked}
                      onClick={() => onDelete(revision)}
                    >
                      <Trash2 />
                    </IconAction>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  <Fact label="CTC a month">
                    <Money value={revision.ctc_monthly} />
                  </Fact>
                  <Fact label="Monthly gross">
                    <Money value={revision.gross_monthly} />
                  </Fact>
                  <Fact label="Basic">
                    <Money value={revision.basic_monthly} />
                  </Fact>
                  <Fact label="Attachment">
                    {revision.attachment_name ? (
                      <Button
                        variant="link"
                        className="h-auto max-w-full justify-start p-0 text-sm"
                        onClick={() => onDownload(revision)}
                      >
                        <Paperclip />
                        <span className="truncate">{revision.attachment_name}</span>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">No attachment</span>
                    )}
                  </Fact>
                </dl>

                <p className="text-xs text-muted-foreground">
                  <Money value={revision.ctc_annual} /> a year
                  {revision.structure_name && ` · ${revision.structure_name}`}
                  {revision.effective_to && ` · until ${revisionDate(revision.effective_to)}`}
                  {revision.revision_reason && ` · ${revision.revision_reason}`}
                </p>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function IconAction({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A disabled button fires no pointer events, so the tooltip hangs off a wrapper. */}
        <span tabIndex={disabled ? 0 : -1}>
          <Button variant="ghost" size="icon" aria-label={label} disabled={disabled} onClick={onClick}>
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
