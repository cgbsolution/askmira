"use client";

import { Ban } from "lucide-react";
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
import { post } from "@/lib/api";
import type { PayoutLine, PayoutRun } from "@/lib/types/consultant-payouts";
import { formatDay } from "@/lib/utils";

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
      {line.weeks.length > 0 && (
        <p className="text-muted-foreground">
          Weeks of{" "}
          {line.weeks.map((week) => formatDay(week.week_start)).join(", ")}
        </p>
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
        "Left out of this run. Their weeks are free for a later one.",
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
        No consultant has an approved, unpaid week ending by the cut-off.
        Approved weeks appear here after Recalculate; an older week can be added
        with Add an older week.
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
        description="Their weeks are freed and can go in a later run."
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
