"use client";

import { Download, History, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { formatMoment } from "@/components/payroll/labels";
import { revisionDate } from "@/components/payroll/salary-master/shared";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { SalaryTrailEntry } from "@/lib/types/payroll";
import { cn, formatMoney } from "@/lib/utils";

type Snapshot = {
  ctc_annual?: string;
  effective_from?: string;
  structure?: string | null;
  reason?: string | null;
  typed_amounts?: Record<string, string>;
  remarks?: Record<string, string>;
};

const money = (value: unknown) => (typeof value === "string" ? formatMoney(value) : "—");
const day = (value: unknown) => (typeof value === "string" && value ? revisionDate(value) : "—");

/** What one audit entry changed, as sentences a payroll person reads. */
function describe(entry: SalaryTrailEntry, nameOf: (code: string) => string): string[] {
  const c = entry.changes as Record<string, unknown>;
  const lines: string[] = [];
  const before = c.before as Snapshot | undefined;
  const after = c.after as Snapshot | undefined;

  if (before && after) {
    if (before.ctc_annual !== after.ctc_annual) {
      lines.push(`CTC ${money(before.ctc_annual)} → ${money(after.ctc_annual)} a year`);
    }
    if (before.effective_from !== after.effective_from) {
      lines.push(`Effective from ${day(before.effective_from)} → ${day(after.effective_from)}`);
    }
    if (before.structure !== after.structure) {
      lines.push(`Structure ${before.structure ?? "—"} → ${after.structure ?? "—"}`);
    }
    if ((before.reason ?? "") !== (after.reason ?? "")) {
      lines.push(`Reason: ${after.reason || "removed"}`);
    }
    const typedBefore = before.typed_amounts ?? {};
    const typedAfter = after.typed_amounts ?? {};
    for (const code of new Set([...Object.keys(typedBefore), ...Object.keys(typedAfter)])) {
      const was = typedBefore[code];
      const now = typedAfter[code];
      if (was === now) continue;
      if (!was) lines.push(`${nameOf(code)} typed at ${money(now)} a year`);
      else if (!now) lines.push(`${nameOf(code)} back to the structure (was ${money(was)} a year)`);
      else lines.push(`${nameOf(code)} ${money(was)} → ${money(now)} a year`);
    }
    const remarksBefore = before.remarks ?? {};
    const remarksAfter = after.remarks ?? {};
    for (const code of new Set([...Object.keys(remarksBefore), ...Object.keys(remarksAfter)])) {
      if (remarksBefore[code] === remarksAfter[code]) continue;
      lines.push(`${nameOf(code)} remark: ${remarksAfter[code] || "removed"}`);
    }
    if (c.carried_from) lines.push("Carried forward from an earlier revision");
    if (lines.length === 0) lines.push("Saved with no change to the figures");
    return lines;
  }

  if (typeof c.new_ctc === "string") {
    const was = typeof c.old_ctc === "string" ? ` (was ${money(c.old_ctc)})` : "";
    lines.push(`CTC ${money(c.new_ctc)} a year${was}, from ${day(c.effective_from)}`);
    if (typeof c.structure === "string") lines.push(`Structure: ${c.structure}`);
    const typed = (c.typed_amounts as Record<string, string> | undefined) ?? {};
    for (const [code, amount] of Object.entries(typed)) {
      lines.push(`${nameOf(code)} typed at ${money(amount)} a year`);
    }
    if (typeof c.reason === "string" && c.reason) lines.push(`Reason: ${c.reason}`);
    return lines;
  }

  const deleted = c.deleted as Snapshot | undefined;
  if (deleted) {
    lines.push(`Removed: CTC ${money(deleted.ctc_annual)} a year from ${day(deleted.effective_from)}`);
    return lines;
  }
  if (typeof c.attachment_removed === "string") lines.push(`File removed: ${c.attachment_removed}`);
  else if (typeof c.attachment === "string") lines.push(`File: ${c.attachment}`);
  return lines;
}

/** A plain heading for an entry; the audit summary is the fallback. */
function headingOf(entry: SalaryTrailEntry): string {
  const c = entry.changes as Record<string, unknown>;
  const after = c.after as Snapshot | undefined;
  const deleted = c.deleted as Snapshot | undefined;
  if (entry.action === "export") return "File downloaded";
  if (typeof c.attachment_removed === "string") return "File removed";
  if (typeof c.attachment === "string") return "File attached";
  if (deleted) return `Revision from ${day(deleted.effective_from)} deleted`;
  if (after) {
    return c.carried_from
      ? `Revision from ${day(after.effective_from)} updated from an earlier one`
      : `Revision from ${day(after.effective_from)} corrected`;
  }
  if (typeof c.new_ctc === "string") return c.old_ctc ? "Salary revised" : "Salary assigned";
  return entry.summary ?? entry.action;
}

function iconOf(entry: SalaryTrailEntry) {
  const c = entry.changes as Record<string, unknown>;
  if (entry.action === "export") return Download;
  if (entry.action === "delete") return Trash2;
  if ("attachment" in c || "attachment_removed" in c) return Paperclip;
  if (entry.action === "create") return Plus;
  return Pencil;
}

/**
 * Every recorded change to one person's salary, newest first: who did it,
 * when, and what moved. Read from the audit log, so a revision deleted since
 * still shows, as do salaries set by an offer, a promotion or a bulk upload.
 */
export function SalaryTrail({ employeeId, nameOf }: { employeeId: string; nameOf: (code: string) => string }) {
  const trail = useApiQuery<SalaryTrailEntry[]>(`/employees/${employeeId}/salary/trail`);
  const entries = trail.data ?? [];

  return (
    <DataPanel
      title="Change history"
      description="Every change to this person's salary, with who made it."
      isLoading={trail.isLoading && !trail.data}
      error={trail.error?.detail}
      onRetry={trail.reload}
      isEmpty={entries.length === 0}
      empty={{
        icon: History,
        title: "No changes yet",
        description: "Changes appear here once a salary is assigned.",
      }}
    >
      <ol className="relative grid gap-0 px-5 py-4">
        <span aria-hidden className="absolute top-6 bottom-6 left-[37px] w-px bg-border" />
        {entries.map((entry) => {
          const Icon = iconOf(entry);
          const details = describe(entry, nameOf);
          return (
            <li key={entry.id} className="relative flex gap-4 py-3">
              <span
                className={cn(
                  "z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card",
                  entry.action === "delete"
                    ? "bg-destructive/10 text-destructive"
                    : entry.action === "create"
                      ? "bg-mint-100 text-mint-800"
                      : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{headingOf(entry)}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.actor_name ?? "System"} · {formatMoment(entry.at)}
                </p>
                {details.length > 0 && (
                  <ul className="mt-2 grid gap-0.5 text-sm text-foreground">
                    {details.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </DataPanel>
  );
}
