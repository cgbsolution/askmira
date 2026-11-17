"use client";

import { Ban, Paperclip } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import {
  hasAmount,
  isHeld,
  percent,
  SECTION_LABEL,
} from "@/components/payroll/consultant-payouts/labels";
import { apiMessage } from "@/components/payroll/labels";
import { DownloadButton } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { downloadFile, post } from "@/lib/api";
import {
  isFixedMonthlyRow,
  type PayoutBreakdownRow,
  type PayoutLine,
  type PayoutRun,
} from "@/lib/types/consultant-payouts";
import { formatDate, formatMoney } from "@/lib/utils";

/** The rate(s) an entry was priced at: one, or a range when the days differ. */
function rateText(breakdown: PayoutBreakdownRow[]): string {
  const rates = [
    ...new Set(
      breakdown.flatMap((row) =>
        !isFixedMonthlyRow(row) && row.rate !== null ? [row.rate] : [],
      ),
    ),
  ];
  if (rates.length === 0) return "no rate";
  return rates.map((rate) => `${rate}/h`).join(", ");
}

/**
 * A fixed-monthly entry's pricing, each month part as "Fixed monthly ₹X × N/M days",
 * or "No monthly fee for N days" when the entry is held for days without one.
 */
function feeText(breakdown: PayoutBreakdownRow[]): string | null {
  const parts = breakdown.filter(isFixedMonthlyRow);
  if (parts.length === 0) return null;
  const missing = parts.reduce((sum, part) => sum + (part.missing_days ?? 0), 0);
  if (missing > 0) return `No monthly fee for ${missing} day${missing === 1 ? "" : "s"}`;
  const text = parts.flatMap((part) =>
    part.fees.map(
      (at) =>
        `Fixed monthly ${formatMoney(at.fee)} × ${at.days}/${part.days_in_month} days`,
    ),
  );
  return text.length ? text.join("; ") : "no monthly fee";
}

/** The hours entries a line pays: period, hours, rate, amount and the files behind each. */
function LineEntries({ line }: { line: PayoutLine }) {
  if (line.entries.length === 0) return null;
  return (
    <ul className="mt-2 grid gap-1.5 text-xs text-muted-foreground">
      {line.entries.map((entry) => {
        const fee = feeText(entry.breakdown);
        return (
          <li key={entry.id}>
            <span className="text-foreground">
              {formatDate(entry.period_start)} – {formatDate(entry.period_end)}
            </span>
            :{" "}
            {fee !== null
              ? `${entry.hours} h recorded, ${fee}`
              : `${entry.hours} h at ${rateText(entry.breakdown)}`}
            ,{" "}
            <Money value={entry.gross} />
            {entry.attachments.map((file) => (
              <button
                key={file.id}
                type="button"
                className="ml-2 inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
                onClick={() =>
                  downloadFile(
                    `/consultant-hours/${entry.entry_id}/attachments/${file.id}`,
                    file.file_name,
                  ).catch((caught) =>
                    toast.error(
                      apiMessage(caught, "The file could not be downloaded."),
                    ),
                  )
                }
              >
                <Paperclip className="size-3" /> {file.file_name}
              </button>
            ))}
          </li>
        );
      })}
    </ul>
  );
}

/** What to say about a line besides its figures: why it is held or out, how tax came out. */
function LineNotes({ line }: { line: PayoutLine }) {
  return (
    <div className="grid gap-1 text-xs">
      {isHeld(line) && (
        <Badge variant="destructive">
          Held: not in this payout until fixed
        </Badge>
      )}
      {line.excluded_reason && (
        <p className="text-muted-foreground">
          Left out: {line.excluded_reason}
        </p>
      )}
      {line.problems.map((problem) => (
        <p key={problem} className="text-destructive">
          {problem}
        </p>
      ))}
      {line.tds_note && (
        <p className="text-muted-foreground">{line.tds_note}</p>
      )}
    </div>
  );
}

/** The consultants on a run, with what each is paid and why a line is held. */
export function RunLines({
  run,
  onChanged,
}: {
  run: PayoutRun;
  onChanged: (run: PayoutRun) => void;
}) {
  const [excluding, setExcluding] = useState<PayoutLine | null>(null);
  const [reason, setReason] = useState("");
  const draft = run.status === "draft";

  const exclude = async () => {
    if (!excluding) return;
    if (!reason.trim()) {
      toast.error("Say why this consultant is left out.");
      throw new Error("reason");
    }
    try {
      const updated = await post<PayoutRun>(
        `/consultant-payouts/${run.id}/lines/${excluding.id}/exclude`,
        { reason: reason.trim() },
      );
      toast.success(
        "Left out of this run. Their hours entries are free for a later one.",
      );
      onChanged(updated);
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not leave this consultant out."));
      throw caught;
    }
  };

  if (run.lines.length === 0) {
    return (
      <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">
        No consultant has approved, unpaid hours ending by the cut-off. Hours
        approved after this draft was made aren&apos;t in it. Delete this draft
        and start a new one to include them, or pay them in a later run.
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Consultant</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead className="text-right">Gross</TableHead>
            <TableHead className="text-right">GST</TableHead>
            <TableHead>TDS</TableHead>
            <TableHead className="text-right">TDS deducted</TableHead>
            <TableHead className="text-right">Net pay</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {run.lines.map((line) => (
            <TableRow
              key={line.id}
              className={line.excluded ? "opacity-80" : undefined}
            >
              <TableCell className="align-top">
                <Link
                  href={`/people/${line.employee_id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {line.employee_name ?? "Consultant"}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {line.employee_code}
                </p>
                <LineEntries line={line} />
              </TableCell>
              <TableCell className="text-right tabular-nums align-top">
                {line.hours}
              </TableCell>
              <TableCell className="text-right align-top">
                <Money value={line.gross} />
              </TableCell>
              <TableCell className="text-right align-top">
                <Money value={line.gst_amount} />
              </TableCell>
              <TableCell className="align-top text-sm">
                {SECTION_LABEL[line.section] ?? line.section} at{" "}
                {percent(line.tds_rate)}
                <p className="text-xs text-muted-foreground">
                  on <Money value={line.tds_base} />
                </p>
              </TableCell>
              <TableCell className="text-right align-top">
                <Money value={line.tds_amount} />
                {hasAmount(line.tds_carried_out) && (
                  <p className="text-xs text-muted-foreground">
                    TDS carried to next payout:{" "}
                    <Money value={line.tds_carried_out} />
                  </p>
                )}
              </TableCell>
              <TableCell className="text-right font-semibold align-top">
                <Money value={line.net_payable} />
              </TableCell>
              <TableCell className="max-w-xs align-top">
                <LineNotes line={line} />
              </TableCell>
              <TableCell className="align-top">
                <div className="flex justify-end gap-1">
                  {!line.excluded && (
                    <DownloadButton
                      path={`/consultant-payouts/lines/${line.id}/pdf`}
                      fallbackName={`payout-statement-${line.employee_code ?? line.id}.pdf`}
                      label="Statement"
                      variant="ghost"
                    />
                  )}
                  {draft && !line.excluded_reason && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setReason("");
                        setExcluding(line);
                      }}
                    >
                      <Ban /> Leave out
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ConfirmDialog
        open={excluding !== null}
        onOpenChange={(open) => !open && setExcluding(null)}
        title={`Leave ${excluding?.employee_name ?? "this consultant"} out of this run?`}
        description="Their hours entries are freed and can go in a later run."
        confirmLabel="Leave out"
        onConfirm={exclude}
      >
        <FormField htmlFor="exclude-reason" label="Reason">
          <Textarea
            id="exclude-reason"
            value={reason}
            maxLength={500}
            placeholder="For example, waiting for their invoice"
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
      </ConfirmDialog>
    </>
  );
}
