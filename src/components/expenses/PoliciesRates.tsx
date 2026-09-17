"use client";

import { Car, Coins, Loader2, Plus, Utensils } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { InlineProblem, MONEY_RE, QueryBoundary, errorDetail, todayISO } from "@/components/expenses/ReviewCommon";
import { CITY_TIER_LABEL, formatMoney, humanizeKey } from "@/components/expenses/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Mileage rates</CardTitle>
        <CardDescription>
          Rupees per kilometre by vehicle. Rates are effective-dated rows and are never edited: a change adds a
          new row from its start date, and earlier claims keep the rate of their date.
        </CardDescription>
        {canWrite && (
          <CardAction>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus /> Add rate
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <QueryBoundary query={query}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState
                icon={Car}
                title="No mileage rates"
                description="A mileage claim cannot be valued until a rate exists for its vehicle."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Vehicle</TableHead>
                    <TableHead className="text-right">Rate / km</TableHead>
                    <TableHead className="text-right">Route tolerance</TableHead>
                    <TableHead className="pr-5">In force from</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-5 font-medium text-foreground">{humanizeKey(row.vehicle_type)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(row.rate_per_km)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.tolerance_percent}%</TableCell>
                      <TableCell className="pr-5">{formatDay(row.effective_from, true)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          }
        </QueryBoundary>
      </CardContent>

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
    </Card>
  );
}

// ── Per-diem ────────────────────────────────────────────────────────────────

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
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Per-diem rates</CardTitle>
        <CardDescription>
          A daily allowance by city tier and grade. Rates are effective-dated rows and are never edited.
        </CardDescription>
        {canWrite && (
          <CardAction>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus /> Add rate
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <QueryBoundary query={query}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState
                icon={Utensils}
                title="No per-diem rates"
                description="A per-diem claim cannot be valued until a rate exists for its tier and grade."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Tier</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-right">Per day</TableHead>
                    <TableHead>Covers</TableHead>
                    <TableHead className="pr-5">In force from</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-5">{CITY_TIER_LABEL[row.city_tier]}</TableCell>
                      <TableCell>{row.grade}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(row.amount)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.includes_meals && <Badge variant="outline">Meals</Badge>}
                          {row.includes_accommodation && <Badge variant="outline">Accommodation</Badge>}
                          {!row.includes_meals && !row.includes_accommodation && (
                            <span className="text-muted-foreground">Incidentals only</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="pr-5">{formatDay(row.effective_from, true)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          }
        </QueryBoundary>
      </CardContent>

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
    </Card>
  );
}

// ── Exchange rates ──────────────────────────────────────────────────────────

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
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Exchange rates</CardTitle>
        <CardDescription>
          No rate feed is connected: every rate here was entered by a person, with its source. A foreign-currency
          claim is converted to rupees with the rate for its date.
        </CardDescription>
        {canWrite && (
          <CardAction>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus /> Enter rate
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <QueryBoundary query={query}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState
                icon={Coins}
                title="No exchange rates entered"
                description="A claim in another currency cannot be converted until a rate for its date is entered."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Currency</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead>Quote date</TableHead>
                    <TableHead className="pr-5">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-5 font-medium text-foreground">
                        {row.from_currency} → {row.to_currency}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.rate}</TableCell>
                      <TableCell>{formatDay(row.quote_date, true)}</TableCell>
                      <TableCell className="pr-5 text-muted-foreground">{row.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          }
        </QueryBoundary>
      </CardContent>

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
    </Card>
  );
}
