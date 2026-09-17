"use client";

import { AlertTriangle, CheckCircle2, FileText, Loader2, Pause, Play, RefreshCw } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import {
  dayOrDash,
  EXIT_TYPE_LABELS,
  Fact,
  personLabel,
  ReasonDialog,
  SETTLEMENT_STATUS_LABELS,
  SettlementStatusBadge,
  timestampOrDash,
  useExitRoles,
} from "@/components/exits/common";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Money } from "@/components/common/Money";
import { DownloadButton, QueryBoundary, toastApiError } from "@/components/payroll-ops/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { IssuedDocument, Settlement, SettlementLine } from "@/lib/types/payroll-ops";

const LINE_GROUPS: { type: SettlementLine["line_type"]; title: string; total: keyof Settlement }[] =
  [
    { type: "earning", title: "Earnings", total: "total_earnings" },
    { type: "recovery", title: "Recoveries", total: "total_recoveries" },
    { type: "tax", title: "Tax", total: "total_tax" },
  ];

/** "-1234.50" → "1234.50", without parsing. */
function withoutSign(amount: string): string {
  return amount.trim().replace(/^-/, "");
}

/**
 * One settlement as an itemised statement, with the approval actions.
 * Nobody approves or holds their own settlement; the server refuses it too.
 */
export function SettlementSheet({
  exitId,
  onClose,
  onChanged,
  onRecompute,
}: {
  exitId: string | null;
  onClose: () => void;
  onChanged: () => void;
  onRecompute: (exitId: string, employeeLabel: string) => void;
}) {
  const query = useApiQuery<Settlement>(exitId ? `/exits/${exitId}/settlement` : null);
  const lines = useApiQuery<SettlementLine[]>(exitId ? `/exits/${exitId}/settlement/lines` : null);
  const settlement = query.data && query.data.exit_record_id === exitId ? query.data : null;

  const reloadAll = () => {
    query.reload();
    lines.reload();
    onChanged();
  };

  return (
    <Sheet open={exitId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>
            {settlement
              ? personLabel(settlement.employee_name, settlement.employee_code)
              : "Full & final settlement"}
          </SheetTitle>
          <SheetDescription>
            {settlement
              ? `${settlement.exit_type ? (EXIT_TYPE_LABELS[settlement.exit_type] ?? settlement.exit_type) : "Exit"} · last working day ${dayOrDash(settlement.last_working_day)}`
              : "Loading the settlement."}
          </SheetDescription>
        </SheetHeader>
        {query.error?.status === 404 ? (
          <EmptyState
            icon={FileText}
            title="Not computed yet"
            description="No settlement has been computed for this exit."
          />
        ) : (
          <QueryBoundary query={{ ...query, data: settlement }} skeletonRows={6}>
            {(data) => (
              <SettlementDetail
                settlement={data}
                lines={lines}
                onChanged={reloadAll}
                onRecompute={() =>
                  onRecompute(data.exit_record_id, personLabel(data.employee_name, data.employee_code))
                }
              />
            )}
          </QueryBoundary>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SettlementDetail({
  settlement,
  lines,
  onChanged,
  onRecompute,
}: {
  settlement: Settlement;
  lines: ReturnType<typeof useApiQuery<SettlementLine[]>>;
  onChanged: () => void;
  onRecompute: () => void;
}) {
  const { isHr, isAdmin, ownEmployeeId } = useExitRoles();
  const [dialog, setDialog] = useState<"approve" | "hold" | "release" | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);

  const isOwn = ownEmployeeId !== null && settlement.employee_id === ownEmployeeId;
  const status = settlement.status;
  const canApprove = isAdmin && !isOwn && (status === "draft" || status === "pending_approval");
  const canHold =
    isAdmin && !isOwn && (status === "draft" || status === "pending_approval" || status === "approved");
  const canRelease = isAdmin && !isOwn && status === "on_hold";
  // Approval waits for a hold to be released; recomputing is allowed until approval.
  const canRecompute =
    isHr && !isOwn && (status === "draft" || status === "pending_approval" || status === "on_hold");
  const canIssueStatement = isHr && !isOwn && !settlement.statement_letter_id;
  const net = formatMoney(withoutSign(settlement.net_amount));

  const issueStatement = async () => {
    setIsIssuing(true);
    try {
      const doc = await post<IssuedDocument>(`/exits/settlements/${settlement.id}/statement`);
      toast.success(`Statement ${doc.reference_number} issued`, {
        description: "It is in Documents with the employee's other letters.",
      });
      onChanged();
    } catch (caught) {
      toastApiError(caught, "The statement could not be issued.");
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      {isOwn && (
        <Alert>
          <AlertDescription>
            This is your own settlement. It is approved by someone else.
          </AlertDescription>
        </Alert>
      )}

      {status === "on_hold" && (
        <Alert variant="warning">
          <Pause />
          <AlertTitle>On hold</AlertTitle>
          <AlertDescription>
            <p>{settlement.hold_reason ?? "No hold reason was recorded."}</p>
          </AlertDescription>
        </Alert>
      )}

      <Card tier="tier1">
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SettlementStatusBadge status={status} />
          </div>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
            <Fact label="Computed">{timestampOrDash(settlement.computed_at)}</Fact>
            <Fact label="Approved">{timestampOrDash(settlement.approved_at)}</Fact>
            <Fact label="Paid">{timestampOrDash(settlement.paid_at)}</Fact>
          </dl>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            {canApprove && (
              <Button size="sm" onClick={() => setDialog("approve")}>
                <CheckCircle2 /> Approve
              </Button>
            )}
            {canHold && (
              <Button variant="outline" size="sm" onClick={() => setDialog("hold")}>
                <Pause /> Put on hold
              </Button>
            )}
            {canRelease && (
              <Button variant="outline" size="sm" onClick={() => setDialog("release")}>
                <Play /> Release hold
              </Button>
            )}
            {canRecompute && (
              <Button variant="outline" size="sm" onClick={onRecompute}>
                <RefreshCw /> Recompute
              </Button>
            )}
            {canIssueStatement && (
              <Button
                variant="outline"
                size="sm"
                disabled={isIssuing}
                onClick={() => void issueStatement()}
              >
                {isIssuing ? <Loader2 className="animate-spin" /> : <FileText />}
                Issue statement
              </Button>
            )}
            {settlement.statement_letter_id && (
              <DownloadButton
                path={`/exits/settlements/${settlement.id}/statement/pdf`}
                fallbackName={`settlement-statement-${settlement.employee_code ?? settlement.id}.pdf`}
                label="Statement PDF"
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card tier="tier1" className="gap-0">
        <CardHeader className="pb-4">
          <CardTitle>Itemised statement</CardTitle>
        </CardHeader>
        <QueryBoundary query={lines} skeletonRows={5}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No statement lines"
                description="The settlement has no line items."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item and basis</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                {LINE_GROUPS.map((group) => {
                  const groupRows = rows
                    .filter((row) => row.line_type === group.type)
                    .sort((a, b) => a.display_order - b.display_order);
                  return (
                    <TableBody key={group.type}>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell className="font-semibold text-foreground">{group.title}</TableCell>
                        <TableCell />
                      </TableRow>
                      {groupRows.length === 0 ? (
                        <TableRow>
                          <TableCell className="text-sm text-muted-foreground">None</TableCell>
                          <TableCell />
                        </TableRow>
                      ) : (
                        groupRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="whitespace-normal">
                              <span className="block text-foreground">{row.label}</span>
                              <span className="block text-xs text-muted-foreground">
                                {row.basis}
                                {row.source && ` · from ${row.source}`}
                              </span>
                            </TableCell>
                            <TableCell className="text-right align-top">
                              <Money value={row.amount} />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      <TableRow>
                        <TableCell className="text-sm text-muted-foreground">
                          Total {group.title.toLowerCase()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <Money value={settlement[group.total] as string} />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  );
                })}
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold text-foreground">
                      {settlement.is_demand ? "Net demand on the employee" : "Net payable to the employee"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <Money value={settlement.net_amount} />
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )
          }
        </QueryBoundary>
      </Card>

      {settlement.is_demand && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>The employee owes the company {net}</AlertTitle>
          <AlertDescription>
            <p>
              Recoveries and tax are more than the earnings. This is a demand on the employee, not
              a zero payout; approving it raises the demand.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <Alert variant="warning">
        <AlertTriangle />
        <AlertTitle>Tax needs review</AlertTitle>
        <AlertDescription>
          <p>
            Tax on the settlement is recomputed from the actual figures and needs Compliance SME
            review before it is relied on.
          </p>
        </AlertDescription>
      </Alert>

      <ConfirmDialog
        open={dialog === "approve"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={settlement.is_demand ? "Approve and raise the demand?" : "Approve for payment?"}
        description={
          settlement.is_demand
            ? `The employee owes the company ${net}. Approving records the demand against them.`
            : `Net ${net} is approved for payment to the employee.`
        }
        confirmLabel="Approve"
        onConfirm={async () => {
          try {
            const result = await post<Settlement>(`/exits/settlements/${settlement.id}/approve`);
            toast.success(`Settlement: ${SETTLEMENT_STATUS_LABELS[result.status] ?? result.status}`);
            onChanged();
          } catch (caught) {
            toastApiError(caught, "The settlement could not be approved.");
            throw caught;
          }
        }}
      />

      <ReasonDialog
        open={dialog === "hold"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Put this settlement on hold?"
        description="Payment and the relieving and experience letters wait until the hold is released. The reason is shown to HR and recorded."
        label="Hold reason"
        confirmLabel="Put on hold"
        onSubmit={async (reason) => {
          await post<Settlement>(`/exits/settlements/${settlement.id}/hold`, { reason });
          toast.success("Settlement put on hold");
          onChanged();
        }}
      />

      <ReasonDialog
        open={dialog === "release"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Release the hold?"
        description={settlement.hold_reason ? `Held because: ${settlement.hold_reason}` : undefined}
        label="Note"
        placeholder="What resolved the hold"
        confirmLabel="Release hold"
        onSubmit={async (note) => {
          await post<Settlement>(`/exits/settlements/${settlement.id}/release-hold`, { note });
          toast.success("Hold released");
          onChanged();
        }}
      />
    </div>
  );
}
