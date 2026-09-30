"use client";

import { ArrowRightLeft, BellRing, Loader2, Pencil, Undo2, UserPlus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/ErrorState";
import { Money } from "@/components/common/Money";
import { PersonCell } from "@/components/common/PersonCell";
import { toastApiError } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { AssetAssignment, AssetCategory, AssetDetail } from "@/lib/types/assets";

import { AssignDialog, ReturnDialog, StatusDialog } from "./AssetActionDialogs";
import { AssetFormDialog, type LocationOption } from "./AssetFormDialog";
import {
  AssetStatusBadge,
  CONDITION_LABELS,
  dayOrDash,
  Fact,
  OutcomeBadge,
  STATUS_TRANSITIONS,
  stampDay,
  todayISO,
} from "./shared";

/** One asset: its details, who holds it, every hand-over it has had, and what HR can do next. */
export function AssetDetailSheet({
  assetId,
  categories,
  locations,
  onClose,
  onChanged,
}: {
  assetId: string | null;
  categories: AssetCategory[];
  locations: LocationOption[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const query = useApiQuery<AssetDetail>(assetId ? `/assets/${assetId}` : null);
  const [dialog, setDialog] = useState<"assign" | "return" | "status" | "edit" | null>(null);
  const [isReminding, setIsReminding] = useState(false);
  const asset = query.data && query.data.id === assetId ? query.data : null;
  const holding = asset?.current_assignment ?? null;

  const changed = () => {
    query.reload();
    onChanged();
  };

  const remind = async (row: AssetAssignment) => {
    setIsReminding(true);
    try {
      await post(`/assets/assignments/${row.id}/remind`);
      toast.success(`Reminder sent to ${row.employee_name ?? "the holder"}`);
      query.reload();
    } catch (caught) {
      toastApiError(caught, "The reminder could not be sent.");
    } finally {
      setIsReminding(false);
    }
  };

  const warrantyLapsed = Boolean(asset?.warranty_until && asset.warranty_until < todayISO());

  return (
    <Sheet open={assetId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {query.error && !asset ? (
          <div className="p-6">
            <SheetHeader className="p-0">
              <SheetTitle>Asset</SheetTitle>
            </SheetHeader>
            <ErrorState message={query.error.detail} onRetry={query.reload} />
          </div>
        ) : !asset ? (
          <div className="space-y-3 p-6">
            <SheetHeader className="p-0">
              <SheetTitle>Loading asset…</SheetTitle>
            </SheetHeader>
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="pr-10">
              <SheetTitle>{asset.name}</SheetTitle>
              <SheetDescription>
                {asset.asset_tag} · {asset.category_name}
              </SheetDescription>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <AssetStatusBadge status={asset.status} />
                <Badge variant="outline">{CONDITION_LABELS[asset.condition]}</Badge>
                {warrantyLapsed && <Badge variant="muted">Out of warranty</Badge>}
              </div>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-6">
              <div className="flex flex-wrap gap-2">
                {asset.status === "in_stock" && (
                  <Button size="sm" onClick={() => setDialog("assign")}>
                    <UserPlus /> Hand over
                  </Button>
                )}
                {holding && (
                  <Button size="sm" onClick={() => setDialog("return")}>
                    <Undo2 /> Receive back
                  </Button>
                )}
                {STATUS_TRANSITIONS[asset.status].length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setDialog("status")}>
                    <ArrowRightLeft /> Change status
                  </Button>
                )}
                {asset.status !== "disposed" && (
                  <Button size="sm" variant="outline" onClick={() => setDialog("edit")}>
                    <Pencil /> Edit details
                  </Button>
                )}
              </div>

              {asset.status_reason && (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                  <span className="text-muted-foreground">Status note: </span>
                  {asset.status_reason}
                </p>
              )}

              {holding && (
                <section className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <PersonCell
                      name={holding.employee_name ?? "Unknown employee"}
                      subtitle={holding.employee_code ?? undefined}
                    />
                    {holding.expected_return_date && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isReminding}
                        onClick={() => void remind(holding)}
                      >
                        {isReminding ? <Loader2 className="animate-spin" /> : <BellRing />}
                        Remind
                      </Button>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Fact label="Handed over">
                      {stampDay(holding.assigned_at)}
                      {holding.assigned_by_name && (
                        <span className="text-muted-foreground"> by {holding.assigned_by_name}</span>
                      )}
                    </Fact>
                    <Fact label="Due back">
                      {holding.expected_return_date ? (
                        <span className="flex items-center gap-2">
                          {dayOrDash(holding.expected_return_date)}
                          {holding.is_overdue && <Badge variant="destructive">Overdue</Badge>}
                        </span>
                      ) : (
                        "Permanent issue"
                      )}
                    </Fact>
                    <Fact label="Acknowledged">
                      {holding.acknowledged_at
                        ? stampDay(holding.acknowledged_at)
                        : holding.requires_acknowledgement
                          ? "Not yet"
                          : "Not needed"}
                    </Fact>
                    <Fact label="Last reminder">{stampDay(holding.return_reminder_sent_at)}</Fact>
                  </dl>
                  {holding.exit_clearance_pending && (
                    <p className="text-xs text-muted-foreground">
                      On this person&apos;s exit checklist. Returning it here signs the item off.
                    </p>
                  )}
                </section>
              )}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Fact label="Serial number">{asset.serial_number ?? "—"}</Fact>
                <Fact label="Make and model">
                  {[asset.make, asset.model].filter(Boolean).join(" ") || "—"}
                </Fact>
                <Fact label="Location">{asset.location_name ?? "—"}</Fact>
                <Fact label="Warranty until">{dayOrDash(asset.warranty_until)}</Fact>
                <Fact label="Purchased">{dayOrDash(asset.purchase_date)}</Fact>
                <Fact label="Purchase cost">
                  {asset.purchase_cost ? <Money value={asset.purchase_cost} /> : "Not recorded"}
                </Fact>
                <Fact label="Vendor">{asset.vendor ?? "—"}</Fact>
                <Fact label="Invoice">{asset.invoice_number ?? "—"}</Fact>
                <Fact label="Book value today" className="col-span-2">
                  {asset.book_value ? (
                    <>
                      <Money value={asset.book_value} className="font-medium" />
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {asset.book_value_basis}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      No purchase cost recorded, so there is no book value.
                    </span>
                  )}
                </Fact>
                {asset.specs && (
                  <Fact label="Specification" className="col-span-2">
                    <span className="whitespace-pre-line">{asset.specs}</span>
                  </Fact>
                )}
                {asset.notes && (
                  <Fact label="Notes" className="col-span-2">
                    <span className="whitespace-pre-line">{asset.notes}</span>
                  </Fact>
                )}
              </dl>

              <Separator />

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Hand-over history</h3>
                {asset.history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Never handed over. Each hand-over and return will be listed here.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {asset.history.map((row) => (
                      <li key={row.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {row.employee_name ?? "Unknown employee"}
                              {row.employee_code && (
                                <span className="font-normal text-muted-foreground">
                                  {" "}
                                  · {row.employee_code}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {stampDay(row.assigned_at)} –{" "}
                              {row.closed_at ? stampDay(row.closed_at) : "now"}
                            </p>
                          </div>
                          <OutcomeBadge outcome={row.outcome} />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Out {CONDITION_LABELS[row.condition_out].toLowerCase()}
                          {row.condition_in &&
                            ` · back ${CONDITION_LABELS[row.condition_in].toLowerCase()}`}
                          {row.returned_to_name && ` · received by ${row.returned_to_name}`}
                        </p>
                        {row.return_notes && (
                          <p className="mt-1 text-sm text-foreground">{row.return_notes}</p>
                        )}
                        {row.recovery_amount && (
                          <p className="mt-1 text-sm">
                            <span className="text-muted-foreground">To recover: </span>
                            <Money value={row.recovery_amount} className="font-medium" />
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <AssignDialog
              asset={asset}
              open={dialog === "assign"}
              onOpenChange={(open) => !open && setDialog(null)}
              onDone={changed}
            />
            {holding && (
              <ReturnDialog
                assignment={holding}
                open={dialog === "return"}
                onOpenChange={(open) => !open && setDialog(null)}
                onDone={changed}
              />
            )}
            <StatusDialog
              asset={asset}
              open={dialog === "status"}
              onOpenChange={(open) => !open && setDialog(null)}
              onDone={changed}
            />
            <AssetFormDialog
              open={dialog === "edit"}
              onOpenChange={(open) => !open && setDialog(null)}
              asset={asset}
              categories={categories}
              locations={locations}
              onSaved={changed}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
