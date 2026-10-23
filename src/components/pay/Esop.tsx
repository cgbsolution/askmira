"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, Plus, TrendingUp } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { NoEmployeeRecord, useHasEmployeeRecord } from "@/components/common/NoEmployeeRecord";
import { DataPanel } from "@/components/common/DataPanel";
import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { EmployeePicker, type PickedEmployee } from "@/components/people/EmployeePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import { formatDay, toISODate } from "@/lib/utils";

interface Grant {
  id: string;
  plan: string;
  instrument: string;
  grant_date: string;
  units: number;
  exercise_price: string;
  status: "active" | "cancelled";
  cancelled_on: string | null;
  vested: number;
  exercised: number;
  exercisable: number;
  unvested: number;
  schedule: { date: string; units: number; vested: boolean }[];
  fmv_per_unit: string | null;
  fmv_from: string | null;
  value_vested_unexercised: string | null;
  value_unvested: string | null;
}

interface Portfolio {
  as_of: string;
  grants: Grant[];
}

interface Plan {
  id: string;
  name: string;
  instrument: string;
  pool_units: number;
  granted_units: number;
  available_units: number;
  default_cliff_months: number;
  default_vesting_months: number;
  default_frequency_months: number;
  fmv_per_unit: string | null;
  fmv_from: string | null;
}

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

function GrantCard({ grant, onExercise }: { grant: Grant; onExercise?: (grant: Grant) => void }) {
  const next = grant.schedule.find((row) => !row.vested);
  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {grant.units.toLocaleString("en-IN")} {grant.instrument} · {grant.plan}
          {grant.status === "cancelled" && <Badge variant="muted">Cancelled {grant.cancelled_on ? formatDay(grant.cancelled_on, true) : ""}</Badge>}
        </CardTitle>
        <CardDescription>
          Granted {formatDay(grant.grant_date, true)} at ₹{grant.exercise_price} a unit
          {grant.fmv_per_unit ? `; fair value ₹${grant.fmv_per_unit} from ${formatDay(grant.fmv_from ?? grant.grant_date, true)}` : "; no valuation entered yet"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Progress value={(grant.vested / grant.units) * 100} aria-label="Share vested" />
        <div className="grid gap-3 sm:grid-cols-4">
          <Figure label="Vested" value={grant.vested.toLocaleString("en-IN")} />
          <Figure label="Exercised" value={grant.exercised.toLocaleString("en-IN")} />
          <Figure label="Exercisable now" value={grant.exercisable.toLocaleString("en-IN")} money={grant.value_vested_unexercised} />
          <Figure label="Still to vest" value={grant.unvested.toLocaleString("en-IN")} money={grant.value_unvested} />
        </div>
        {next && (
          <p className="text-sm text-muted-foreground">
            Next: {next.units.toLocaleString("en-IN")} units on {formatDay(next.date, true)}.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Worth is at the latest fair value, not a forecast. Exercising is taxed as salary on the difference between fair value and the exercise price.
        </p>
        {onExercise && grant.exercisable > 0 && (
          <div>
            <Button size="sm" variant="outline" onClick={() => onExercise(grant)}>
              Record an exercise
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Figure({ label, value, money }: { label: string; value: string; money?: string | null }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {money && (
        <p className="text-xs text-muted-foreground">
          worth <Money value={money} />
        </p>
      )}
    </div>
  );
}

/** For the person: their grants. */
export function MyEsopScreen() {
  const hasRecord = useHasEmployeeRecord();
  const { data, error, isLoading, reload } = useApiQuery<Portfolio>(hasRecord ? "/esop/me" : null);
  if (!hasRecord) {
    return (
      <PageShell title="Stock options" description="Your grants, how they vest, and what they are worth at today's fair value.">
        <NoEmployeeRecord what="Stock option grants" />
      </PageShell>
    );
  }
  return (
    <PageShell title="Stock options" description="Your grants, how they vest, and what they are worth at today's fair value.">
      <DataPanel
        tier="tier1"
        title="Your grants"
        isLoading={isLoading && !data}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data?.grants ?? []).length === 0}
        empty={{ icon: TrendingUp, title: "No grants", description: "Grants appear here once HR records them." }}
      >
        <div className="grid gap-4 p-5">
          {(data?.grants ?? []).map((grant) => (
            <GrantCard key={grant.id} grant={grant} />
          ))}
        </div>
      </DataPanel>
      {(data?.grants ?? []).length > 0 && <WhatIf />}
    </PageShell>
  );
}

interface Projection {
  price_per_unit: string;
  value_now: string;
  value_when_fully_vested: string;
  timeline: { date: string; value: string }[];
  grants: { id: string; plan: string; spread_per_unit: string; vested_unexercised: number; unvested: number; value_now: string; value_when_fully_vested: string }[];
  note: string;
}

/** What the options would be worth at a share price the person chooses, as they vest. */
function WhatIf() {
  const [price, setPrice] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const { data, error, isLoading } = useApiQuery<Projection>(
    asked ? `/esop/me/projection?price_per_unit=${encodeURIComponent(asked)}` : null,
  );
  const valid = /^\d+(\.\d{1,2})?$/.test(price.trim());
  const timelineColumns: ColumnDef<Projection["timeline"][number]>[] = [
    {
      accessorKey: "date",
      header: "On",
      cell: ({ row }) => formatDay(row.original.date, true),
    },
    {
      accessorKey: "value",
      header: `Worth, at ₹${data?.price_per_unit ?? ""} a share`,
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.value} />,
    },
  ];

  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle className="text-base">What if a share were worth…</CardTitle>
        <CardDescription>Enter a price to see what your options would be worth now and as each tranche vests.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <FormField htmlFor="esop-price" label="Price per share (₹)">
            <Input id="esop-price" inputMode="decimal" className="w-40" value={price} onChange={(e) => setPrice(e.target.value)} />
          </FormField>
          <Button variant="outline" disabled={!valid} onClick={() => setAsked(price.trim())}>
            {isLoading && <Loader2 className="animate-spin" />} Work it out
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error.detail}</p>}
        {data && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Vested and not yet exercised, now</p>
                <p className="text-lg font-semibold tabular-nums">
                  <Money value={data.value_now} />
                </p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Once everything has vested</p>
                <p className="text-lg font-semibold tabular-nums">
                  <Money value={data.value_when_fully_vested} />
                </p>
              </div>
            </div>
            <DataTable
              variant="plain"
              columns={timelineColumns}
              data={data.timeline}
              getRowId={(point) => point.date}
            />
            <p className="text-xs text-muted-foreground">{data.note}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** For HR: plans, valuations, grants and exercises. */
export function EsopAdminScreen() {
  const plans = useApiQuery<Plan[]>("/esop/plans");
  const [creating, setCreating] = useState(false);
  const [granting, setGranting] = useState<Plan | null>(null);
  const [valuing, setValuing] = useState<Plan | null>(null);
  const [person, setPerson] = useState<PickedEmployee | null>(null);
  const portfolio = useApiQuery<Portfolio>(person ? `/esop/employees/${person.id}` : null);
  const [exercising, setExercising] = useState<Grant | null>(null);

  const planColumns: ColumnDef<Plan>[] = [
    {
      accessorKey: "name",
      header: "Plan",
      meta: {
        text: (plan) =>
          `${plan.name} · ${plan.instrument} · ${plan.default_cliff_months}-month cliff, ${plan.default_vesting_months} months, every ${plan.default_frequency_months}`,
      },
      cell: ({ row }) => (
        <>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.instrument} · {row.original.default_cliff_months}-month cliff, {row.original.default_vesting_months} months, every {row.original.default_frequency_months}
          </p>
        </>
      ),
    },
    {
      accessorKey: "pool_units",
      header: "Pool",
      meta: { className: "text-right tabular-nums" },
      cell: ({ row }) => row.original.pool_units.toLocaleString("en-IN"),
    },
    {
      accessorKey: "granted_units",
      header: "Granted",
      meta: { className: "text-right tabular-nums" },
      cell: ({ row }) => row.original.granted_units.toLocaleString("en-IN"),
    },
    {
      id: "fair_value",
      header: "Fair value",
      accessorFn: (plan) =>
        plan.fmv_per_unit ? `₹${plan.fmv_per_unit} from ${formatDay(plan.fmv_from ?? "", true)}` : "—",
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setValuing(row.original)}>
            Fair value
          </Button>
          <Button size="sm" onClick={() => setGranting(row.original)}>
            Grant
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageShell title="Stock options" description="ESOP plans, fair values, grants and exercises. An exercise's perquisite is taxed in the next payroll run.">
      <div className="grid gap-6">
        <DataTable
          tier="tier1"
          title="Plans"
          actions={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> New plan
            </Button>
          }
          columns={planColumns}
          data={plans.data ?? []}
          noun="plans"
          exportName="esop-plans"
          searchPlaceholder="Search plans"
          isLoading={plans.isLoading && !plans.data}
          error={plans.error?.detail ?? null}
          onRetry={plans.reload}
          empty={{ icon: TrendingUp, title: "No plans yet" }}
        />
        <Card tier="tier1">
          <CardHeader>
            <CardTitle className="text-base">A person&apos;s grants</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="max-w-sm">
              <EmployeePicker value={person} onChange={setPerson} placeholder="Choose a person" />
            </div>
            {(portfolio.data?.grants ?? []).map((grant) => (
              <GrantCard key={grant.id} grant={grant} onExercise={setExercising} />
            ))}
            {person && portfolio.data && portfolio.data.grants.length === 0 && <p className="text-sm text-muted-foreground">No grants.</p>}
          </CardContent>
        </Card>
      </div>
      {creating && <PlanDialog onClose={() => setCreating(false)} onDone={() => { setCreating(false); plans.reload(); }} />}
      {granting && <GrantDialog plan={granting} onClose={() => setGranting(null)} onDone={() => { setGranting(null); plans.reload(); portfolio.reload(); }} />}
      {valuing && <ValuationDialog plan={valuing} onClose={() => setValuing(null)} onDone={() => { setValuing(null); plans.reload(); portfolio.reload(); }} />}
      {exercising && <ExerciseDialog grant={exercising} onClose={() => setExercising(null)} onDone={() => { setExercising(null); portfolio.reload(); }} />}
    </PageShell>
  );
}

function useSubmit(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const run = async (path: string, body: object, done: string) => {
    setBusy(true);
    try {
      await post(path, body);
      toast.success(done);
      onDone();
    } catch (caught) {
      toast.error(failure(caught, "That did not go through."));
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

function PlanDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [pool, setPool] = useState("");
  const [cliff, setCliff] = useState("12");
  const [months, setMonths] = useState("48");
  const [every, setEvery] = useState("3");
  const { busy, run } = useSubmit(onDone);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New ESOP plan</DialogTitle>
          <DialogDescription>The pool and the vesting a grant gets unless it says otherwise.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="plan-name" label="Name" className="sm:col-span-2">
            <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField htmlFor="plan-pool" label="Units in the pool">
            <Input id="plan-pool" inputMode="numeric" value={pool} onChange={(e) => setPool(e.target.value.replace(/\D/g, ""))} />
          </FormField>
          <FormField htmlFor="plan-cliff" label="Cliff (months)">
            <Input id="plan-cliff" inputMode="numeric" value={cliff} onChange={(e) => setCliff(e.target.value.replace(/\D/g, ""))} />
          </FormField>
          <FormField htmlFor="plan-months" label="Vests over (months)">
            <Input id="plan-months" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, ""))} />
          </FormField>
          <FormField htmlFor="plan-every" label="A tranche every (months)">
            <Input id="plan-every" inputMode="numeric" value={every} onChange={(e) => setEvery(e.target.value.replace(/\D/g, ""))} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || name.trim().length < 2 || !(Number(pool) > 0)}
            onClick={() =>
              void run("/esop/plans", { name: name.trim(), pool_units: Number(pool), default_cliff_months: Number(cliff), default_vesting_months: Number(months), default_frequency_months: Number(every) }, "Plan created.")
            }
          >
            {busy && <Loader2 className="animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GrantDialog({ plan, onClose, onDone }: { plan: Plan; onClose: () => void; onDone: () => void }) {
  const [person, setPerson] = useState<PickedEmployee | null>(null);
  const [units, setUnits] = useState("");
  const [price, setPrice] = useState("");
  const [granted, setGranted] = useState(toISODate(new Date()));
  const { busy, run } = useSubmit(onDone);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Grant from {plan.name}</DialogTitle>
          <DialogDescription>{plan.available_units.toLocaleString("en-IN")} units left in the pool. Vests on the plan&apos;s schedule.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="grant-person" label="Person">
            <EmployeePicker id="grant-person" value={person} onChange={setPerson} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField htmlFor="grant-units" label="Units">
              <Input id="grant-units" inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value.replace(/\D/g, ""))} />
            </FormField>
            <FormField htmlFor="grant-price" label="Exercise price (₹)">
              <Input id="grant-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </FormField>
            <FormField htmlFor="grant-date" label="Grant date">
              <Input id="grant-date" type="date" value={granted} onChange={(e) => setGranted(e.target.value)} />
            </FormField>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !person || !(Number(units) > 0) || price === "" || !granted}
            onClick={() => void run(`/esop/plans/${plan.id}/grants`, { employee_id: person?.id, units: Number(units), exercise_price: price, grant_date: granted }, "Grant recorded.")}
          >
            {busy && <Loader2 className="animate-spin" />} Grant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ValuationDialog({ plan, onClose, onDone }: { plan: Plan; onClose: () => void; onDone: () => void }) {
  const [from, setFrom] = useState(toISODate(new Date()));
  const [fmv, setFmv] = useState("");
  const [source, setSource] = useState("");
  const { busy, run } = useSubmit(onDone);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fair value for {plan.name}</DialogTitle>
          <DialogDescription>From the valuer&apos;s report. A new value starts on its own date; earlier ones stay as they were.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="val-from" label="From">
            <Input id="val-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </FormField>
          <FormField htmlFor="val-fmv" label="Fair value a unit (₹)">
            <Input id="val-fmv" inputMode="decimal" value={fmv} onChange={(e) => setFmv(e.target.value)} />
          </FormField>
          <FormField htmlFor="val-source" label="Valuer and report" className="sm:col-span-2">
            <Input id="val-source" value={source} onChange={(e) => setSource(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !from || fmv === "" || source.trim().length < 3} onClick={() => void run(`/esop/plans/${plan.id}/valuations`, { effective_from: from, fmv_per_unit: fmv, source: source.trim() }, "Fair value saved.")}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExerciseDialog({ grant, onClose, onDone }: { grant: Grant; onClose: () => void; onDone: () => void }) {
  const [on, setOn] = useState(toISODate(new Date()));
  const [units, setUnits] = useState("");
  const { busy, run } = useSubmit(onDone);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record an exercise</DialogTitle>
          <DialogDescription>{grant.exercisable.toLocaleString("en-IN")} units can be exercised. The perquisite is taxed in the next payroll run.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="ex-date" label="Exercise date">
            <Input id="ex-date" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
          </FormField>
          <FormField htmlFor="ex-units" label="Units">
            <Input id="ex-units" inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value.replace(/\D/g, ""))} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !on || !(Number(units) > 0) || Number(units) > grant.exercisable} onClick={() => void run(`/esop/grants/${grant.id}/exercises`, { exercise_date: on, units: Number(units) }, "Exercise recorded.")}>
            {busy && <Loader2 className="animate-spin" />} Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
