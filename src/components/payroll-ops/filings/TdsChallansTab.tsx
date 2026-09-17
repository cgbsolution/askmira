"use client";

import { CheckCircle2, Link2, Loader2, Plus, Receipt } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { PersonCell } from "@/components/common/PersonCell";
import { RequireRole } from "@/components/common/RequireRole";
import {
  apiErrorMessage,
  InlineProblem,
  isMoneyInput,
  longFinancialYear,
  recentFinancialYears,
} from "@/components/payroll-ops/shared";
import { QueryPanel, useEntityName } from "@/components/payroll-ops/disbursements/common";
import { displayPeriod, fromPaise, toPaise } from "@/components/payroll-ops/filings/labels";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type {
  ChallanMappingInput,
  LegalEntity,
  TdsChallan,
  TdsChallanInput,
  UnmappedTds,
} from "@/lib/types/payroll-ops";
import { formatDay, toISODate } from "@/lib/utils";

const ADMIN = ["tenant_admin", "hr_admin"] as const;

/** TDS deposits (challans) and the payslips whose TDS is not yet tied to one. */
export function TdsChallansTab({ entities }: { entities: LegalEntity[] }) {
  const [fyStart, setFyStart] = useState(String(recentFinancialYears(1)[0]));
  const [quarter, setQuarter] = useState("1");
  const [addOpen, setAddOpen] = useState(false);
  const [mapping, setMapping] = useState<UnmappedTds | null>(null);

  const financialYear = longFinancialYear(Number(fyStart));
  const qs = `financial_year=${encodeURIComponent(financialYear)}&quarter=${quarter}`;
  const challans = useApiQuery<TdsChallan[]>(`/filings/tds-challans?${qs}`);
  const unmapped = useApiQuery<UnmappedTds[]>(`/filings/unmapped-tds?${qs}`);

  const entityName = useEntityName(entities);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={fyStart} onValueChange={setFyStart}>
          <SelectTrigger size="sm" className="w-40" aria-label="Financial year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {recentFinancialYears().map((start) => (
              <SelectItem key={start} value={String(start)}>
                FY {longFinancialYear(start)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={quarter} onValueChange={setQuarter}>
          <SelectTrigger size="sm" className="w-28" aria-label="Quarter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["1", "2", "3", "4"].map((value) => (
              <SelectItem key={value} value={value}>
                Q{value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <RequireRole roles={[...ADMIN]}>
          <Button size="sm" className="ml-auto" onClick={() => setAddOpen(true)}>
            <Plus /> Record a challan
          </Button>
        </RequireRole>
      </div>

      <QueryPanel
        query={unmapped}
        loadingRows={3}
        title="Unmapped TDS"
        description={`Payslips in FY ${financialYear} Q${quarter} whose TDS is not tied to a deposited challan. This list must be empty before the quarter's 24Q can be generated.`}
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: CheckCircle2,
          title: "All TDS in this quarter is mapped",
          description: "Every payslip's TDS is tied to a challan, so nothing here stops a 24Q.",
        }}
      >
        {(rows) => (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">TDS</TableHead>
                      <TableHead className="w-36" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.payslip_id}>
                        <TableCell>
                          <PersonCell
                            size="sm"
                            name={row.employee_name}
                            subtitle={row.employee_code}
                          />
                        </TableCell>
                        <TableCell>{displayPeriod(row.period)}</TableCell>
                        <TableCell className="text-right">
                          <Money value={row.tds_amount} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setMapping(row)}>
                            <Link2 /> Map to challan
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
        )}
      </QueryPanel>

      <QueryPanel
        query={challans}
        loadingRows={3}
        title="Challans"
        description={`TDS deposits recorded for FY ${financialYear} Q${quarter}.`}
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: Receipt,
          title: "No challans recorded for this quarter",
          description:
            "Record each TDS deposit with its BSR code, date and serial number as printed on the challan counterfoil.",
        }}
      >
        {(rows) => (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>BSR code</TableHead>
                      <TableHead>Deposited</TableHead>
                      <TableHead>Serial</TableHead>
                      <TableHead className="hidden md:table-cell">Entity</TableHead>
                      <TableHead className="text-right">TDS</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="tabular-nums">
                          {row.bsr_code}
                          {row.is_book_entry && (
                            <Badge variant="muted" className="ml-2">
                              Book entry
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatDay(row.deposit_date, true)}</TableCell>
                        <TableCell className="tabular-nums">{row.challan_serial}</TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {entityName(row.legal_entity_id)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={row.tds_amount} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={row.total_amount} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
        )}
      </QueryPanel>

      <AddChallanDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        entities={entities}
        financialYear={financialYear}
        quarter={Number(quarter)}
        onCreated={() => {
          challans.reload();
          unmapped.reload();
        }}
      />
      <MapChallanDialog
        row={mapping}
        challans={challans.data ?? []}
        onClose={() => setMapping(null)}
        onMapped={() => {
          setMapping(null);
          unmapped.reload();
        }}
      />
    </div>
  );
}

const PARTS = [
  ["tds_amount", "TDS"],
  ["surcharge", "Surcharge"],
  ["education_cess", "Education cess"],
  ["interest", "Interest"],
  ["late_fee", "Late fee"],
] as const;

type PartKey = (typeof PARTS)[number][0];

function AddChallanDialog({
  open,
  onOpenChange,
  entities,
  financialYear,
  quarter,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: LegalEntity[];
  financialYear: string;
  quarter: number;
  onCreated: () => void;
}) {
  const emptyParts: Record<PartKey, string> = {
    tds_amount: "",
    surcharge: "0",
    education_cess: "0",
    interest: "0",
    late_fee: "0",
  };
  const [entityId, setEntityId] = useState(entities.length === 1 ? entities[0].id : "");
  const [bsr, setBsr] = useState("");
  const [depositDate, setDepositDate] = useState("");
  const [serial, setSerial] = useState("");
  const [parts, setParts] = useState(emptyParts);
  const [total, setTotal] = useState("");
  const [bookEntry, setBookEntry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const partsValid = PARTS.every(([key]) => isMoneyInput(parts[key]));
  const partsSum = partsValid
    ? fromPaise(PARTS.reduce((sum, [key]) => sum + toPaise(parts[key]), BigInt(0)))
    : null;

  const reset = () => {
    setBsr("");
    setDepositDate("");
    setSerial("");
    setParts(emptyParts);
    setTotal("");
    setBookEntry(false);
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!entityId || !bsr.trim() || !depositDate || !serial.trim()) {
      setError("Legal entity, BSR code, deposit date and challan serial are all required.");
      return;
    }
    if (!/^\d{7}$/.test(bsr.trim())) {
      setError("A BSR code is 7 digits.");
      return;
    }
    if (!partsValid || !isMoneyInput(total)) {
      setError("Every amount must be a number with at most two decimals.");
      return;
    }
    if (toPaise(total) !== toPaise(partsSum ?? "0")) {
      setError(`The total must equal the parts, which add up to ${partsSum}.`);
      return;
    }
    const body: TdsChallanInput = {
      legal_entity_id: entityId,
      bsr_code: bsr.trim(),
      deposit_date: depositDate,
      challan_serial: serial.trim(),
      financial_year: financialYear,
      quarter,
      tds_amount: parts.tds_amount.trim(),
      surcharge: parts.surcharge.trim(),
      education_cess: parts.education_cess.trim(),
      interest: parts.interest.trim(),
      late_fee: parts.late_fee.trim(),
      total_amount: total.trim(),
      is_book_entry: bookEntry,
    };
    setIsBusy(true);
    try {
      await post<TdsChallan>("/filings/tds-challans", body);
      toast.success("Challan recorded");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The challan could not be recorded."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isBusy) return;
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Record a TDS challan</DialogTitle>
          <DialogDescription>
            For FY {financialYear} Q{quarter}. Copy the figures exactly as printed on the challan.
          </DialogDescription>
        </DialogHeader>
        <form id="challan-form" className="grid gap-4" onSubmit={(event) => void submit(event)} noValidate>
          <FormField htmlFor="challan-entity" label="Legal entity">
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger id="challan-entity" className="w-full">
                <SelectValue placeholder="Choose an entity" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.name}
                    {entity.tan ? ` · TAN ${entity.tan}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField htmlFor="challan-bsr" label="BSR code">
              <Input
                id="challan-bsr"
                inputMode="numeric"
                maxLength={7}
                required
                value={bsr}
                onChange={(event) => setBsr(event.target.value)}
                className="tabular-nums"
              />
            </FormField>
            <FormField htmlFor="challan-date" label="Deposit date">
              <Input
                id="challan-date"
                type="date"
                required
                max={toISODate(new Date())}
                value={depositDate}
                onChange={(event) => setDepositDate(event.target.value)}
              />
            </FormField>
            <FormField htmlFor="challan-serial" label="Challan serial">
              <Input
                id="challan-serial"
                required
                maxLength={10}
                value={serial}
                onChange={(event) => setSerial(event.target.value)}
                className="tabular-nums"
              />
            </FormField>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {PARTS.map(([key, label]) => (
              <FormField key={key} htmlFor={`challan-${key}`} label={`${label} (₹)`}>
                <Input
                  id={`challan-${key}`}
                  inputMode="decimal"
                  required
                  value={parts[key]}
                  onChange={(event) => setParts({ ...parts, [key]: event.target.value })}
                  aria-invalid={parts[key] !== "" && !isMoneyInput(parts[key])}
                  className="tabular-nums"
                />
              </FormField>
            ))}
            <FormField htmlFor="challan-total" label="Total (₹)">
              <Input
                id="challan-total"
                inputMode="decimal"
                required
                value={total}
                onChange={(event) => setTotal(event.target.value)}
                aria-invalid={
                  total !== "" &&
                  (!isMoneyInput(total) ||
                    (partsSum !== null && toPaise(total) !== toPaise(partsSum)))
                }
                className="tabular-nums"
              />
            </FormField>
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            Parts add up to {partsSum !== null ? `₹${partsSum}` : "— (fix the amounts above)"}. The
            total must match exactly.
          </p>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
            <div>
              <Label htmlFor="challan-book-entry">Book entry</Label>
              <p className="text-xs text-muted-foreground">
                For TDS paid by book adjustment rather than a bank challan.
              </p>
            </div>
            <Switch id="challan-book-entry" checked={bookEntry} onCheckedChange={setBookEntry} />
          </div>
          {error && <InlineProblem>{error}</InlineProblem>}
        </form>
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="challan-form" disabled={isBusy}>
            {isBusy && <Loader2 className="animate-spin" />}
            Record challan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MapChallanDialog({
  row,
  challans,
  onClose,
  onMapped,
}: {
  row: UnmappedTds | null;
  challans: TdsChallan[];
  onClose: () => void;
  onMapped: () => void;
}) {
  const [challanId, setChallanId] = useState("");
  const [amount, setAmount] = useState("");
  const [deductionDate, setDeductionDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [forRow, setForRow] = useState<string | null>(null);

  // Prefill from the payslip each time a different row is opened.
  if (row && forRow !== row.payslip_id) {
    setForRow(row.payslip_id);
    setChallanId("");
    setAmount(row.tds_amount);
    setDeductionDate("");
    setError(null);
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!row) return;
    setError(null);
    if (!challanId || !deductionDate || !amount.trim()) {
      setError("Choose a challan, and enter the TDS amount and the date it was deducted.");
      return;
    }
    if (!isMoneyInput(amount) || toPaise(amount) !== toPaise(row.tds_amount)) {
      setError(`The mapped amount must equal this payslip's TDS of ₹${row.tds_amount}.`);
      return;
    }
    const body: ChallanMappingInput = {
      challan_id: challanId,
      payslip_id: row.payslip_id,
      tds_amount: amount.trim(),
      deduction_date: deductionDate,
    };
    setIsBusy(true);
    try {
      await post("/filings/tds-challan-mappings", body);
      toast.success("TDS mapped to the challan");
      setForRow(null);
      onMapped();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The TDS could not be mapped."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog
      open={row !== null}
      onOpenChange={(open) => {
        if (!open && !isBusy) {
          setForRow(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Map TDS to a challan</DialogTitle>
          <DialogDescription>
            {row && `${row.employee_name} (${row.employee_code}), ${displayPeriod(row.period)}.`}
          </DialogDescription>
        </DialogHeader>
        {challans.length === 0 ? (
          <InlineProblem>
            No challan is recorded for this quarter yet. An HR admin needs to record the deposit
            first.
          </InlineProblem>
        ) : (
          <form id="map-form" className="grid gap-4" onSubmit={(event) => void submit(event)} noValidate>
            <FormField htmlFor="map-challan" label="Challan">
              <Select value={challanId} onValueChange={setChallanId}>
                <SelectTrigger id="map-challan" className="w-full">
                  <SelectValue placeholder="Choose a challan" />
                </SelectTrigger>
                <SelectContent>
                  {challans.map((challan) => (
                    <SelectItem key={challan.id} value={challan.id}>
                      {challan.bsr_code} · {formatDay(challan.deposit_date, true)} · serial{" "}
                      {challan.challan_serial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField htmlFor="map-amount" label="TDS amount (₹)">
                <Input
                  id="map-amount"
                  inputMode="decimal"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="tabular-nums"
                />
              </FormField>
              <FormField htmlFor="map-date" label="Deducted on">
                <Input
                  id="map-date"
                  type="date"
                  required
                  value={deductionDate}
                  onChange={(event) => setDeductionDate(event.target.value)}
                />
              </FormField>
            </div>
            {error && <InlineProblem>{error}</InlineProblem>}
          </form>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={isBusy}
            onClick={() => {
              setForRow(null);
              onClose();
            }}
          >
            Cancel
          </Button>
          {challans.length > 0 && (
            <Button type="submit" form="map-form" disabled={isBusy}>
              {isBusy && <Loader2 className="animate-spin" />}
              Map TDS
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
