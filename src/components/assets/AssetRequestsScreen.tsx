"use client";

import { Check, ClipboardList, Loader2, PackageCheck, X } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { apiErrorMessage, InlineProblem } from "@/components/payroll-ops/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { AssetCondition, AssetPage, AssetRequest } from "@/lib/types/assets";

import {
  CONDITION_LABELS,
  dayOrDash,
  QueryPanel,
  RequestStatusBadge,
  stampDay,
  todayISO,
  useAssetRoles,
} from "./shared";

type View = "pending" | "approved" | "all";

/**
 * Asset requests from the caller's reporting line (a manager) or everybody
 * (HR) — never their own. Managers and HR decide; HR hands over an asset.
 */
export function AssetRequestsScreen() {
  const { isHr } = useAssetRoles();
  const [view, setView] = useState<View>("pending");
  const [deciding, setDeciding] = useState<{ row: AssetRequest; approve: boolean } | null>(null);
  const [fulfilling, setFulfilling] = useState<AssetRequest | null>(null);

  const query = useApiQuery<AssetRequest[]>(
    view === "all" ? "/assets/requests?scope=review" : `/assets/requests?scope=review&status=${view}`,
  );

  const emptyText: Record<View, { title: string; description: string }> = {
    pending: {
      title: "Nothing to decide",
      description: isHr
        ? "No asset request is waiting for a decision."
        : "Nobody in your reporting line has an asset request waiting.",
    },
    approved: {
      title: "Nothing to hand over",
      description: "Approved requests appear here until an asset is handed over against them.",
    },
    all: {
      title: "No asset requests yet",
      description: isHr
        ? "Requests employees raise under My assets appear here."
        : "Requests from your reporting line appear here.",
    },
  };

  return (
    <PageShell
      title="Asset requests"
      description={
        isHr
          ? "Decide what people have asked for, and hand over an asset from stock."
          : "Decide what people in your reporting line have asked for."
      }
    >
      <Tabs value={view} onValueChange={(value) => setView(value as View)}>
        <TabsList>
          <TabsTrigger value="pending">To decide</TabsTrigger>
          {isHr && <TabsTrigger value="approved">To hand over</TabsTrigger>}
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={view} className="mt-4">
          <QueryPanel
            query={query}
            isEmpty={(rows) => rows.length === 0}
            empty={{ icon: ClipboardList, ...emptyText[view] }}
          >
            {(rows) => (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Asked for</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Needed by</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">
                            {row.employee_name ?? "Unknown employee"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.employee_code} · asked {stampDay(row.created_at)}
                          </p>
                        </TableCell>
                        <TableCell>{row.category_name}</TableCell>
                        <TableCell className="max-w-xs whitespace-normal text-sm">
                          {row.reason}
                          {row.decision_note && (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {row.decided_by_name}: {row.decision_note}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {dayOrDash(row.needed_by)}
                        </TableCell>
                        <TableCell>
                          <RequestStatusBadge status={row.status} />
                          {row.fulfilled_asset_tag && (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {row.fulfilled_asset_tag}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {row.can_decide && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDeciding({ row, approve: false })}
                                >
                                  <X /> Reject
                                </Button>
                                <Button size="sm" onClick={() => setDeciding({ row, approve: true })}>
                                  <Check /> Approve
                                </Button>
                              </>
                            )}
                            {row.can_fulfil && (
                              <Button size="sm" variant="accent" onClick={() => setFulfilling(row)}>
                                <PackageCheck /> Hand over
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </QueryPanel>
        </TabsContent>
      </Tabs>

      <DecisionDialog
        decision={deciding}
        onClose={() => setDeciding(null)}
        onDone={query.reload}
      />
      <FulfilDialog request={fulfilling} onClose={() => setFulfilling(null)} onDone={query.reload} />
    </PageShell>
  );
}

function DecisionDialog({
  decision,
  onClose,
  onDone,
}: {
  decision: { row: AssetRequest; approve: boolean } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setNote("");
    setTouched(false);
    setError(null);
  }, [decision]);

  if (!decision) return null;
  const { row, approve } = decision;
  const missing = !approve && !note.trim();

  const submit = async () => {
    setTouched(true);
    if (missing) return;
    setIsBusy(true);
    setError(null);
    try {
      await post<AssetRequest>(`/assets/requests/${row.id}/${approve ? "approve" : "reject"}`, {
        note: note.trim() || null,
      });
      toast.success(approve ? "Request approved" : "Request rejected", {
        description: `${row.employee_name ?? "The requester"} has been told.`,
      });
      onClose();
      onDone();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The decision could not be saved."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isBusy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {approve ? "Approve" : "Reject"} {row.employee_name ?? "this"}&apos;s request
          </DialogTitle>
          <DialogDescription>
            {row.category_name}: {row.reason}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField
            htmlFor="asset-decision-note"
            label={approve ? "Note" : "Reason"}
            optional={approve}
            error={touched && missing ? "Say why — the person who asked will read it." : null}
          >
            <Textarea
              id="asset-decision-note"
              rows={3}
              maxLength={2000}
              value={note}
              disabled={isBusy}
              aria-invalid={touched && missing}
              onChange={(event) => setNote(event.target.value)}
            />
          </FormField>
          {error && <InlineProblem>{error}</InlineProblem>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={approve ? "default" : "destructive"}
            disabled={isBusy}
            onClick={() => void submit()}
          >
            {isBusy && <Loader2 className="animate-spin" />}
            {approve ? "Approve" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FulfilDialog({
  request,
  onClose,
  onDone,
}: {
  request: AssetRequest | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const stock = useApiQuery<AssetPage>(
    request
      ? `/assets?status=in_stock&category_id=${request.category_id}&page_size=200`
      : null,
  );
  const [assetId, setAssetId] = useState("");
  const [dueBack, setDueBack] = useState("");
  const [condition, setCondition] = useState<AssetCondition | "">("");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setAssetId("");
    setDueBack("");
    setCondition("");
    setNotes("");
    setTouched(false);
    setError(null);
  }, [request]);

  if (!request) return null;
  const available = stock.data?.items ?? [];
  const chosen = available.find((asset) => asset.id === assetId);

  const submit = async () => {
    setTouched(true);
    if (!assetId) return;
    setIsBusy(true);
    setError(null);
    try {
      await post<AssetRequest>(`/assets/requests/${request.id}/fulfil`, {
        asset_id: assetId,
        expected_return_date: dueBack || null,
        condition_out: condition || null,
        notes: notes.trim() || null,
      });
      toast.success(`${chosen?.asset_tag ?? "Asset"} handed over`, {
        description: "The request is closed and the employee asked to acknowledge it.",
      });
      onClose();
      onDone();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The asset could not be handed over."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isBusy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hand over a {request.category_name.toLowerCase()}</DialogTitle>
          <DialogDescription>
            To {request.employee_name ?? "the requester"}
            {request.status === "pending" && ". Handing it over approves the request too"}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {stock.isLoading && !stock.data ? (
            <Skeleton className="h-10 w-full" />
          ) : stock.error ? (
            <InlineProblem>{stock.error.detail}</InlineProblem>
          ) : available.length === 0 ? (
            <InlineProblem>
              No {request.category_name.toLowerCase()} is in stock.{" "}
              <Link href="/assets/inventory" className="underline underline-offset-2">
                Add one to the register
              </Link>{" "}
              or take one back, then hand it over here.
            </InlineProblem>
          ) : (
            <FormField
              htmlFor="fulfil-asset"
              label="Asset from stock"
              required
              error={touched && !assetId ? "Choose the asset to hand over." : null}
            >
              <Select value={assetId} disabled={isBusy} onValueChange={setAssetId}>
                <SelectTrigger id="fulfil-asset" className="w-full" aria-invalid={touched && !assetId}>
                  <SelectValue placeholder="Choose an asset" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.asset_tag} · {asset.name} ({CONDITION_LABELS[asset.condition]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
          <FormField htmlFor="fulfil-due" label="Expected back" optional>
            <DatePicker
              id="fulfil-due"
              value={dueBack}
              min={todayISO()}
              disabled={isBusy}
              onChange={setDueBack}
            />
          </FormField>
          <FormField
            htmlFor="fulfil-condition"
            label="Condition at hand-over"
            optional
            hint="Leave as recorded to keep the register's condition."
          >
            <Select
              value={condition}
              disabled={isBusy}
              onValueChange={(value) => setCondition(value as AssetCondition)}
            >
              <SelectTrigger id="fulfil-condition" className="w-full">
                <SelectValue placeholder="As recorded" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CONDITION_LABELS) as AssetCondition[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {CONDITION_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="fulfil-notes" label="Notes" optional>
            <Textarea
              id="fulfil-notes"
              rows={2}
              maxLength={2000}
              value={notes}
              disabled={isBusy}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>
          {error && <InlineProblem>{error}</InlineProblem>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isBusy || available.length === 0} onClick={() => void submit()}>
            {isBusy && <Loader2 className="animate-spin" />}
            Hand over
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
