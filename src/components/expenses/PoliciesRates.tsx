"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Car, Coins, Loader2, Lock, Plus, Utensils } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable, type DataTableEmpty } from "@/components/common/data-table/DataTable";
import { InlineProblem, MONEY_RE, errorDetail, todayISO } from "@/components/expenses/ReviewCommon";
import { CITY_TIER_LABEL, formatMoney, humanizeKey } from "@/components/expenses/shared";
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
import { useApiQuery } from "@/hooks/useApiQuery";
import { post, type ApiError } from "@/lib/api";
import type {
  CityTier,
  ExchangeRate,
  ExchangeRateInput,
  MileageRate,
  MileageRateInput,
  PerDiemRate,
  PerDiemRateInput,
} from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";

const PERCENT_RE = /^\d{1,3}(\.\d{1,2})?$/;
const FX_RATE_RE = /^\d{1,9}(\.\d{1,6})?$/;

/**
 * Loading, error and "nothing yet" for one rate list. A 403 reads as "no
 * access", not as a failed load that a retry could fix.
 */
function queryState<T>(
  query: { data: T[] | null; error: ApiError | null; isLoading: boolean; reload: () => void },
  empty: DataTableEmpty,
) {
  const forbidden = query.error?.status === 403;
  return {
    data: forbidden ? [] : (query.data ?? []),
    loadingRows: 3,
    isLoading: query.isLoading && query.data === null,
    error: forbidden ? null : (query.error?.detail ?? null),
    onRetry: query.reload,
    empty: forbidden
      ? { icon: Lock, title: "You don't have access to this", description: query.error?.detail }
      : empty,
  };
}

/** Shared save plumbing for the three "add a rate" dialogs. */
function useCreate<T>(path: string, onSaved: () => void) {
  const [isSaving, setIsSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const create = async (body: T, success: string) => {
    setIsSaving(true);
    setProblem(null);
    try {
      await post(path, body);
      toast.success(success);
      onSaved();
    } catch (error) {
      setProblem(errorDetail(error, "Could not save the rate."));
    } finally {
      setIsSaving(false);
    }
  };
  return { isSaving, problem, setProblem, create };
}

function RateDialogFrame({
  open,
  title,
  description,
  isSaving,
  canSave,
  problem,
  submitLabel,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  isSaving: boolean;
  canSave: boolean;
  problem: string | null;
  submitLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSaving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {children}
          {problem && <InlineProblem>{problem}</InlineProblem>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSave || isSaving} onClick={onSubmit}>
            {isSaving && <Loader2 className="animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Mileage ─────────────────────────────────────────────────────────────────

const MILEAGE_COLUMNS: ColumnDef<MileageRate>[] = [
  {
    id: "vehicle",
    header: "Vehicle",
    accessorFn: (row) => humanizeKey(row.vehicle_type),
    meta: { cellClassName: "font-medium text-foreground" },
  },
  {
    accessorKey: "rate_per_km",
    header: "Rate / km",
    sortingFn: "alphanumeric",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => formatMoney(row.original.rate_per_km),
  },
  {
    accessorKey: "tolerance_percent",
    header: "Route tolerance",
    sortingFn: "alphanumeric",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => `${row.original.tolerance_percent}%`,
  },
  {
    accessorKey: "effective_from",
    header: "In force from",
    meta: { text: (row) => formatDay(row.effective_from, true) },
    cell: ({ row }) => formatDay(row.original.effective_from, true),
  },
];

export function PoliciesMileageRates({ canWrite }: { canWrite: boolean }) {
  const query = useApiQuery<MileageRate[]>("/expenses/mileage-rates");
  const [open, setOpen] = useState(false);
  const [vehicle, setVehicle] = useState("");
  const [rate, setRate] = useState("");
  const [from, setFrom] = useState(todayISO());
  const [tolerance, setTolerance] = useState("");
  const { isSaving, problem, setProblem, create } = useCreate<MileageRateInput>("/expenses/mileage-rates", () => {
    setOpen(false);
    query.reload();
  });

  useEffect(() => {
    if (!open) return;
    setVehicle("");
    setRate("");
    setFrom(todayISO());
    setTolerance("");
    setProblem(null);
  }, [open, setProblem]);

  const canSave =
    /^[a-z0-9_]{1,40}$/.test(vehicle) &&
    MONEY_RE.test(rate) &&
    Boolean(from) &&
    (tolerance === "" || PERCENT_RE.test(tolerance));

  return (
    <>
      <DataTable
        title="Mileage rates"
        description="Rupees per kilometre by vehicle. Rates are effective-dated rows and are never edited: a change adds a new row from its start date, and earlier claims keep the rate of their date."
        actions={
          canWrite && (
            <Button size="sm" className="h-9" onClick={() => setOpen(true)}>
              <Plus /> Add rate
            </Button>
          )
        }
        columns={MILEAGE_COLUMNS}
        noun="rates"
        exportName="mileage-rates"
        searchPlaceholder="Search vehicles"
        {...queryState(query, {
          icon: Car,
          title: "No mileage rates",
          description: "A mileage claim cannot be valued until a rate exists for its vehicle.",
        })}
      />

      <RateDialogFrame
        open={open}
        title="Add a mileage rate"
        description="Adds a new row. The current rate for this vehicle is not edited."
        isSaving={isSaving}
        canSave={canSave}
        problem={problem}
        submitLabel="Add rate"
        onClose={() => setOpen(false)}
        onSubmit={() =>
          void create(
            {
              vehicle_type: vehicle,
              rate_per_km: rate,
              effective_from: from,
              tolerance_percent: tolerance || null,
            },
            "Mileage rate added",
          )
        }
      >
        <div className="grid gap-1.5">
          <Label htmlFor="mileage-vehicle">Vehicle type key</Label>
          <Input
            id="mileage-vehicle"
            value={vehicle}
            placeholder="e.g. four_wheeler"
            onChange={(event) => setVehicle(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="mileage-rate">Rate per km (₹)</Label>
            <Input
              id="mileage-rate"
              inputMode="decimal"
              className="tabular-nums"
              value={rate}
              aria-invalid={rate !== "" && !MONEY_RE.test(rate)}
              onChange={(event) => setRate(event.target.value.trim())}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mileage-tolerance">
              Tolerance % <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="mileage-tolerance"
              inputMode="decimal"
              className="tabular-nums"
              value={tolerance}
              aria-invalid={tolerance !== "" && !PERCENT_RE.test(tolerance)}
              onChange={(event) => setTolerance(event.target.value.trim())}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mileage-from">In force from</Label>
          <Input id="mileage-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
      </RateDialogFrame>
    </>
  );
}

// ── Per-diem ────────────────────────────────────────────────────────────────

const PER_DIEM_COLUMNS: ColumnDef<PerDiemRate>[] = [
  {
    id: "tier",
    header: "Tier",
    accessorFn: (row) => CITY_TIER_LABEL[row.city_tier],
  },
  { accessorKey: "grade", header: "Grade" },
  {
    accessorKey: "amount",
    header: "Per day",
    sortingFn: "alphanumeric",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => formatMoney(row.original.amount),
  },
  {
    id: "covers",
    header: "Covers",
    accessorFn: (row) =>
      [row.includes_meals && "Meals", row.includes_accommodation && "Accommodation"].filter(Boolean).join(", ") ||
      "Incidentals only",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.includes_meals && <Badge variant="outline">Meals</Badge>}
        {row.original.includes_accommodation && <Badge variant="outline">Accommodation</Badge>}
        {!row.original.includes_meals && !row.original.includes_accommodation && (
          <span className="text-muted-foreground">Incidentals only</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "effective_from",
    header: "In force from",
    meta: { text: (row) => formatDay(row.effective_from, true) },
    cell: ({ row }) => formatDay(row.original.effective_from, true),
  },
];

export function PoliciesPerDiemRates({ canWrite }: { canWrite: boolean }) {
  const query = useApiQuery<PerDiemRate[]>("/expenses/per-diem-rates");
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<CityTier | "">("");
  const [grade, setGrade] = useState("");
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(todayISO());
  const [meals, setMeals] = useState(true);
  const [stay, setStay] = useState(false);
  const { isSaving, problem, setProblem, create } = useCreate<PerDiemRateInput>("/expenses/per-diem-rates", () => {
    setOpen(false);
    query.reload();
  });

  useEffect(() => {
    if (!open) return;
    setTier("");
    setGrade("");
    setAmount("");
    setFrom(todayISO());
    setMeals(true);
    setStay(false);
    setProblem(null);
  }, [open, setProblem]);

  const canSave = Boolean(tier) && grade.trim().length > 0 && MONEY_RE.test(amount) && Boolean(from);

  return (
    <>
      <DataTable
        title="Per-diem rates"
        description="A daily allowance by city tier and grade. Rates are effective-dated rows and are never edited."
        actions={
          canWrite && (
            <Button size="sm" className="h-9" onClick={() => setOpen(true)}>
              <Plus /> Add rate
            </Button>
          )
        }
        columns={PER_DIEM_COLUMNS}
        noun="rates"
        exportName="per-diem-rates"
        searchPlaceholder="Search tier or grade"
        {...queryState(query, {
          icon: Utensils,
          title: "No per-diem rates",
          description: "A per-diem claim cannot be valued until a rate exists for its tier and grade.",
        })}
      />

      <RateDialogFrame
        open={open}
        title="Add a per-diem rate"
        description="Adds a new row. The current rate for this tier and grade is not edited."
        isSaving={isSaving}
        canSave={canSave}
        problem={problem}
        submitLabel="Add rate"
        onClose={() => setOpen(false)}
        onSubmit={() =>
          tier &&
          void create(
            {
              city_tier: tier,
              grade: grade.trim(),
              amount,
              effective_from: from,
              includes_meals: meals,
              includes_accommodation: stay,
            },
            "Per-diem rate added",
          )
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="perdiem-tier">City tier</Label>
            <Select value={tier} onValueChange={(value) => setTier(value as CityTier)}>
              <SelectTrigger id="perdiem-tier" className="w-full">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CITY_TIER_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="perdiem-grade">Grade</Label>
            <Input id="perdiem-grade" value={grade} maxLength={40} onChange={(event) => setGrade(event.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="perdiem-amount">Per day (₹)</Label>
            <Input
              id="perdiem-amount"
              inputMode="decimal"
              className="tabular-nums"
              value={amount}
              aria-invalid={amount !== "" && !MONEY_RE.test(amount)}
              onChange={(event) => setAmount(event.target.value.trim())}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="perdiem-from">In force from</Label>
            <Input id="perdiem-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="perdiem-meals">Includes meals</Label>
          <Switch id="perdiem-meals" checked={meals} onCheckedChange={setMeals} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="perdiem-stay">Includes accommodation</Label>
          <Switch id="perdiem-stay" checked={stay} onCheckedChange={setStay} />
        </div>
      </RateDialogFrame>
    </>
  );
}

// ── Exchange rates ──────────────────────────────────────────────────────────

const EXCHANGE_COLUMNS: ColumnDef<ExchangeRate>[] = [
  {
    id: "currency",
    header: "Currency",
    accessorFn: (row) => `${row.from_currency} → ${row.to_currency}`,
    meta: { cellClassName: "font-medium text-foreground" },
  },
  {
    accessorKey: "rate",
    header: "Rate",
    sortingFn: "alphanumeric",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
  },
  {
    accessorKey: "quote_date",
    header: "Quote date",
    meta: { text: (row) => formatDay(row.quote_date, true) },
    cell: ({ row }) => formatDay(row.original.quote_date, true),
  },
  {
    accessorKey: "source",
    header: "Source",
    meta: { cellClassName: "text-muted-foreground" },
  },
];

export function PoliciesExchangeRates({ canWrite }: { canWrite: boolean }) {
  const query = useApiQuery<ExchangeRate[]>("/expenses/exchange-rates");
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState("");
  const [rate, setRate] = useState("");
  const [quoteDate, setQuoteDate] = useState(todayISO());
  const [source, setSource] = useState("");
  const { isSaving, problem, setProblem, create } = useCreate<ExchangeRateInput>("/expenses/exchange-rates", () => {
    setOpen(false);
    query.reload();
  });

  useEffect(() => {
    if (!open) return;
    setCurrency("");
    setRate("");
    setQuoteDate(todayISO());
    setSource("");
    setProblem(null);
  }, [open, setProblem]);

  const canSave =
    /^[A-Z]{3}$/.test(currency) &&
    currency !== "INR" &&
    FX_RATE_RE.test(rate) &&
    Boolean(quoteDate) &&
    source.trim().length > 0;

  return (
    <>
      <DataTable
        title="Exchange rates"
        description="No rate feed is connected: every rate here was entered by a person, with its source. A foreign-currency claim is converted to rupees with the rate for its date."
        actions={
          canWrite && (
            <Button size="sm" className="h-9" onClick={() => setOpen(true)}>
              <Plus /> Enter rate
            </Button>
          )
        }
        columns={EXCHANGE_COLUMNS}
        noun="rates"
        exportName="exchange-rates"
        searchPlaceholder="Search currency or source"
        {...queryState(query, {
          icon: Coins,
          title: "No exchange rates entered",
          description: "A claim in another currency cannot be converted until a rate for its date is entered.",
        })}
      />

      <RateDialogFrame
        open={open}
        title="Enter an exchange rate"
        description="Rupees for one unit of the foreign currency, as quoted on the date. Say where it came from."
        isSaving={isSaving}
        canSave={canSave}
        problem={problem}
        submitLabel="Save rate"
        onClose={() => setOpen(false)}
        onSubmit={() =>
          void create(
            { from_currency: currency, to_currency: "INR", rate, quote_date: quoteDate, source: source.trim() },
            `${currency} rate saved`,
          )
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="fx-currency">Currency (ISO code)</Label>
            <Input
              id="fx-currency"
              value={currency}
              maxLength={3}
              placeholder="USD"
              onChange={(event) => setCurrency(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fx-rate">₹ per unit</Label>
            <Input
              id="fx-rate"
              inputMode="decimal"
              className="tabular-nums"
              value={rate}
              aria-invalid={rate !== "" && !FX_RATE_RE.test(rate)}
              onChange={(event) => setRate(event.target.value.trim())}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fx-date">Quote date</Label>
            <Input id="fx-date" type="date" value={quoteDate} onChange={(event) => setQuoteDate(event.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fx-source">Source</Label>
            <Input
              id="fx-source"
              value={source}
              maxLength={200}
              placeholder="e.g. RBI reference rate"
              onChange={(event) => setSource(event.target.value)}
            />
          </div>
        </div>
      </RateDialogFrame>
    </>
  );
}
