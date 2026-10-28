"use client";

import { FileUp, Loader2, Plus, Scale } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import { parseCsv } from "@/lib/csv";
import type { ImportResult, ReconciliationRun } from "@/lib/types/rewards";
import { formatDate, toISODate } from "@/lib/utils";
import { MonthPicker } from "@/components/common/MonthPicker";
import { FileInput } from "@/components/ui/file-input";

function detail(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/**
 * Partner reconciliation: does what the partner invoiced match what people
 * redeemed? The partner's fulfilment and invoice files are read in the browser
 * and sent as rows; the API validates each row and says which it skipped.
 */
export function ReconciliationTab() {
  const { data, error, isLoading, reload } = useApiQuery<ReconciliationRun[]>("/rewards/reconciliations");
  const [importing, setImporting] = useState(false);
  const [running, setRunning] = useState(false);

  return (
    <>
      <DataPanel
        title="Reconciliation runs"
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setImporting(true)}>
              <FileUp /> Import partner files
            </Button>
            <Button size="sm" onClick={() => setRunning(true)}>
              <Plus /> Reconcile a month
            </Button>
          </>
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data ?? []).length === 0}
        empty={{ icon: Scale, title: "No reconciliations yet", description: "Import the partner's files, then reconcile the month." }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Redeemed</TableHead>
              <TableHead className="text-right">Invoiced</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{row.period_label}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.redemption_count} redemptions · {row.fulfilment_count} fulfilments · {row.invoice_line_count} invoice lines · run{" "}
                    {formatDate(row.run_on)}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.redeemed_value} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.invoiced_value} />
                </TableCell>
                <TableCell>
                  {row.status === "clean" ? (
                    <Badge variant="success">Matches</Badge>
                  ) : (
                    <>
                      <Badge variant="warning">
                        {row.gap_count} gap{row.gap_count === 1 ? "" : "s"}
                      </Badge>
                      <ul className="mt-1 max-w-sm text-xs text-muted-foreground">
                        {row.gaps.slice(0, 5).map((gap, index) => (
                          <li key={index}>
                            {gap.kind.replaceAll("_", " ")}
                            {gap.detail ? `: ${gap.detail}` : ""}
                          </li>
                        ))}
                        {row.gaps.length > 5 && <li>and {row.gaps.length - 5} more</li>}
                      </ul>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
      <ImportDialog open={importing} onOpenChange={setImporting} />
      <RunDialog open={running} onOpenChange={setRunning} onDone={reload} />
    </>
  );
}

function blank(value: string | undefined): string | null {
  return value && value.trim() !== "" ? value.trim() : null;
}

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [fulfilments, setFulfilments] = useState<Record<string, string>[]>([]);
  const [invoices, setInvoices] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setFulfilments([]);
      setInvoices([]);
      setResult(null);
    }
  }, [open]);

  const read = async (file: File | undefined, set: (rows: Record<string, string>[]) => void) => {
    if (!file) return;
    try {
      set(parseCsv(await file.text()));
    } catch {
      toast.error("That file could not be read as CSV.");
    }
  };

  const submit = async () => {
    setIsBusy(true);
    try {
      const outcome = await post<ImportResult>("/rewards/partner-imports", {
        fulfilments: fulfilments.map((row) => ({
          redemption_id: blank(row.redemption_id),
          external_redemption_ref: blank(row.external_redemption_ref),
          order_id: row.order_id,
          item_sku: blank(row.item_sku),
          status: row.status,
          fulfilled_on: blank(row.fulfilled_on),
        })),
        invoice_lines: invoices.map((row) => ({
          order_id: row.order_id,
          amount: row.amount,
          item_sku: blank(row.item_sku),
          invoice_ref: blank(row.invoice_ref),
          invoiced_on: row.invoiced_on,
        })),
      });
      setResult(outcome);
    } catch (caught) {
      toast.error(detail(caught, "The import was refused."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import partner files</DialogTitle>
          <DialogDescription>
            CSV with a header row. Fulfilments: order_id, status, and redemption_id or external_redemption_ref, plus
            item_sku and fulfilled_on if present. Invoice lines: order_id, amount, invoiced_on, plus item_sku and
            invoice_ref if present.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <>
            <Alert variant={result.fulfilments_skipped.length ? "warning" : "success"}>
              <AlertTitle>
                {result.fulfilments_imported} fulfilments and {result.invoice_lines_imported} invoice lines imported
              </AlertTitle>
              <AlertDescription>
                {result.fulfilments_skipped.length > 0 && (
                  <ul className="list-disc pl-5">
                    {result.fulfilments_skipped.slice(0, 10).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-1">{result.note}</p>
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="grid gap-4">
              <FormField htmlFor="import-fulfilments" label="Fulfilment file" optional hint={fulfilments.length ? `${fulfilments.length} rows read` : undefined}>
                <FileInput id="import-fulfilments" accept=".csv,text/csv" onChange={(e) => read(e.target.files?.[0], setFulfilments)} />
              </FormField>
              <FormField htmlFor="import-invoices" label="Invoice file" optional hint={invoices.length ? `${invoices.length} rows read` : undefined}>
                <FileInput id="import-invoices" accept=".csv,text/csv" onChange={(e) => read(e.target.files?.[0], setInvoices)} />
              </FormField>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={isBusy || (fulfilments.length === 0 && invoices.length === 0)}>
                {isBusy && <Loader2 className="animate-spin" />} Import
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RunDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const [month, setMonth] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = new Date();
    const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    setMonth(`${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`);
  }, [open]);

  const submit = async () => {
    const [year, mon] = month.split("-").map(Number);
    setIsBusy(true);
    try {
      await post("/rewards/reconciliations", {
        period_label: month,
        period_start: toISODate(new Date(year, mon - 1, 1)),
        period_end: toISODate(new Date(year, mon, 0)),
      });
      toast.success(`${month} reconciled.`);
      onDone();
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "The reconciliation did not run."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reconcile a month</DialogTitle>
          <DialogDescription>Matches redemptions against the partner&apos;s fulfilments and invoices for the month.</DialogDescription>
        </DialogHeader>
        <FormField htmlFor="reconcile-month" label="Month">
          <MonthPicker id="reconcile-month" value={month} onChange={setMonth} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)}>
            {isBusy && <Loader2 className="animate-spin" />} Reconcile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
