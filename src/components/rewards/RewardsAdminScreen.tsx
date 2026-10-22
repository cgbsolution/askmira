"use client";

import { AlertTriangle, BellRing, CircleCheck, CircleSlash, Hourglass, Landmark, Loader2, PackageCheck, Plus, Scale, Undo2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { EmployeePicker, type PickedEmployee } from "@/components/people/EmployeePicker";
import { useOrgReference } from "@/components/people/useOrgReference";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { CatalogueAdmin } from "@/components/rewards/Catalogue";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post, put } from "@/lib/api";
import type {
  BudgetReport,
  BudgetScope,
  Enforcement,
  ExpiryPolicy,
  LiabilityReport,
  MovementReport,
  Redemption,
  RewardsPosture,
  RewardStatement,
  TaxRule,
  TaxTreatment,
  Valuation,
} from "@/lib/types/rewards";
import { formatDate, formatDateTime, toISODate } from "@/lib/utils";

import { ReconciliationTab } from "./ReconciliationTab";

function detail(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/**
 * Culture → Rewards admin.
 *
 * Unredeemed points are a liability on the balance sheet, so this is a finance
 * screen as much as a culture one: what is owed, how it moved, what budgets
 * allow, what each point is worth and how it is taxed, and whether the partner's
 * invoices match what people actually redeemed. The ledger is insert-only —
 * a mistake is undone with a reversal, never an edit.
 */
export function RewardsAdminScreen() {
  return (
    <PageShell title="Rewards admin" description="The points liability, budgets, valuation, tax treatment and partner reconciliation.">
      <Tabs defaultValue="liability">
        <TabsList className="flex-wrap">
          <TabsTrigger value="liability">Liability</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
          <TabsTrigger value="redemptions">Redemptions</TabsTrigger>
          <TabsTrigger value="ledger">Employee ledger</TabsTrigger>
          <TabsTrigger value="policy">Value, expiry &amp; tax</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
        </TabsList>
        <TabsContent value="liability" className="mt-4">
          <LiabilityTab />
        </TabsContent>
        <TabsContent value="budgets" className="mt-4">
          <BudgetsTab />
        </TabsContent>
        <TabsContent value="catalogue" className="mt-4">
          <CatalogueAdmin />
        </TabsContent>
        <TabsContent value="redemptions" className="mt-4">
          <RedemptionsTab />
        </TabsContent>
        <TabsContent value="ledger" className="mt-4">
          <LedgerTab />
        </TabsContent>
        <TabsContent value="policy" className="mt-4">
          <PolicyTab />
        </TabsContent>
        <TabsContent value="reconciliation" className="mt-4">
          <ReconciliationTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function monthStart(): string {
  const today = new Date();
  return toISODate(new Date(today.getFullYear(), today.getMonth(), 1));
}

function LiabilityTab() {
  const liability = useApiQuery<LiabilityReport>("/rewards/liability");
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(toISODate(new Date()));
  const movement = useApiQuery<MovementReport>(start && end && end >= start ? `/rewards/movement?period_start=${start}&period_end=${end}` : null);
  const posture = useApiQuery<RewardsPosture>("/rewards/posture");
  const [running, setRunning] = useState<"expiry" | "warnings" | null>(null);
  const [confirmExpiry, setConfirmExpiry] = useState(false);

  const data = liability.data;

  const runWarnings = async () => {
    setRunning("warnings");
    try {
      const result = await post<{ employees_warned: number; lots_warned: number; already_warned: number }>("/rewards/expiry-warnings");
      toast.success(`${result.employees_warned} people warned about ${result.lots_warned} expiring lots (${result.already_warned} already told).`);
    } catch (caught) {
      toast.error(detail(caught, "Warnings were not sent."));
    } finally {
      setRunning(null);
    }
  };

  const runExpiry = async () => {
    setRunning("expiry");
    try {
      const result = await post<{ expired_entries: number; points_expired: number; note?: string }>("/rewards/expiry-run");
      toast.success(result.points_expired ? `${result.points_expired} points expired across ${result.expired_entries} lots.` : result.note ?? "Nothing was due to expire.");
      liability.reload();
      movement.reload();
    } catch (caught) {
      toast.error(detail(caught, "The expiry run failed."));
      throw caught;
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {data && !data.chain.intact && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>The ledger chain does not verify</AlertTitle>
          <AlertDescription>
            Each ledger row is chained to the one before it. A break means a row was altered or removed outside the
            application, and the balance below cannot be trusted until it is investigated.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Owed in points" value={data ? data.liability.balance_points.toLocaleString("en-IN") : "—"} />
        <Metric label="Owed in rupees" value={data ? <Money value={data.liability.rupees} /> : "—"} />
        <Metric
          label="Redemption rate"
          value={data?.expected_redemption.rate != null ? `${Math.round(data.expected_redemption.rate * 100)}%` : "—"}
          sub={data?.expected_redemption.note}
        />
        <Metric label="Ledger" value={data ? (data.chain.intact ? "Intact" : "Broken") : "—"} sub={data?.as_of ? `as of ${formatDate(data.as_of)}` : undefined} />
      </div>

      <DataPanel
        title="Ageing of the balance"
        description={data?.liability.note}
        actions={
          <>
            <Button size="sm" variant="outline" disabled={running !== null} onClick={runWarnings}>
              {running === "warnings" ? <Loader2 className="animate-spin" /> : <BellRing />} Send expiry warnings
            </Button>
            <Button size="sm" variant="outline" disabled={running !== null} onClick={() => setConfirmExpiry(true)}>
              {running === "expiry" ? <Loader2 className="animate-spin" /> : <Hourglass />} Run expiry
            </Button>
          </>
        }
        isLoading={liability.isLoading}
        error={liability.error?.detail ?? null}
        onRetry={liability.reload}
        isEmpty={!data || Object.keys(data.ageing.buckets).length === 0}
        empty={{ icon: Landmark, title: "Nothing owed" }}
      >
        {data && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Age</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-right">Rupees</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(data.ageing.buckets).map(([bucket, row]) => (
                <TableRow key={bucket}>
                  <TableCell className="text-sm">{bucket.replaceAll("_", " ")}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.points.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">
                    <Money value={row.rupees} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataPanel>

      <DataPanel
        title="Movement"
        toolbar={
          <>
            <Input type="date" aria-label="From" value={start} onChange={(e) => setStart(e.target.value)} className="w-40" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" aria-label="To" value={end} onChange={(e) => setEnd(e.target.value)} className="w-40" />
          </>
        }
        isLoading={movement.isLoading}
        error={movement.error?.detail ?? null}
        onRetry={movement.reload}
      >
        {movement.data && (
          <div className="grid gap-3 p-5">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-8">
              {(["opening", "awarded", "redeemed", "expired", "reversed", "adjusted", "closing"] as const).map((key) => (
                <div key={key}>
                  <div className="text-xs text-muted-foreground capitalize">{key}</div>
                  <div className="tabular-nums font-medium text-foreground">{movement.data![key].toLocaleString("en-IN")}</div>
                </div>
              ))}
              <div>
                <div className="text-xs text-muted-foreground">Reconciles</div>
                {movement.data.reconciles ? <Badge variant="success">Yes</Badge> : <Badge variant="destructive">No</Badge>}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{movement.data.note}</p>
          </div>
        )}
      </DataPanel>

      {posture.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <DataPanel title="Enforced">
            <ul className="grid gap-2 p-5 text-sm">
              {posture.data.enforced.map((line) => (
                <li key={line} className="flex gap-2">
                  <CircleCheck className="mt-0.5 size-4 shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
          </DataPanel>
          <DataPanel title="Not built">
            <ul className="grid gap-2 p-5 text-sm text-muted-foreground">
              {posture.data.not_built.map((line) => (
                <li key={line} className="flex gap-2">
                  <CircleSlash className="mt-0.5 size-4 shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
          </DataPanel>
        </div>
      )}

      <ConfirmDialog
        open={confirmExpiry}
        onOpenChange={setConfirmExpiry}
        title="Expire points that are past their date?"
        description="Each expired lot is written to the ledger as its own row. It cannot be undone except by an explicit reversal."
        confirmLabel="Run expiry"
        onConfirm={runExpiry}
      />
    </div>
  );
}

function BudgetsTab() {
  const { data, error, isLoading, reload } = useApiQuery<BudgetReport>("/rewards/budgets");
  const [creating, setCreating] = useState(false);

  return (
    <>
      <DataPanel
        title="Points budgets"
        description={data ? `${data.note} One point is worth ₹${data.rate_per_point} today.` : undefined}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus /> New budget
          </Button>
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data?.budgets ?? []).length === 0}
        empty={{ icon: Wallet, title: "No budgets", description: "Without a budget, points can be awarded without limit." }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Budget</TableHead>
              <TableHead className="text-right">Allocated</TableHead>
              <TableHead className="text-right">Used</TableHead>
              <TableHead className="text-right">Left</TableHead>
              <TableHead>When exhausted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.budgets ?? []).map((row) => (
              <TableRow key={row.budget_id}>
                <TableCell>
                  <div className="font-medium text-foreground">{row.scope_label}</div>
                  <div className="text-xs text-muted-foreground capitalize">{row.scope}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.allocated_points.toLocaleString("en-IN")}
                  <div className="text-xs text-muted-foreground">
                    <Money value={row.allocated_rupees} />
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.consumed_points.toLocaleString("en-IN")}
                  {row.utilisation !== null && <div className="text-xs text-muted-foreground">{Math.round(row.utilisation * 100)}%</div>}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.remaining_points.toLocaleString("en-IN")}
                  {row.exhausted && <Badge variant="destructive" className="ml-2">Exhausted</Badge>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{row.enforcement === "hard_stop" ? "Refuse further awards" : "Warn, then allow"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
      <BudgetDialog open={creating} onOpenChange={setCreating} onCreated={reload} />
    </>
  );
}

function BudgetDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const org = useOrgReference();
  const [scope, setScope] = useState<BudgetScope>("department");
  const [department, setDepartment] = useState("");
  const [manager, setManager] = useState<PickedEmployee | null>(null);
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState("");
  const [points, setPoints] = useState("");
  const [enforcement, setEnforcement] = useState<Enforcement>("soft_warning");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScope("department");
    setDepartment("");
    setManager(null);
    setStart(monthStart());
    setEnd("");
    setPoints("");
    setEnforcement("soft_warning");
  }, [open]);

  const invalid =
    !end || end < start || !/^\d+$/.test(points) || (scope === "department" && !department) || (scope === "manager" && !manager);

  const submit = async () => {
    setIsBusy(true);
    try {
      await post("/rewards/budgets", {
        scope,
        department_id: scope === "department" ? department : null,
        manager_employee_id: scope === "manager" ? manager?.id : null,
        period_start: start,
        period_end: end,
        allocated_points: Number(points),
        enforcement,
      });
      toast.success("Budget created.");
      onCreated();
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "Could not create the budget."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New points budget</DialogTitle>
          <DialogDescription>A budget caps awards for a scope and period. Choose whether hitting it refuses or only warns.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="budget-scope" label="For">
            <Select value={scope} onValueChange={(next) => setScope(next as BudgetScope)}>
              <SelectTrigger id="budget-scope" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">The whole company</SelectItem>
                <SelectItem value="department">A department</SelectItem>
                <SelectItem value="manager">A manager</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {scope === "department" && (
            <FormField htmlFor="budget-department" label="Department">
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger id="budget-department" className="w-full">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {org.departments.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
          {scope === "manager" && (
            <FormField htmlFor="budget-manager" label="Manager">
              <EmployeePicker id="budget-manager" value={manager} onChange={setManager} />
            </FormField>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="budget-start" label="From">
              <Input id="budget-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </FormField>
            <FormField htmlFor="budget-end" label="To" error={end && end < start ? "Ends before it starts." : undefined}>
              <Input id="budget-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </FormField>
          </div>
          <FormField htmlFor="budget-points" label="Points allocated">
            <Input id="budget-points" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/\D/g, ""))} />
          </FormField>
          <FormField htmlFor="budget-enforcement" label="When it runs out">
            <Select value={enforcement} onValueChange={(next) => setEnforcement(next as Enforcement)}>
              <SelectTrigger id="budget-enforcement" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="soft_warning">Warn the awarder, then allow</SelectItem>
                <SelectItem value="hard_stop">Refuse further awards</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || invalid}>
            {isBusy && <Loader2 className="animate-spin" />} Create budget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RedemptionsTab() {
  const [statusFilter, setStatusFilter] = useState("__any__");
  const { data, error, isLoading, reload } = useApiQuery<Redemption[]>(
    `/rewards/redemptions${statusFilter === "__any__" ? "" : `?redemption_status=${statusFilter}`}`,
  );

  return (
    <DataPanel
      title="Redemptions"
      description="Fulfilment status comes from the partner's file, imported under Reconciliation."
      toolbar={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__any__">Every status</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="ordered">Ordered</SelectItem>
            <SelectItem value="fulfilled">Fulfilled</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      }
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={(data ?? []).length === 0}
      empty={{ icon: PackageCheck, title: "No redemptions" }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Points</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-foreground">
                {row.employee_name}
                <div className="text-xs font-normal text-muted-foreground">{formatDate(row.requested_on)}</div>
              </TableCell>
              <TableCell className="text-sm">
                {row.item_description ?? "—"}
                {row.item_sku && <div className="font-mono text-xs text-muted-foreground">{row.item_sku}</div>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.points.toLocaleString("en-IN")}</TableCell>
              <TableCell className="text-right">
                <Money value={row.rupee_value} />
              </TableCell>
              <TableCell>
                <Badge variant={row.status === "fulfilled" ? "success" : row.status === "cancelled" ? "muted" : "outline"} className="capitalize">
                  {row.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataPanel>
  );
}

/** One person's ledger, with a reversal as the only way to undo a row. */
function LedgerTab() {
  const [person, setPerson] = useState<PickedEmployee | null>(null);
  const statement = useApiQuery<RewardStatement>(person ? `/rewards/statement/${person.id}` : null);
  const [reversing, setReversing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const reverse = async () => {
    if (!reversing) return;
    setIsBusy(true);
    try {
      await post("/rewards/reversals", { entry_id: reversing, reason: reason.trim() });
      toast.success("Reversed with a new ledger row. The original stays.");
      setReversing(null);
      setReason("");
      statement.reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not reverse."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-sm">
        <FormField htmlFor="ledger-person" label="Person">
          <EmployeePicker id="ledger-person" value={person} onChange={setPerson} placeholder="Look up someone's points" />
        </FormField>
      </div>
      {person && (
        <DataPanel
          title={`${person.label}'s ledger`}
          description={statement.data ? `Balance ${statement.data.balance_points.toLocaleString("en-IN")} points` : undefined}
          isLoading={statement.isLoading}
          error={statement.error?.detail ?? null}
          onRetry={statement.reload}
          isEmpty={(statement.data?.rows ?? []).length === 0}
          empty={{ icon: Scale, title: "No ledger entries" }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(statement.data?.rows ?? []).map((row) => (
                <TableRow key={row.entry_id}>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.occurred_at)}</TableCell>
                  <TableCell className="text-sm capitalize">{row.type}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.points}</TableCell>
                  <TableCell className="text-right">
                    <Money value={row.value} />
                  </TableCell>
                  <TableCell className="text-right">
                    {row.type === "awarded" && (
                      <Button size="sm" variant="ghost" onClick={() => setReversing(row.entry_id)}>
                        <Undo2 /> Reverse
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      )}

      <Dialog open={reversing !== null} onOpenChange={(next) => !isBusy && !next && setReversing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reverse this award?</DialogTitle>
            <DialogDescription>A new ledger row cancels it. Nothing is edited or deleted, and the reason is kept.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} aria-label="Reason" placeholder="Awarded to the wrong person." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReversing(null)} disabled={isBusy}>
              Cancel
            </Button>
            <Button onClick={reverse} disabled={isBusy || !reason.trim()}>
              {isBusy && <Loader2 className="animate-spin" />} Reverse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PolicyTab() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const valuations = useApiQuery<Valuation[]>("/rewards/valuations");
  const expiry = useApiQuery<ExpiryPolicy>("/rewards/expiry-policy");
  const rules = useApiQuery<TaxRule[]>("/rewards/tax-rules");
  const defaults = useApiQuery<{ rules: Omit<TaxRule, "id" | "reviewed_by" | "reviewed_on">[]; warning: string }>("/rewards/tax-rules/defaults");
  const [valuing, setValuing] = useState(false);
  const [ruling, setRuling] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <DataPanel
        title="Point value"
        description="Effective-dated. A new rate never revalues points already awarded — each lot keeps the rate it was given at."
        actions={isAdmin ? <Button size="sm" onClick={() => setValuing(true)}><Plus /> New rate</Button> : undefined}
        isLoading={valuations.isLoading}
        error={valuations.error?.detail ?? null}
        onRetry={valuations.reload}
        isEmpty={(valuations.data ?? []).length === 0}
        empty={{ icon: Scale, title: "No valuation set", description: "Until one is, points have no rupee value and no liability can be stated." }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead className="text-right">Points per rupee</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(valuations.data ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-sm">{formatDate(row.effective_from)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.points_per_rupee}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.note ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      <ExpiryPanel policy={expiry.data} isLoading={expiry.isLoading} canEdit={isAdmin} onSaved={expiry.reload} />

      <DataPanel
        title="Tax treatment"
        description="Rewards above the yearly exemption are a taxable perquisite for the recipient."
        actions={isAdmin ? <Button size="sm" onClick={() => setRuling(true)}><Plus /> Add rule</Button> : undefined}
        isLoading={rules.isLoading}
        error={rules.error?.detail ?? null}
        onRetry={rules.reload}
      >
        {(rules.data ?? []).length === 0 && defaults.data ? (
          <div className="grid gap-3 p-5">
            <Alert variant="warning">
              <AlertTriangle />
              <AlertTitle>Using the shipped defaults, none of them reviewed</AlertTitle>
              <AlertDescription>{defaults.data.warning}</AlertDescription>
            </Alert>
            <TaxRuleTable rows={defaults.data.rules} />
          </div>
        ) : (
          <TaxRuleTable rows={rules.data ?? []} />
        )}
      </DataPanel>

      <ValuationDialog open={valuing} onOpenChange={setValuing} onSaved={valuations.reload} />
      <TaxRuleDialog open={ruling} onOpenChange={setRuling} onSaved={rules.reload} />
    </div>
  );
}

function TaxRuleTable({ rows }: { rows: { reward_type: string; treatment: string; exemption_threshold_per_year: string; effective_from: string; basis: string | null; reviewed: boolean; reviewed_by?: string | null }[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reward type</TableHead>
          <TableHead>Treatment</TableHead>
          <TableHead className="text-right">Exempt up to / year</TableHead>
          <TableHead>From</TableHead>
          <TableHead>Reviewed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.reward_type}-${row.effective_from}`}>
            <TableCell className="text-sm">
              {row.reward_type}
              {row.basis && <div className="max-w-sm text-xs text-muted-foreground">{row.basis}</div>}
            </TableCell>
            <TableCell className="text-sm">{row.treatment.replace("_", " ")}</TableCell>
            <TableCell className="text-right">
              <Money value={row.exemption_threshold_per_year} />
            </TableCell>
            <TableCell className="text-sm">{formatDate(row.effective_from)}</TableCell>
            <TableCell>
              {row.reviewed ? (
                <Badge variant="success">{row.reviewed_by ? `By ${row.reviewed_by}` : "Reviewed"}</Badge>
              ) : (
                <Badge variant="warning">Provisional</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ExpiryPanel({ policy, isLoading, canEdit, onSaved }: { policy: ExpiryPolicy | null; isLoading: boolean; canEdit: boolean; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const [after, setAfter] = useState("365");
  const [notify, setNotify] = useState("30");
  const [disclosure, setDisclosure] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!policy) return;
    setEnabled(policy.enabled);
    setAfter(String(policy.expire_after_days ?? 365));
    setNotify(String(policy.notify_days_before ?? 30));
    setDisclosure(policy.disclosure ?? "");
  }, [policy]);

  const afterN = Number(after);
  const notifyN = Number(notify);
  const invalid = afterN < 90 || afterN > 3650 || notifyN < 7 || notifyN > 365 || !disclosure.trim();

  const save = async () => {
    setIsBusy(true);
    try {
      await put("/rewards/expiry-policy", { enabled, expire_after_days: afterN, notify_days_before: notifyN, disclosure: disclosure.trim() });
      toast.success("Expiry policy saved.");
      onSaved();
    } catch (caught) {
      toast.error(detail(caught, "Could not save the policy."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <DataPanel title="Expiry" description="Points that expire must say so to the person holding them, in advance." isLoading={isLoading}>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="flex items-center gap-3 sm:col-span-2">
          <Switch id="expiry-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={!canEdit} />
          <Label htmlFor="expiry-enabled" className="text-sm font-normal">
            Points expire
          </Label>
        </div>
        <FormField htmlFor="expiry-after" label="Days after award" error={after && (afterN < 90 || afterN > 3650) ? "90 to 3650." : undefined}>
          <Input id="expiry-after" inputMode="numeric" value={after} disabled={!canEdit || !enabled} onChange={(e) => setAfter(e.target.value.replace(/\D/g, ""))} />
        </FormField>
        <FormField htmlFor="expiry-notify" label="Warn this many days before" error={notify && (notifyN < 7 || notifyN > 365) ? "7 to 365." : undefined}>
          <Input id="expiry-notify" inputMode="numeric" value={notify} disabled={!canEdit || !enabled} onChange={(e) => setNotify(e.target.value.replace(/\D/g, ""))} />
        </FormField>
        <FormField htmlFor="expiry-disclosure" label="What people are told" className="sm:col-span-2" hint="Shown on every statement.">
          <Textarea id="expiry-disclosure" value={disclosure} disabled={!canEdit} onChange={(e) => setDisclosure(e.target.value)} rows={2} />
        </FormField>
        {canEdit && (
          <div className="sm:col-span-2">
            <Button onClick={save} disabled={isBusy || invalid}>
              {isBusy && <Loader2 className="animate-spin" />} Save expiry policy
            </Button>
          </div>
        )}
      </div>
    </DataPanel>
  );
}

function ValuationDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [rate, setRate] = useState("");
  const [from, setFrom] = useState(toISODate(new Date()));
  const [note, setNote] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setRate("");
      setFrom(toISODate(new Date()));
      setNote("");
    }
  }, [open]);

  const valid = /^\d+(\.\d{1,4})?$/.test(rate) && Number(rate) > 0;

  const submit = async () => {
    setIsBusy(true);
    try {
      await post("/rewards/valuations", { points_per_rupee: rate, effective_from: from, note: note.trim() || null });
      toast.success("New rate recorded.");
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "Could not set the rate."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New point value</DialogTitle>
          <DialogDescription>Applies to points awarded from this date. Earlier points keep their rate.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="valuation-rate" label="Points per rupee" hint="10 means ten points are worth one rupee.">
            <Input id="valuation-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.trim())} />
          </FormField>
          <FormField htmlFor="valuation-from" label="From">
            <Input id="valuation-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </FormField>
          <FormField htmlFor="valuation-note" label="Note" optional>
            <Input id="valuation-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || !valid}>
            {isBusy && <Loader2 className="animate-spin" />} Record rate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaxRuleDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [rewardType, setRewardType] = useState("");
  const [treatment, setTreatment] = useState<TaxTreatment>("gift_rule");
  const [threshold, setThreshold] = useState("5000");
  const [from, setFrom] = useState(toISODate(new Date()));
  const [basis, setBasis] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [reviewedBy, setReviewedBy] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRewardType("");
    setTreatment("gift_rule");
    setThreshold("5000");
    setFrom(toISODate(new Date()));
    setBasis("");
    setReviewed(false);
    setReviewedBy("");
  }, [open]);

  const invalid = !rewardType.trim() || !/^\d+(\.\d{1,2})?$/.test(threshold) || (reviewed && !reviewedBy.trim());

  const submit = async () => {
    setIsBusy(true);
    try {
      await post("/rewards/tax-rules", {
        reward_type: rewardType.trim(),
        treatment,
        exemption_threshold_per_year: threshold,
        effective_from: from,
        basis: basis.trim() || null,
        reviewed,
        reviewed_by: reviewed ? reviewedBy.trim() : null,
        reviewed_on: reviewed ? toISODate(new Date()) : null,
      });
      toast.success("Tax rule recorded.");
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "Could not record the rule."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tax rule</DialogTitle>
          <DialogDescription>
            Effective-dated, never edited. Mark it reviewed only once a tax advisor has signed it off — until then every
            figure it produces is labelled provisional.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="rule-type" label="Reward type">
            <Input id="rule-type" value={rewardType} onChange={(e) => setRewardType(e.target.value)} placeholder="points" />
          </FormField>
          <FormField htmlFor="rule-treatment" label="Treatment">
            <Select value={treatment} onValueChange={(next) => setTreatment(next as TaxTreatment)}>
              <SelectTrigger id="rule-treatment" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gift_rule">Gift rule (exempt up to a threshold)</SelectItem>
                <SelectItem value="perquisite">Perquisite (taxable)</SelectItem>
                <SelectItem value="exempt">Exempt</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="rule-threshold" label="Exempt up to per year (₹)">
            <Input id="rule-threshold" inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value.trim())} />
          </FormField>
          <FormField htmlFor="rule-from" label="From">
            <Input id="rule-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </FormField>
          <FormField htmlFor="rule-basis" label="Basis" optional className="sm:col-span-2" hint="The provision or opinion this rests on.">
            <Textarea id="rule-basis" value={basis} onChange={(e) => setBasis(e.target.value)} rows={2} />
          </FormField>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch id="rule-reviewed" checked={reviewed} onCheckedChange={setReviewed} />
            <Label htmlFor="rule-reviewed" className="text-sm font-normal">
              Reviewed by a tax advisor
            </Label>
          </div>
          {reviewed && (
            <FormField htmlFor="rule-reviewer" label="Reviewed by" className="sm:col-span-2">
              <Input id="rule-reviewer" value={reviewedBy} onChange={(e) => setReviewedBy(e.target.value)} />
            </FormField>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || invalid}>
            {isBusy && <Loader2 className="animate-spin" />} Record rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
