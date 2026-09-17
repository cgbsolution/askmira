"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type { ExpenseReport, ReportSubmitInput } from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";

import { errorDetail, formatMoney, humanizeKey } from "./shared";

/**
 * Submit every line of a report together.
 *
 * Lines over their limit need a written reason each; a line the policy blocks
 * makes the server refuse the whole report, and its reason is shown as sent.
 */
export function ReportSubmitDialog({
  report,
  currency,
  onOpenChange,
  onSubmitted,
}: {
  report: ExpenseReport | null;
  currency: string;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}) {
  const [justifications, setJustifications] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const needing = (report?.lines ?? []).filter((line) => line.policy_verdict === "needs_justification");

  useEffect(() => {
    if (!report) return;
    setError(null);
    setJustifications(
      Object.fromEntries(
        report.lines
          .filter((line) => line.policy_verdict === "needs_justification")
          .map((line) => [line.id, line.justification ?? ""]),
      ),
    );
  }, [report]);

  const submit = async () => {
    if (!report) return;
    if (report.lines.length === 0) {
      setError("This report has no claims yet. Add a claim and pick this report first.");
      return;
    }
    const missing = needing.find((line) => !(justifications[line.id] ?? "").trim());
    if (missing) {
      setError(`Write a justification for ${humanizeKey(missing.category_key)} on ${formatDay(missing.incurred_on)}.`);
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const body: ReportSubmitInput = {
        justifications: Object.fromEntries(
          needing.map((line) => [line.id, (justifications[line.id] ?? "").trim()]),
        ),
      };
      await post<ExpenseReport>(`/expenses/reports/${report.id}/submit`, body);
      toast.success(`Report "${report.title}" submitted`);
      onOpenChange(false);
      onSubmitted();
    } catch (caught) {
      setError(errorDetail(caught, "Could not submit the report."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={report !== null} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit {report?.title}</DialogTitle>
          <DialogDescription>
            {report &&
              `${report.line_count} ${report.line_count === 1 ? "claim" : "claims"}, ${formatMoney(
                report.total_amount,
                currency,
              )}. All lines are submitted together.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {report && report.blocked_lines > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                {report.blocked_lines} {report.blocked_lines === 1 ? "line is" : "lines are"} blocked by
                policy. The report will be refused until {report.blocked_lines === 1 ? "it is" : "they are"}{" "}
                cancelled.
              </span>
            </div>
          )}

          {needing.length === 0 ? (
            <p className="text-sm text-muted-foreground">No line needs a justification.</p>
          ) : (
            needing.map((line) => (
              <div key={line.id} className="grid gap-1.5">
                <Label htmlFor={`justify-${line.id}`}>
                  {humanizeKey(line.category_key)}, {formatDay(line.incurred_on)},{" "}
                  <span className="tabular-nums">{formatMoney(line.amount, currency)}</span>
                </Label>
                <p className="text-xs text-muted-foreground">{line.verdict_message}</p>
                <Textarea
                  id={`justify-${line.id}`}
                  rows={2}
                  maxLength={2000}
                  value={justifications[line.id] ?? ""}
                  onChange={(event) =>
                    setJustifications((current) => ({ ...current, [line.id]: event.target.value }))
                  }
                  placeholder="Why this was over the limit"
                />
              </div>
            ))
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isSaving} onClick={() => void submit()}>
            {isSaving && <Loader2 className="animate-spin" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
