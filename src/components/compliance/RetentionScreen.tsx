"use client";

import { Archive, Gavel, History, Loader2, Lock, Play, Plus, ShieldCheck, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { EmployeePicker, type PickedEmployee } from "@/components/people/EmployeePicker";
import { useOrgReference } from "@/components/people/useOrgReference";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post, put } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";

type Action = "delete" | "anonymise" | "archive";
type RunStatus = "dry_run" | "awaiting_approval" | "approved" | "executed" | "rejected";

interface Policy {
  category: string;
  category_name: string;
  retention_period_months: number;
  anchor_event: string;
  action: Action;
  statutory_minimum_months: number | null;
  has_statutory_floor: boolean;
  legal_basis: string | null;
  active: boolean;
}

interface Hold {
  id: string;
  reason: string;
  employee_count: number | "all";
  departments: string[];
  from_date: string | null;
  to_date: string | null;
  placed_at: string;
  released_at: string | null;
  release_reason: string | null;
  is_active: boolean;
}

interface Run {
  id: string;
  evaluated_on: string;
  status: RunStatus;
  records_to_act: number;
  records_held: number;
  records_blocked: number;
  counts_by_action: Record<string, number>;
  approved_by_user_id: string | null;
  executed_at: string | null;
}

interface LogEntry {
  run_id: string;
  category: string;
  record_type: string;
  action: string;
  record_count: number;
  executed_at: string;
}

const ACTION_LABEL: Record<Action, string> = { delete: "Delete", anonymise: "Anonymise", archive: "Archive" };
const RUN_STATUS: Record<RunStatus, { label: string; variant: "outline" | "warning" | "secondary" | "success" | "muted" }> = {
  dry_run: { label: "Dry run", variant: "outline" },
  awaiting_approval: { label: "Awaiting approval", variant: "warning" },
  approved: { label: "Approved", variant: "secondary" },
  executed: { label: "Executed", variant: "success" },
  rejected: { label: "Rejected", variant: "muted" },
};

function detail(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/**
 * Compliance → Retention.
 *
 * Personal data is kept only as long as a purpose or a statute requires. Each
 * category's policy is set here and refused below its statutory floor; legal
 * holds freeze scopes against every policy; and deletion happens only through
 * a planned run that is previewed, approved and then executed — with
 * anonymisation labelled as what it is, not as deletion.
 */
export function RetentionScreen() {
  return (
    <PageShell title="Retention" description="How long each kind of data is kept, what freezes it, and every deletion carried out.">
      <SectionNav section="compliance" />
      <Tabs defaultValue="policies">
        <TabsList>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="holds">Legal holds</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="log">Action log</TabsTrigger>
        </TabsList>
        <TabsContent value="policies" className="mt-4">
          <PoliciesTab />
        </TabsContent>
        <TabsContent value="holds" className="mt-4">
          <HoldsTab />
        </TabsContent>
        <TabsContent value="runs" className="mt-4">
          <RunsTab />
        </TabsContent>
        <TabsContent value="log" className="mt-4">
          <LogTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function PoliciesTab() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("tenant_admin", "hr_admin");
  const { data, error, isLoading, reload } = useApiQuery<{ policies: Policy[]; unconfigured_categories: string[] }>("/retention/policies");
  const [editing, setEditing] = useState<Policy | { category: string; category_name: string } | null>(null);
  const [seeding, setSeeding] = useState(false);

  const seed = async () => {
    setSeeding(true);
    try {
      const result = await post<{ created: number }>("/retention/policies/seed");
      toast.success(`${result.created} categories set to their statutory floor.`);
      reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not set the defaults."));
    } finally {
      setSeeding(false);
    }
  };

  const unconfigured = data?.unconfigured_categories ?? [];

  return (
    <div className="flex flex-col gap-4">
      {unconfigured.length > 0 && (
        <Alert variant="warning">
          <Archive />
          <AlertTitle>{unconfigured.length} categories have no policy</AlertTitle>
          <AlertDescription>
            Data in them is never removed. {unconfigured.join(", ")}.
            {isAdmin && (
              <Button size="sm" variant="outline" className="mt-2" disabled={seeding} onClick={seed}>
                {seeding ? <Loader2 className="animate-spin" /> : <Sparkles />} Set them to the statutory floor
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      <DataPanel title="Retention policies" isLoading={isLoading} error={error?.detail ?? null} onRetry={reload} isEmpty={(data?.policies ?? []).length === 0} empty={{ icon: Archive, title: "No policies set" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Kept for</TableHead>
              <TableHead>Then</TableHead>
              <TableHead>Floor</TableHead>
              {isAdmin && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.policies ?? []).map((row) => (
              <TableRow key={row.category} className={row.active ? undefined : "opacity-60"}>
                <TableCell>
                  <div className="font-medium text-foreground">{row.category_name}</div>
                  {row.legal_basis && <div className="max-w-sm text-xs text-muted-foreground">{row.legal_basis}</div>}
                </TableCell>
                <TableCell className="text-sm">
                  {row.retention_period_months} months
                  <div className="text-xs text-muted-foreground">from {row.anchor_event.replaceAll("_", " ")}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={row.action === "delete" ? "destructive" : "outline"}>{ACTION_LABEL[row.action]}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {row.has_statutory_floor ? (
                    <span className="inline-flex items-center gap-1">
                      <Lock className="size-3.5" /> {row.statutory_minimum_months} months
                    </span>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                      Edit
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
      <PolicyDialog editing={editing} onOpenChange={(open) => !open && setEditing(null)} onSaved={reload} />
    </div>
  );
}

function PolicyDialog({
  editing,
  onOpenChange,
  onSaved,
}: {
  editing: Policy | { category: string; category_name: string } | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const existing = editing && "retention_period_months" in editing ? editing : null;
  const [months, setMonths] = useState("");
  const [action, setAction] = useState<Action>("delete");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setMonths(String(existing?.retention_period_months ?? ""));
    setAction(existing?.action ?? "delete");
  }, [editing, existing]);

  const floor = existing?.statutory_minimum_months ?? 0;
  const value = Number(months);
  const belowFloor = floor > 0 && value < floor;

  const submit = async () => {
    if (!editing) return;
    setIsBusy(true);
    try {
      await put("/retention/policies", { data_category_key: editing.category, retention_period_months: value, action, active: true });
      toast.success("Policy saved.");
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "The policy was refused."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={editing !== null} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Retention for {editing?.category_name}</DialogTitle>
          <DialogDescription>
            {floor > 0 ? `The law requires at least ${floor} months. Anything shorter is refused, with the statute named.` : "No statutory floor applies."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="policy-months" label="Keep for (months)" error={belowFloor ? `At least ${floor}.` : undefined}>
            <Input id="policy-months" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, ""))} />
          </FormField>
          <FormField
            htmlFor="policy-action"
            label="Then"
            hint={action === "anonymise" ? "Anonymised data is not deleted: the row stays, without anything identifying." : action === "archive" ? "There is no cold storage yet, so archive actions are recorded but not carried out." : undefined}
          >
            <Select value={action} onValueChange={(next) => setAction(next as Action)}>
              <SelectTrigger id="policy-action" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="anonymise">Anonymise</SelectItem>
                <SelectItem value="archive">Archive</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || !(value >= 1) || belowFloor}>
            {isBusy && <Loader2 className="animate-spin" />} Save policy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HoldsTab() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("tenant_admin", "hr_admin");
  const { data, error, isLoading, reload } = useApiQuery<{ holds: Hold[] }>("/retention/legal-holds");
  const [placing, setPlacing] = useState(false);
  const [releasing, setReleasing] = useState<Hold | null>(null);
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const release = async () => {
    if (!releasing) return;
    setIsBusy(true);
    try {
      await post(`/retention/legal-holds/${releasing.id}/release`, { release_reason: reason.trim() });
      toast.success("Hold released. The records return to their normal policies.");
      setReleasing(null);
      setReason("");
      reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not release the hold."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <DataPanel
        title="Legal holds"
        description="A hold freezes its scope against every retention policy — for litigation, an investigation or an audit."
        actions={isAdmin ? <Button size="sm" onClick={() => setPlacing(true)}><Plus /> Place a hold</Button> : undefined}
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data?.holds ?? []).length === 0}
        empty={{ icon: Gavel, title: "No legal holds" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reason</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.holds ?? []).map((row) => (
              <TableRow key={row.id} className={row.is_active ? undefined : "opacity-60"}>
                <TableCell className="max-w-sm text-sm">{row.reason}</TableCell>
                <TableCell className="text-xs">
                  {row.employee_count === "all" ? "Everyone" : `${row.employee_count} people`}
                  {row.departments.length > 0 && ` · ${row.departments.join(", ")}`}
                  {(row.from_date || row.to_date) && (
                    <div className="text-muted-foreground">
                      records {row.from_date ? formatDate(row.from_date) : "…"} – {row.to_date ? formatDate(row.to_date) : "…"}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.placed_at)}</TableCell>
                <TableCell>
                  {row.is_active ? (
                    <Badge variant="warning">Active</Badge>
                  ) : (
                    <>
                      <Badge variant="muted">Released</Badge>
                      {row.release_reason && <div className="text-xs text-muted-foreground">{row.release_reason}</div>}
                    </>
                  )}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    {row.is_active && (
                      <Button size="sm" variant="outline" onClick={() => setReleasing(row)}>
                        <Undo2 /> Release
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
      <HoldDialog open={placing} onOpenChange={setPlacing} onPlaced={reload} />
      <Dialog open={releasing !== null} onOpenChange={(next) => !isBusy && !next && setReleasing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Release this hold?</DialogTitle>
            <DialogDescription>The records return to their normal retention. The hold itself is kept, with your reason.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} aria-label="Why it is released" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleasing(null)} disabled={isBusy}>
              Keep it
            </Button>
            <Button onClick={release} disabled={isBusy || !reason.trim()}>
              {isBusy && <Loader2 className="animate-spin" />} Release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HoldDialog({ open, onOpenChange, onPlaced }: { open: boolean; onOpenChange: (open: boolean) => void; onPlaced: () => void }) {
  const org = useOrgReference();
  const [reason, setReason] = useState("");
  const [people, setPeople] = useState<PickedEmployee[]>([]);
  const [picker, setPicker] = useState<PickedEmployee | null>(null);
  const [department, setDepartment] = useState("__all__");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setPeople([]);
    setPicker(null);
    setDepartment("__all__");
    setFrom("");
    setTo("");
  }, [open]);

  const whole = people.length === 0 && department === "__all__" && !from && !to;

  const submit = async () => {
    setIsBusy(true);
    try {
      await post("/retention/legal-holds", {
        reason: reason.trim(),
        employee_ids: people.map((row) => row.id),
        departments: department === "__all__" ? [] : [org.departmentName(department)],
        from_date: from || null,
        to_date: to || null,
      });
      toast.success("Hold placed.");
      onPlaced();
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "The hold was not placed."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Place a legal hold</DialogTitle>
          <DialogDescription>Nothing in scope is deleted or anonymised by any policy until the hold is released.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="hold-reason" label="Reason">
            <Textarea id="hold-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Labour court matter 142/2026." />
          </FormField>
          <FormField htmlFor="hold-people" label={`People (${people.length || "everyone"})`} optional>
            <EmployeePicker
              id="hold-people"
              value={picker}
              onChange={(next) => {
                if (next && !people.some((row) => row.id === next.id)) setPeople([...people, next]);
                setPicker(null);
              }}
            />
          </FormField>
          {people.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {people.map((row) => (
                <Badge key={row.id} variant="secondary">
                  {row.label}
                </Badge>
              ))}
            </div>
          )}
          <FormField htmlFor="hold-department" label="Department">
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger id="hold-department" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Any department</SelectItem>
                {org.departments.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="hold-from" label="Records from" optional>
              <Input id="hold-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </FormField>
            <FormField htmlFor="hold-to" label="Records to" optional>
              <Input id="hold-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </FormField>
          </div>
          {whole && (
            <Alert variant="warning">
              <AlertTitle>This freezes the whole workspace</AlertTitle>
              <AlertDescription>With nothing narrowed, every record is held. That is a legitimate instruction — make sure it is the one you mean.</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || !reason.trim()}>
            {isBusy && <Loader2 className="animate-spin" />} Place hold
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunsTab() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("tenant_admin", "hr_admin");
  const { data, error, isLoading, reload } = useApiQuery<{ runs: Run[] }>("/retention/runs");
  const [busy, setBusy] = useState<string | null>(null);
  const [executing, setExecuting] = useState<Run | null>(null);
  const [rejecting, setRejecting] = useState<Run | null>(null);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<{
    records_actually_removed: number;
    records_anonymised: number;
    records_spared_by_legal_hold: number;
    records_not_actioned: number;
    problems: string[];
    not_built: string;
  } | null>(null);

  const call = async (key: string, path: string, success: string) => {
    setBusy(key);
    try {
      await post(path, key === "restore" ? {} : { approval_threshold: 50 });
      toast.success(success);
      reload();
    } catch (caught) {
      toast.error(detail(caught, "That did not run."));
    } finally {
      setBusy(null);
    }
  };

  const approve = async (run: Run) => {
    setBusy(run.id);
    try {
      await post(`/retention/runs/${run.id}/approve`);
      toast.success("Approved. It can now be executed.");
      reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not approve."));
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusy(rejecting.id);
    try {
      await post(`/retention/runs/${rejecting.id}/reject`, { reason: reason.trim() });
      toast.success("Rejected.");
      setRejecting(null);
      setReason("");
      reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not reject."));
    } finally {
      setBusy(null);
    }
  };

  const execute = async () => {
    if (!executing) return;
    try {
      setResult(await post(`/retention/runs/${executing.id}/execute`));
      reload();
    } catch (caught) {
      toast.error(detail(caught, "The run was not executed."));
      throw caught;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy !== null} onClick={() => call("preview", "/retention/sweep/preview", "Dry run recorded. Nothing was changed.")}>
            {busy === "preview" ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Dry run over our records
          </Button>
          <Button disabled={busy !== null} onClick={() => call("plan", "/retention/sweep/plan", "Run planned. Approve it before it can execute.")}>
            {busy === "plan" ? <Loader2 className="animate-spin" /> : <Play />} Plan a real run
          </Button>
          <Button variant="ghost" disabled={busy !== null} onClick={() => call("restore", "/retention/suppressions/apply", "Checked for erased records that came back from a backup.")}>
            {busy === "restore" ? <Loader2 className="animate-spin" /> : <History />} Re-apply erasures after a restore
          </Button>
        </div>
      )}

      {result && (
        <Alert variant={result.problems.length ? "warning" : "success"}>
          <AlertTitle>
            {result.records_actually_removed} deleted, {result.records_anonymised} anonymised, {result.records_spared_by_legal_hold} spared by a hold, {result.records_not_actioned} not actioned
          </AlertTitle>
          <AlertDescription>
            {result.problems.length > 0 && (
              <ul className="list-disc pl-5">
                {result.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
            <p className="mt-1">{result.not_built}</p>
          </AlertDescription>
        </Alert>
      )}

      <DataPanel title="Retention runs" isLoading={isLoading} error={error?.detail ?? null} onRetry={reload} isEmpty={(data?.runs ?? []).length === 0} empty={{ icon: Archive, title: "No runs yet", description: "Start with a dry run — it changes nothing." }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evaluated</TableHead>
              <TableHead className="text-right">To act on</TableHead>
              <TableHead className="text-right">Held / blocked</TableHead>
              <TableHead>By action</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead className="text-right">Next step</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.runs ?? []).map((run) => (
              <TableRow key={run.id}>
                <TableCell className="text-sm">{formatDate(run.evaluated_on)}</TableCell>
                <TableCell className="text-right tabular-nums">{run.records_to_act}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {run.records_held} / {run.records_blocked}
                </TableCell>
                <TableCell className="text-xs">
                  {Object.entries(run.counts_by_action).map(([key, count]) => `${key} ${count}`).join(" · ") || "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={RUN_STATUS[run.status].variant}>{RUN_STATUS[run.status].label}</Badge>
                  {run.executed_at && <div className="text-xs text-muted-foreground">{formatDateTime(run.executed_at)}</div>}
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {run.status === "awaiting_approval" && (
                        <>
                          <Button size="sm" disabled={busy !== null} onClick={() => approve(run)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setRejecting(run)}>
                            Reject
                          </Button>
                        </>
                      )}
                      {run.status === "approved" && (
                        <Button size="sm" variant="destructive" onClick={() => setExecuting(run)}>
                          Execute
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      <ConfirmDialog
        open={executing !== null}
        onOpenChange={(open) => !open && setExecuting(null)}
        title="Execute this retention run?"
        description={`${executing?.records_to_act ?? 0} records will be deleted or anonymised. Deleted rows cannot be recovered; the suppression list stops them returning from a backup.`}
        confirmLabel="Execute run"
        destructive
        onConfirm={execute}
      />
      <Dialog open={rejecting !== null} onOpenChange={(next) => !next && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this run?</DialogTitle>
            <DialogDescription>It will not execute. The reason is kept with it.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} aria-label="Why it is rejected" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button onClick={reject} disabled={!reason.trim() || busy !== null}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LogTab() {
  const { data, error, isLoading, reload } = useApiQuery<{ entries: LogEntry[] }>("/retention/action-log?limit=200");

  return (
    <DataPanel
      title="Action log"
      description="Every deletion and anonymisation carried out. Insert-only."
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={(data?.entries ?? []).length === 0}
      empty={{ icon: History, title: "Nothing has been deleted or anonymised yet" }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Action</TableHead>
            <TableHead className="text-right">Records</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data?.entries ?? []).map((row, index) => (
            <TableRow key={`${row.run_id}-${index}`}>
              <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.executed_at)}</TableCell>
              <TableCell className="text-sm">
                {row.category.replaceAll("_", " ")}
                <div className="font-mono text-xs text-muted-foreground">{row.record_type}</div>
              </TableCell>
              <TableCell>
                <Badge variant={row.action === "delete" ? "destructive" : "outline"} className="capitalize">
                  {row.action}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.record_count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataPanel>
  );
}
