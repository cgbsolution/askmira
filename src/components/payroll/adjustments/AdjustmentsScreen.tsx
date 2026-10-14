"use client";

import { HandCoins, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { PersonCell } from "@/components/common/PersonCell";
import { apiMessage, periodLabel } from "@/components/payroll/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { Page } from "@/lib/types";
import type { Adjustment, AdjustmentStatus } from "@/lib/types/payroll-inputs";
import { formatDate } from "@/lib/utils";

import { ImportAdjustmentsDialog } from "./ImportAdjustmentsDialog";
import { CATEGORY_LABEL, STATUS_LABEL } from "./labels";
import { NewAdjustmentDialog } from "./NewAdjustmentDialog";

function windowLabel(row: Adjustment): string {
  const start = periodLabel(row.start_year, row.start_month);
  if (row.recurrence === "one_time") return `Once, ${start}`;
  const end = row.end_year && row.end_month ? periodLabel(row.end_year, row.end_month) : "no end";
  return `Monthly, ${start} – ${end}`;
}

/** Ad-hoc earnings and deductions: keyed in by payroll, approved by another admin. */
export function AdjustmentsScreen() {
  const { hasRole } = useAuth();
  const [status, setStatus] = useState<AdjustmentStatus | "any">("pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const query = useApiQuery<Page<Adjustment>>(
    `/payroll/adjustments?page_size=200${status === "any" ? "" : `&status=${status}`}`,
  );
  const rows = query.data?.items ?? [];

  return (
    <>
      <DataPanel
        title="Adjustments"
        description="Incentives, one-off bonuses, recoveries and court attachments outside the salary structure. A run pays each one once, after a second admin approves it."
        actions={
          <div className="flex flex-wrap gap-2">
            <ImportAdjustmentsDialog onImported={query.reload} />
            <NewAdjustmentDialog onCreated={query.reload} />
          </div>
        }
        toolbar={
          <Select value={status} onValueChange={(v) => setStatus(v as AdjustmentStatus | "any")}>
            <SelectTrigger size="sm" className="w-48" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any status</SelectItem>
              {(Object.keys(STATUS_LABEL) as AdjustmentStatus[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {STATUS_LABEL[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        isLoading={query.isLoading}
        error={query.error?.detail}
        onRetry={query.reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: HandCoins,
          title: status === "pending" ? "Nothing awaiting approval" : "No adjustments here",
          description: "Key one in, or import a spreadsheet of incentives.",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Adjustment</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <PersonCell
                    name={row.employee_name ?? "Unknown"}
                    subtitle={row.employee_code}
                    size="sm"
                  />
                </TableCell>
                <TableCell>
                  <span className="font-medium text-foreground">{row.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {CATEGORY_LABEL[row.category]} · {row.kind === "earning" ? "earning" : "deduction"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.amount} />
                  {row.total_cap && (
                    <span className="block text-xs text-muted-foreground">
                      <Money value={row.amount_applied} /> of <Money value={row.total_cap} />
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{windowLabel(row)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_LABEL[row.status].variant}>
                    {STATUS_LABEL[row.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setOpenId(row.id)}>
                    {row.caller_may_decide ? "Review" : "View"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
      <AdjustmentSheet
        adjustmentId={openId}
        canCancel={hasRole("admin", "sub_admin")}
        onClose={() => setOpenId(null)}
        onChanged={query.reload}
      />
    </>
  );
}

function AdjustmentSheet({
  adjustmentId,
  canCancel,
  onClose,
  onChanged,
}: {
  adjustmentId: string | null;
  canCancel: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const detail = useApiQuery<Adjustment>(
    adjustmentId ? `/payroll/adjustments/${adjustmentId}` : null,
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const row = detail.data;

  const act = async (action: "approve" | "reject" | "cancel") => {
    if (!row) return;
    if (action === "reject" && note.trim().length < 3) {
      toast.error("Say why it is rejected.");
      return;
    }
    setBusy(action);
    try {
      await post(`/payroll/adjustments/${row.id}/${action}`, { note: note.trim() || null });
      toast.success(
        action === "approve" ? "Approved." : action === "reject" ? "Rejected." : "Cancelled.",
      );
      setNote("");
      detail.reload();
      onChanged();
    } catch (caught) {
      toast.error(apiMessage(caught, "That did not work."));
    } finally {
      setBusy(null);
    }
  };

  const facts: [string, React.ReactNode][] = row
    ? [
        ["Employee", `${row.employee_name ?? "Unknown"} (${row.employee_code ?? "—"})`],
        ["Type", `${CATEGORY_LABEL[row.category]} — ${row.kind}`],
        ["Amount", <Money key="a" value={row.amount} />],
        ["When", windowLabel(row)],
        ...(row.total_cap
          ? ([["Total cap", <Money key="c" value={row.total_cap} />]] as [string, React.ReactNode][])
          : []),
        ["Paid so far", <Money key="p" value={row.amount_applied} />],
        ...(row.kind === "earning"
          ? ([
              ["Taxable", row.taxable ? "Yes" : "No"],
              ["Counts as wages (ESI, PT)", row.counts_as_wages ? "Yes" : "No"],
            ] as [string, React.ReactNode][])
          : ([["Only when net pay allows", row.within_net_pay ? "Yes" : "No"]] as [
              string,
              React.ReactNode,
            ][])),
        ...(row.reference ? ([["Reference", row.reference]] as [string, React.ReactNode][]) : []),
        ["Reason", row.reason],
        ["Keyed in by", `${row.created_by_name ?? "—"} on ${formatDate(row.created_at)}`],
        ...(row.decided_at
          ? ([
              [
                "Decided by",
                `${row.decided_by_name ?? "—"} on ${formatDate(row.decided_at)}${
                  row.decision_note ? ` — “${row.decision_note}”` : ""
                }`,
              ],
            ] as [string, React.ReactNode][])
          : []),
      ]
    : [];

  return (
    <Sheet open={adjustmentId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pr-10">
          <SheetTitle>{row?.name ?? "Adjustment"}</SheetTitle>
          <SheetDescription>
            {row ? STATUS_LABEL[row.status].label : "Loading…"}
          </SheetDescription>
        </SheetHeader>
        {row && (
          <div className="grid gap-4 px-4">
            <dl className="grid gap-2 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="grid grid-cols-3 gap-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="col-span-2 text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            {row.applications.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-foreground">Paid by</p>
                <ul className="grid gap-1 text-sm text-muted-foreground">
                  {row.applications.map((app) => (
                    <li key={app.run_id}>
                      {periodLabel(app.period_year, app.period_month)} run — <Money value={app.amount} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(row.caller_may_decide || (canCancel && (row.status === "pending" || row.status === "approved"))) && (
              <FormField htmlFor="adj-note" label="Note" optional={!row.caller_may_decide}>
                <Textarea
                  id="adj-note"
                  rows={2}
                  value={note}
                  maxLength={1000}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Required to reject"
                />
              </FormField>
            )}
          </div>
        )}
        <SheetFooter className="flex-row flex-wrap justify-end gap-2">
          {row && canCancel && (row.status === "pending" || row.status === "approved") && (
            <Button variant="outline" disabled={busy !== null} onClick={() => void act("cancel")}>
              {busy === "cancel" && <Loader2 className="animate-spin" />}
              Cancel adjustment
            </Button>
          )}
          {row?.caller_may_decide && (
            <>
              <Button variant="outline" disabled={busy !== null} onClick={() => void act("reject")}>
                {busy === "reject" && <Loader2 className="animate-spin" />}
                Reject
              </Button>
              <Button disabled={busy !== null} onClick={() => void act("approve")}>
                {busy === "approve" && <Loader2 className="animate-spin" />}
                Approve
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
