"use client";

import { Activity, Bug, Laptop, Loader2, LogOut, Network, Plus, RadioTower, ServerCrash, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { FactTree } from "@/components/common/FactTree";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
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
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post, put } from "@/lib/api";
import { formatDate, formatDateTime, toISODate } from "@/lib/utils";

function detail(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

interface MySession {
  id: string;
  started_at: string;
  last_seen_at: string;
  ip_address: string | null;
  user_agent: string | null;
  approximate_location: string | null;
  location_caveat: string | null;
  state: string;
  is_usable: boolean;
  revoked_at: string | null;
  revoked_reason: string | null;
}

interface Policy {
  configured: boolean;
  idle_timeout_minutes: number;
  absolute_lifetime_hours: number;
  max_concurrent_sessions: number;
  enforce_ip_allowlist_for_privileged: boolean;
  ip_allowlist: string[];
}

interface ActiveSession {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: string;
  started_at: string;
  last_seen_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface Registers {
  drills: {
    id: string;
    tier: string;
    performed_on: string;
    measured_rto_minutes: number;
    measured_rpo_minutes: number;
    published_rto_minutes: number;
    published_rpo_minutes: number;
    succeeded: boolean;
    outcome: string;
    notes: string;
  }[];
  findings: {
    id: string;
    reference: string;
    title: string;
    severity: string;
    area: string;
    discovered_on: string;
    due_on: string | null;
    remediated_on: string | null;
    risk_accepted_reason: string | null;
    tester: string | null;
  }[];
  siem_destinations: { id: string; name: string; vendor: string; endpoint_url: string; active: boolean }[];
}

interface Health {
  destination: string;
  vendor: string;
  state: string;
  needs_alert: boolean;
  last_success_at: string | null;
  last_failure_at: string | null;
  consecutive_failures: number;
  minutes_since_success: number | null;
  message: string;
}

/**
 * Compliance → Security.
 *
 * What an enterprise security questionnaire asks, with the evidence rather than
 * the assertion: where accounts are signed in and the power to end them, the
 * session policy and IP allowlist, restore drills with measured recovery times,
 * penetration-test findings, and whether the SIEM is actually receiving events.
 */
export function SecurityScreen() {
  return (
    <PageShell title="Security" description="Sessions, access policy, recovery drills, penetration testing and SIEM delivery.">
      <Tabs defaultValue="sessions">
        <TabsList className="flex-wrap">
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="policy">Access policy</TabsTrigger>
          <TabsTrigger value="drills">Recovery drills</TabsTrigger>
          <TabsTrigger value="pentest">Penetration testing</TabsTrigger>
          <TabsTrigger value="siem">SIEM</TabsTrigger>
          <TabsTrigger value="posture">Posture statement</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions" className="mt-4">
          <SessionsTab />
        </TabsContent>
        <TabsContent value="policy" className="mt-4">
          <PolicyTab />
        </TabsContent>
        <TabsContent value="drills" className="mt-4">
          <DrillsTab />
        </TabsContent>
        <TabsContent value="pentest" className="mt-4">
          <PentestTab />
        </TabsContent>
        <TabsContent value="siem" className="mt-4">
          <SiemTab />
        </TabsContent>
        <TabsContent value="posture" className="mt-4">
          <PostureTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function SessionsTab() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("tenant_admin", "hr_admin");
  const mine = useApiQuery<{ sessions: MySession[]; active_count: number; enforced: boolean }>("/opsec/sessions");
  const everyone = useApiQuery<ActiveSession[]>(isAdmin ? "/opsec/sessions/active" : null);
  const [ending, setEnding] = useState<{ sessionId?: string; userId?: string; label: string } | null>(null);

  const revoke = async () => {
    if (!ending) return;
    try {
      await post("/opsec/sessions/revoke", {
        session_id: ending.sessionId ?? null,
        all_for_user: ending.userId ?? null,
        reason: "Signed out from the security screen.",
      });
      toast.success("Signed out.");
      mine.reload();
      everyone.reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not sign it out."));
      throw caught;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {mine.data && !mine.data.enforced && (
        <Alert>
          <Laptop />
          <AlertTitle>Session tracking starts once a session policy is saved</AlertTitle>
          <AlertDescription>Until then, sessions end when their tokens expire, and this list may be empty.</AlertDescription>
        </Alert>
      )}
      <DataPanel
        title="Where you are signed in"
        actions={
          user ? (
            <Button size="sm" variant="outline" onClick={() => setEnding({ userId: user.id, label: "everywhere, including here" })}>
              <LogOut /> Sign out everywhere
            </Button>
          ) : undefined
        }
        isLoading={mine.isLoading}
        error={mine.error?.detail ?? null}
        onRetry={mine.reload}
        isEmpty={(mine.data?.sessions ?? []).length === 0}
        empty={{ icon: Laptop, title: "No tracked sessions" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(mine.data?.sessions ?? []).map((row) => (
              <TableRow key={row.id} className={row.is_usable ? undefined : "opacity-60"}>
                <TableCell className="max-w-xs truncate text-xs" title={row.user_agent ?? undefined}>
                  {row.user_agent ?? "Unknown device"}
                </TableCell>
                <TableCell className="text-sm">
                  {row.approximate_location ?? row.ip_address ?? "—"}
                  {row.location_caveat && <div className="text-xs text-muted-foreground">{row.location_caveat}</div>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.last_seen_at)}</TableCell>
                <TableCell>
                  <Badge variant={row.is_usable ? "success" : "muted"} className="capitalize">
                    {row.state.replaceAll("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  {row.is_usable && (
                    <Button size="sm" variant="ghost" onClick={() => setEnding({ sessionId: row.id, label: "this session" })}>
                      Sign out
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      {isAdmin && (
        <DataPanel
          title="Everyone signed in"
          isLoading={everyone.isLoading}
          error={everyone.error?.detail ?? null}
          onRetry={everyone.reload}
          isEmpty={(everyone.data ?? []).length === 0}
          empty={{ icon: Laptop, title: "No tracked sessions in the workspace" }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(everyone.data ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{row.user_name}</div>
                    <div className="text-xs text-muted-foreground">{row.user_email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.role.replaceAll("_", " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{row.ip_address ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.last_seen_at)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setEnding({ userId: row.user_id, label: `${row.user_name} everywhere` })}>
                      Sign out
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      )}

      <ConfirmDialog
        open={ending !== null}
        onOpenChange={(open) => !open && setEnding(null)}
        title={`Sign out ${ending?.label ?? ""}?`}
        description="It takes effect on the next request, not when the session would have expired."
        confirmLabel="Sign out"
        destructive
        onConfirm={revoke}
      />
    </div>
  );
}

function PolicyTab() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("tenant_admin", "hr_admin");
  const { data, isLoading, error, reload } = useApiQuery<Policy>(isAdmin ? "/opsec/sessions/policy" : null);
  const [idle, setIdle] = useState("");
  const [lifetime, setLifetime] = useState("");
  const [concurrent, setConcurrent] = useState("0");
  const [enforce, setEnforce] = useState(false);
  const [allowlist, setAllowlist] = useState("");
  const [probe, setProbe] = useState("");
  const [probeResult, setProbeResult] = useState<{ outcome: string; message: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setIdle(String(data.idle_timeout_minutes));
    setLifetime(String(data.absolute_lifetime_hours));
    setConcurrent(String(data.max_concurrent_sessions));
    setEnforce(data.enforce_ip_allowlist_for_privileged);
    setAllowlist(data.ip_allowlist.join("\n"));
  }, [data]);

  if (!isAdmin) {
    return (
      <Alert>
        <AlertDescription>The session policy is managed by tenant and HR admins.</AlertDescription>
      </Alert>
    );
  }

  const entries = allowlist.split(/[\n,]/).map((row) => row.trim()).filter(Boolean);

  const save = async () => {
    setIsBusy(true);
    try {
      await put("/opsec/sessions/policy", {
        idle_timeout_minutes: Number(idle),
        absolute_lifetime_hours: Number(lifetime),
        max_concurrent_sessions: Number(concurrent),
        enforce_ip_allowlist_for_privileged: enforce,
        ip_allowlist: entries,
      });
      toast.success("Session policy saved. It applies from the next request.");
      reload();
    } catch (caught) {
      toast.error(detail(caught, "The policy was refused."));
    } finally {
      setIsBusy(false);
    }
  };

  const test = async () => {
    try {
      setProbeResult(await post<{ outcome: string; message: string }>("/opsec/allowlist/check", { address: probe.trim() }));
    } catch (caught) {
      setProbeResult({ outcome: "error", message: detail(caught, "Could not test that address.") });
    }
  };

  return (
    <DataPanel
      title="Session and access policy"
      description={data && !data.configured ? "These are the defaults. Nothing is enforced until you save." : undefined}
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
    >
      <div className="grid gap-4 p-5 sm:grid-cols-3">
        <FormField htmlFor="policy-idle" label="Idle timeout (minutes)">
          <Input id="policy-idle" inputMode="numeric" value={idle} onChange={(e) => setIdle(e.target.value.replace(/\D/g, ""))} />
        </FormField>
        <FormField htmlFor="policy-lifetime" label="Absolute lifetime (hours)" hint="Even an active session ends after this.">
          <Input id="policy-lifetime" inputMode="numeric" value={lifetime} onChange={(e) => setLifetime(e.target.value.replace(/\D/g, ""))} />
        </FormField>
        <FormField htmlFor="policy-concurrent" label="Sessions per person" hint="0 means no limit.">
          <Input id="policy-concurrent" inputMode="numeric" value={concurrent} onChange={(e) => setConcurrent(e.target.value.replace(/\D/g, ""))} />
        </FormField>

        <div className="flex items-start gap-3 sm:col-span-3">
          <Switch id="policy-enforce" checked={enforce} onCheckedChange={setEnforce} />
          <Label htmlFor="policy-enforce" className="text-sm font-normal">
            Admins and HR may sign in only from the addresses below. Employees are never restricted.
          </Label>
        </div>
        <FormField
          htmlFor="policy-allowlist"
          label="Allowed address ranges"
          className="sm:col-span-2"
          hint="One CIDR range per line. An empty list permits everything — unconfigured and deny-all are different states."
        >
          <Textarea id="policy-allowlist" value={allowlist} onChange={(e) => setAllowlist(e.target.value)} rows={4} className="font-mono text-xs" placeholder={"203.0.113.0/24\n198.51.100.14/32"} />
        </FormField>
        <div className="grid content-start gap-2">
          <FormField htmlFor="policy-probe" label="Test an address" optional>
            <Input id="policy-probe" value={probe} onChange={(e) => setProbe(e.target.value)} placeholder="203.0.113.7" className="font-mono text-xs" />
          </FormField>
          <Button size="sm" variant="outline" className="w-fit" disabled={!probe.trim()} onClick={test}>
            <Network /> Check against the saved list
          </Button>
          {probeResult && (
            <p className={probeResult.outcome === "blocked" || probeResult.outcome === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              {probeResult.message}
            </p>
          )}
        </div>
        {enforce && entries.length === 0 && (
          <Alert variant="warning" className="sm:col-span-3">
            <AlertTitle>Enforcement is on, but the list is empty</AlertTitle>
            <AlertDescription>An empty list permits every address, so this restricts nobody yet.</AlertDescription>
          </Alert>
        )}
        <div className="sm:col-span-3">
          <Button onClick={save} disabled={isBusy || !(Number(idle) >= 1) || !(Number(lifetime) >= 1)}>
            {isBusy && <Loader2 className="animate-spin" />} Save policy
          </Button>
        </div>
      </div>
    </DataPanel>
  );
}

function DrillsTab() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("tenant_admin", "hr_admin");
  const registers = useApiQuery<Registers>(isAdmin ? "/opsec/registers" : null);
  const continuity = useApiQuery<Record<string, unknown>>("/opsec/continuity");
  const [recording, setRecording] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <DataPanel
          title="Restore drills"
          description="Measured recovery times against the published objectives. A drill whose time was estimated is a rehearsal of the paperwork."
          actions={<Button size="sm" onClick={() => setRecording(true)}><Plus /> Record a drill</Button>}
          isLoading={registers.isLoading}
          error={registers.error?.detail ?? null}
          onRetry={registers.reload}
          isEmpty={(registers.data?.drills ?? []).length === 0}
          empty={{ icon: ServerCrash, title: "No restore drill has been performed", description: "Until one is, the recovery objectives are a promise, not evidence." }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">RTO (measured / promised)</TableHead>
                <TableHead className="text-right">RPO (measured / promised)</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(registers.data?.drills ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm">{formatDate(row.performed_on)}</TableCell>
                  <TableCell className="capitalize">{row.tier}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.measured_rto_minutes} / {row.published_rto_minutes} min
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.measured_rpo_minutes} / {row.published_rpo_minutes} min
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.outcome === "met" ? "success" : "destructive"}>{row.outcome.replaceAll("_", " ")}</Badge>
                    {row.notes && <div className="max-w-xs text-xs text-muted-foreground">{row.notes}</div>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      )}
      <DataPanel title="Published recovery posture" isLoading={continuity.isLoading} error={continuity.error?.detail ?? null} onRetry={continuity.reload}>
        {continuity.data && (
          <div className="p-5">
            <FactTree value={continuity.data} />
          </div>
        )}
      </DataPanel>
      <DrillDialog open={recording} onOpenChange={setRecording} onRecorded={registers.reload} />
    </div>
  );
}

function DrillDialog({ open, onOpenChange, onRecorded }: { open: boolean; onOpenChange: (open: boolean) => void; onRecorded: () => void }) {
  const [tier, setTier] = useState("critical");
  const [on, setOn] = useState(toISODate(new Date()));
  const [rto, setRto] = useState("");
  const [rpo, setRpo] = useState("");
  const [succeeded, setSucceeded] = useState(true);
  const [notes, setNotes] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTier("critical");
    setOn(toISODate(new Date()));
    setRto("");
    setRpo("");
    setSucceeded(true);
    setNotes("");
  }, [open]);

  const submit = async () => {
    setIsBusy(true);
    try {
      await post("/opsec/drills", { tier, performed_on: on, measured_rto_minutes: Number(rto), measured_rpo_minutes: Number(rpo), succeeded, notes: notes.trim() });
      toast.success("Drill recorded.");
      onRecorded();
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "The drill was not recorded."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a restore drill</DialogTitle>
          <DialogDescription>Enter what was measured, stopwatch in hand.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="drill-tier" label="Data tier">
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger id="drill-tier" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="core">Core</SelectItem>
                <SelectItem value="analytical">Analytical</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="drill-on" label="Performed on">
            <Input id="drill-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
          </FormField>
          <FormField htmlFor="drill-rto" label="Time to restore (minutes)">
            <Input id="drill-rto" inputMode="numeric" value={rto} onChange={(e) => setRto(e.target.value.replace(/\D/g, ""))} />
          </FormField>
          <FormField htmlFor="drill-rpo" label="Data lost (minutes)">
            <Input id="drill-rpo" inputMode="numeric" value={rpo} onChange={(e) => setRpo(e.target.value.replace(/\D/g, ""))} />
          </FormField>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch id="drill-ok" checked={succeeded} onCheckedChange={setSucceeded} />
            <Label htmlFor="drill-ok" className="text-sm font-normal">
              The restore succeeded
            </Label>
          </div>
          <FormField htmlFor="drill-notes" label="Notes" optional className="sm:col-span-2">
            <Textarea id="drill-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || rto === "" || rpo === ""}>
            {isBusy && <Loader2 className="animate-spin" />} Record drill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PentestTab() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("tenant_admin", "hr_admin");
  const registers = useApiQuery<Registers>(isAdmin ? "/opsec/registers" : null);
  const scope = useApiQuery<Record<string, unknown>>("/opsec/pentest-scope");
  const [recording, setRecording] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <DataPanel
          title="Findings"
          actions={<Button size="sm" onClick={() => setRecording(true)}><Plus /> Record a finding</Button>}
          isLoading={registers.isLoading}
          error={registers.error?.detail ?? null}
          onRetry={registers.reload}
          isEmpty={(registers.data?.findings ?? []).length === 0}
          empty={{ icon: Bug, title: "No penetration test recorded", description: "An empty list is not the same as a clean test." }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Finding</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Found</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(registers.data?.findings ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{row.title}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {row.reference} · {row.area.replaceAll("_", " ")}
                      {row.tester && ` · ${row.tester}`}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.severity === "critical" || row.severity === "high" ? "destructive" : "outline"} className="capitalize">
                      {row.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(row.discovered_on)}
                    {row.due_on && !row.remediated_on && <div className="text-xs text-muted-foreground">fix by {formatDate(row.due_on)}</div>}
                  </TableCell>
                  <TableCell>
                    {row.remediated_on ? (
                      <Badge variant="success">Fixed {formatDate(row.remediated_on)}</Badge>
                    ) : row.risk_accepted_reason ? (
                      <Badge variant="warning">Risk accepted</Badge>
                    ) : (
                      <Badge variant="outline">Open</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      )}
      <DataPanel title="Minimum test scope" description="What a test has to cover for its result to mean anything." isLoading={scope.isLoading} error={scope.error?.detail ?? null} onRetry={scope.reload}>
        {scope.data && (
          <div className="p-5">
            <FactTree value={scope.data} />
          </div>
        )}
      </DataPanel>
      <FindingDialog open={recording} onOpenChange={setRecording} onRecorded={registers.reload} />
    </div>
  );
}

function FindingDialog({ open, onOpenChange, onRecorded }: { open: boolean; onOpenChange: (open: boolean) => void; onRecorded: () => void }) {
  const scope = useApiQuery<{ required_scope: string[]; all_areas: string[] }>(open ? "/opsec/pentest-scope" : null);
  const [reference, setReference] = useState("");
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [area, setArea] = useState("");
  const [on, setOn] = useState(toISODate(new Date()));
  const [tester, setTester] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  // The API's own list: an area it does not know is refused.
  const areas = scope.data?.all_areas ?? [];

  useEffect(() => {
    if (!open) return;
    setReference("");
    setTitle("");
    setSeverity("medium");
    setArea("");
    setOn(toISODate(new Date()));
    setTester("");
  }, [open]);

  const submit = async () => {
    setIsBusy(true);
    try {
      await post("/opsec/findings", { reference: reference.trim(), title: title.trim(), severity, area, discovered_on: on, tester: tester.trim() || null });
      toast.success("Finding recorded. Its fix-by date follows from the severity.");
      onRecorded();
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "The finding was not recorded."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record a penetration-test finding</DialogTitle>
          <DialogDescription>From the tester&apos;s report.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="finding-ref" label="Reference">
            <Input id="finding-ref" value={reference} onChange={(e) => setReference(e.target.value)} className="font-mono" placeholder="PT-2026-07" />
          </FormField>
          <FormField htmlFor="finding-severity" label="Severity">
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger id="finding-severity" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["critical", "high", "medium", "low", "informational"].map((key) => (
                  <SelectItem key={key} value={key} className="capitalize">
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="finding-title" label="Title" className="sm:col-span-2">
            <Input id="finding-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField htmlFor="finding-area" label="Area">
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger id="finding-area" className="w-full">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {areas.map((key) => (
                  <SelectItem key={key} value={key}>
                    {key.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="finding-on" label="Found on">
            <Input id="finding-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
          </FormField>
          <FormField htmlFor="finding-tester" label="Tester" optional className="sm:col-span-2">
            <Input id="finding-tester" value={tester} onChange={(e) => setTester(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || !reference.trim() || !title.trim() || !area}>
            {isBusy && <Loader2 className="animate-spin" />} Record finding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SiemTab() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("tenant_admin", "hr_admin");
  const health = useApiQuery<{ destinations: Health[]; alerting: Health[] }>("/opsec/siem/health");
  const preview = useApiQuery<Record<string, unknown>>("/opsec/siem/preview?limit=5");
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {(health.data?.alerting ?? []).length > 0 && (
        <Alert variant="destructive">
          <RadioTower />
          <AlertTitle>{health.data!.alerting.length} SIEM destination(s) are not receiving events</AlertTitle>
          <AlertDescription>A silent destination is the failure mode that goes unnoticed longest.</AlertDescription>
        </Alert>
      )}
      <DataPanel
        title="SIEM destinations"
        actions={isAdmin ? <Button size="sm" onClick={() => setAdding(true)}><Plus /> Add destination</Button> : undefined}
        isLoading={health.isLoading}
        error={health.error?.detail ?? null}
        onRetry={health.reload}
        isEmpty={(health.data?.destinations ?? []).length === 0}
        empty={{ icon: Activity, title: "No SIEM configured", description: "Security events stay in the audit trail only." }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destination</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Last delivery</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(health.data?.destinations ?? []).map((row) => (
              <TableRow key={row.destination}>
                <TableCell>
                  <div className="font-medium text-foreground">{row.destination}</div>
                  <div className="text-xs text-muted-foreground">{row.vendor.replaceAll("_", " ")}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={row.needs_alert ? "destructive" : "success"} className="capitalize">
                    {row.state.replaceAll("_", " ")}
                  </Badge>
                  <div className="max-w-sm text-xs text-muted-foreground">{row.message}</div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.last_success_at ? formatDateTime(row.last_success_at) : "Never"}
                  {row.consecutive_failures > 0 && <div className="text-destructive">{row.consecutive_failures} failures in a row</div>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
      <DataPanel title="What arrives" description="Recent audit events, in the exact shape your SIEM receives." isLoading={preview.isLoading} error={preview.error?.detail ?? null} onRetry={preview.reload}>
        {preview.data && (
          <div className="p-5">
            <FactTree value={preview.data} />
          </div>
        )}
      </DataPanel>
      <DestinationDialog open={adding} onOpenChange={setAdding} onAdded={health.reload} />
    </div>
  );
}

function DestinationDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (open: boolean) => void; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("splunk");
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState("1440");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setVendor("splunk");
    setUrl("");
    setInterval("1440");
  }, [open]);

  const submit = async () => {
    setIsBusy(true);
    try {
      await put("/opsec/siem/destinations", { name: name.trim(), vendor, endpoint_url: url.trim(), expected_interval_minutes: Number(interval) });
      toast.success("Destination saved.");
      onAdded();
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "The destination was refused."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a SIEM destination</DialogTitle>
          <DialogDescription>Set the normal gap between events, so a quiet night does not look like an outage.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="siem-name" label="Name">
            <Input id="siem-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="SOC Splunk" />
          </FormField>
          <FormField htmlFor="siem-vendor" label="Vendor">
            <Select value={vendor} onValueChange={setVendor}>
              <SelectTrigger id="siem-vendor" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="splunk">Splunk</SelectItem>
                <SelectItem value="microsoft_sentinel">Microsoft Sentinel</SelectItem>
                <SelectItem value="datadog">Datadog</SelectItem>
                <SelectItem value="generic_https">Generic HTTPS</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="siem-url" label="Endpoint URL">
            <Input id="siem-url" value={url} onChange={(e) => setUrl(e.target.value)} className="font-mono text-xs" />
          </FormField>
          <FormField htmlFor="siem-interval" label="Normal gap between events (minutes)">
            <Input id="siem-interval" inputMode="numeric" value={interval} onChange={(e) => setInterval(e.target.value.replace(/\D/g, ""))} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || !name.trim() || !url.trim() || !(Number(interval) >= 1)}>
            {isBusy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostureTab() {
  const { data, error, isLoading, reload } = useApiQuery<Record<string, unknown>>("/opsec/posture");

  return (
    <DataPanel
      title="Security posture"
      description="What a procurement questionnaire asks, answered from the records above — including what is not built."
      actions={<ShieldCheck className="size-4 text-muted-foreground" />}
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
    >
      {data && (
        <div className="p-5">
          <FactTree value={data} />
        </div>
      )}
    </DataPanel>
  );
}
