"use client";

import { Bot, Check, CircleSlash, FlaskConical, Gauge, Loader2, Lock, ShieldAlert, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { formatDateTime } from "@/lib/utils";

type Autonomy = "suggest_only" | "propose_for_approval" | "auto_apply_with_notify" | "auto_apply_silent";
type ProposalStatus = "pending" | "approved" | "rejected" | "expired" | "auto_applied" | "reverted";

const AUTONOMY_LABEL: Record<Autonomy, string> = {
  suggest_only: "Suggest only",
  propose_for_approval: "Propose; a person approves",
  auto_apply_with_notify: "Apply, then tell someone",
  auto_apply_silent: "Apply silently",
};
const AUTONOMY_ORDER: Autonomy[] = ["suggest_only", "propose_for_approval", "auto_apply_with_notify", "auto_apply_silent"];

interface ActionConfig {
  key: string;
  agent_key: string;
  action_key: string;
  description: string;
  default_autonomy: Autonomy;
  max_autonomy: Autonomy;
  max_autonomy_label: string;
  is_protected: boolean;
  ceiling_reason: string;
  configured_autonomy: Autonomy;
  is_tenant_configured: boolean;
  threshold_value: string | null;
  approver_roles: string[];
}

interface Proposal {
  id: string;
  action_key: string;
  agent_key: string;
  description: string;
  subject_type: string;
  proposed_change: Record<string, unknown>;
  reasoning: string;
  citations: string[];
  confidence: number;
  impact: string;
  reversible: boolean;
  status: ProposalStatus;
  routing_reason: string;
  created_at: string;
  expires_at: string | null;
  age_days: number;
  is_expired: boolean;
}

function detail(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/**
 * Compliance → AI governance.
 *
 * Agents propose; humans approve, unless a workspace explicitly allows more for
 * a given action — and some actions can never be applied automatically,
 * whatever is configured. Every proposal shows its reasoning, citations and a
 * confidence value (FS-ANL-02); every agent call is logged with the citations
 * that failed verification, not just the ones that passed.
 */
export function AiGovernanceScreen() {
  const posture = useApiQuery<{ invocations: unknown[]; not_built?: string[] }>("/grounding/invocations?limit=1");

  return (
    <PageShell title="AI governance" description="What Mira's agents may do on their own, what they proposed, and how they are tested.">
      {posture.data?.not_built && posture.data.not_built.length > 0 && (
        <Alert variant="warning">
          <CircleSlash />
          <AlertTitle>The controls are built; the agents that use them are not all live</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {posture.data.not_built.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-1">Empty queues and logs below mean exactly that — nothing has been proposed or called — not that something is hidden.</p>
          </AlertDescription>
        </Alert>
      )}
      <Tabs defaultValue="proposals">
        <TabsList className="flex-wrap">
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="autonomy">Autonomy settings</TabsTrigger>
          <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
          <TabsTrigger value="grounding">Grounding &amp; injection</TabsTrigger>
          <TabsTrigger value="transparency">Transparency</TabsTrigger>
        </TabsList>
        <TabsContent value="proposals" className="mt-4">
          <ProposalsTab />
        </TabsContent>
        <TabsContent value="autonomy" className="mt-4">
          <AutonomyTab />
        </TabsContent>
        <TabsContent value="evaluation" className="mt-4">
          <EvaluationTab />
        </TabsContent>
        <TabsContent value="grounding" className="mt-4">
          <GroundingTab />
        </TabsContent>
        <TabsContent value="transparency" className="mt-4">
          <TransparencyTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function ProposalsTab() {
  const [includeDecided, setIncludeDecided] = useState(false);
  const { data, error, isLoading, reload } = useApiQuery<{ proposals: Proposal[] }>(`/autonomy/proposals?include_decided=${includeDecided}`);
  const stats = useApiQuery<{ looks_defective: { action_key: string; reason?: string }[] | string[]; note: string }>("/autonomy/decision-stats");
  const [deciding, setDeciding] = useState<{ proposal: Proposal; approve: boolean } | null>(null);
  const [reverting, setReverting] = useState<Proposal | null>(null);
  const [text, setText] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [expiring, setExpiring] = useState(false);

  const decide = async () => {
    if (!deciding) return;
    setIsBusy(true);
    try {
      await post(`/autonomy/proposals/${deciding.proposal.id}/decide`, { approve: deciding.approve, note: text.trim() });
      toast.success(deciding.approve ? "Approved and applied." : "Rejected.");
      setDeciding(null);
      setText("");
      reload();
      stats.reload();
    } catch (caught) {
      toast.error(detail(caught, "The decision was not recorded."));
    } finally {
      setIsBusy(false);
    }
  };

  const revert = async () => {
    if (!reverting) return;
    setIsBusy(true);
    try {
      await post(`/autonomy/proposals/${reverting.id}/revert`, { reason: text.trim() });
      toast.success("Reverted. The revert is recorded; restoring the previous state depends on the action.");
      setReverting(null);
      setText("");
      reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not revert."));
    } finally {
      setIsBusy(false);
    }
  };

  const expire = async () => {
    setExpiring(true);
    try {
      await post("/autonomy/proposals/expire");
      toast.success("Lapsed proposals marked expired. None was applied late.");
      reload();
    } catch (caught) {
      toast.error(detail(caught, "The expiry sweep did not run."));
    } finally {
      setExpiring(false);
    }
  };

  const defective = (stats.data?.looks_defective ?? []) as unknown[];

  return (
    <div className="flex flex-col gap-4">
      {defective.length > 0 && (
        <Alert variant="warning">
          <Gauge />
          <AlertTitle>Some actions are rejected often enough to look defective</AlertTitle>
          <AlertDescription>
            <FactTree value={defective} />
            <p className="mt-1">{stats.data?.note}</p>
          </AlertDescription>
        </Alert>
      )}
      <DataPanel
        title="Proposal queue"
        description="Each shows the reasoning, the records it relied on, and how confident the agent was."
        actions={
          <>
            <div className="flex items-center gap-2">
              <Switch id="proposals-decided" checked={includeDecided} onCheckedChange={setIncludeDecided} />
              <Label htmlFor="proposals-decided" className="text-sm font-normal">
                Include decided
              </Label>
            </div>
            <Button size="sm" variant="outline" onClick={expire} disabled={expiring}>
              {expiring && <Loader2 className="animate-spin" />} Expire lapsed
            </Button>
          </>
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data?.proposals ?? []).length === 0}
        empty={{ icon: Bot, title: "No proposals", description: "When an agent proposes a change, it waits here for a person." }}
      >
        <ul className="divide-y divide-border">
          {(data?.proposals ?? []).map((row) => (
            <li key={row.id} className="grid gap-2 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{row.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.agent_key} · {row.action_key} · {row.subject_type} · {row.age_days} day(s) old
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">Confidence {Math.round(row.confidence * 100)}%</Badge>
                  <Badge variant={row.impact === "high" || row.impact === "critical" ? "destructive" : "outline"} className="capitalize">
                    {row.impact} impact
                  </Badge>
                  {!row.reversible && <Badge variant="warning">Not reversible</Badge>}
                  <Badge variant={row.status === "pending" ? "secondary" : "muted"} className="capitalize">
                    {row.status.replaceAll("_", " ")}
                  </Badge>
                </div>
              </div>
              <p className="text-sm whitespace-pre-line">{row.reasoning}</p>
              {row.citations.length > 0 && (
                <p className="text-xs text-muted-foreground">Relied on: {row.citations.join(", ")}</p>
              )}
              <p className="text-xs text-muted-foreground">Why it is here: {row.routing_reason}</p>
              <div className="flex flex-wrap gap-2">
                {row.status === "pending" && !row.is_expired && (
                  <>
                    <Button size="sm" onClick={() => setDeciding({ proposal: row, approve: true })}>
                      <Check /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeciding({ proposal: row, approve: false })}>
                      <X /> Reject
                    </Button>
                  </>
                )}
                {(row.status === "approved" || row.status === "auto_applied") && row.reversible && (
                  <Button size="sm" variant="outline" onClick={() => setReverting(row)}>
                    <Undo2 /> Revert
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </DataPanel>

      <Dialog open={deciding !== null} onOpenChange={(next) => !isBusy && !next && setDeciding(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{deciding?.approve ? "Approve" : "Reject"} this proposal?</DialogTitle>
            <DialogDescription>{deciding?.proposal.description}</DialogDescription>
          </DialogHeader>
          <FormField htmlFor="decide-note" label="Note" optional={deciding?.approve}>
            <Textarea id="decide-note" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeciding(null)} disabled={isBusy}>
              Cancel
            </Button>
            <Button onClick={decide} disabled={isBusy || (!deciding?.approve && !text.trim())}>
              {isBusy && <Loader2 className="animate-spin" />} {deciding?.approve ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={reverting !== null} onOpenChange={(next) => !isBusy && !next && setReverting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revert this action?</DialogTitle>
            <DialogDescription>The revert is recorded with your reason.</DialogDescription>
          </DialogHeader>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-label="Why it is reverted" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverting(null)} disabled={isBusy}>
              Cancel
            </Button>
            <Button onClick={revert} disabled={isBusy || !text.trim()}>
              {isBusy && <Loader2 className="animate-spin" />} Revert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AutonomyTab() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("tenant_admin", "hr_admin");
  const { data, error, isLoading, reload } = useApiQuery<{ actions: ActionConfig[]; protected_statement: string }>("/autonomy/configuration");
  const [editing, setEditing] = useState<ActionConfig | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {data && (
        <Alert>
          <Lock />
          <AlertTitle>Some actions can never be applied automatically</AlertTitle>
          <AlertDescription>{data.protected_statement}</AlertDescription>
        </Alert>
      )}
      <DataPanel title="What each action may do on its own" isLoading={isLoading} error={error?.detail ?? null} onRetry={reload} isEmpty={(data?.actions ?? []).length === 0} empty={{ icon: Bot, title: "No agent actions registered" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Set to</TableHead>
              <TableHead>Ceiling</TableHead>
              {isAdmin && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.actions ?? []).map((row) => (
              <TableRow key={row.key}>
                <TableCell>
                  <div className="font-medium text-foreground">{row.description}</div>
                  <div className="font-mono text-xs text-muted-foreground">{row.key}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={row.configured_autonomy.startsWith("auto") ? "warning" : "outline"}>{AUTONOMY_LABEL[row.configured_autonomy]}</Badge>
                  {!row.is_tenant_configured && <div className="text-xs text-muted-foreground">default</div>}
                  {row.threshold_value && <div className="text-xs text-muted-foreground">above {row.threshold_value} needs approval</div>}
                </TableCell>
                <TableCell className="max-w-sm text-xs">
                  {row.is_protected && (
                    <Badge variant="secondary" className="mb-1">
                      <Lock /> Protected
                    </Badge>
                  )}
                  <div>{row.max_autonomy_label}</div>
                  <div className="text-muted-foreground">{row.ceiling_reason}</div>
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                      Change
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
      <AutonomyDialog action={editing} onOpenChange={(open) => !open && setEditing(null)} onSaved={reload} />
    </div>
  );
}

function AutonomyDialog({ action, onOpenChange, onSaved }: { action: ActionConfig | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [level, setLevel] = useState<Autonomy>("propose_for_approval");
  const [threshold, setThreshold] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!action) return;
    setLevel(action.configured_autonomy);
    setThreshold(action.threshold_value ?? "");
  }, [action]);

  const ceiling = action ? AUTONOMY_ORDER.indexOf(action.max_autonomy) : 0;
  const options = AUTONOMY_ORDER.filter((_, index) => index <= ceiling);

  const submit = async () => {
    if (!action) return;
    setIsBusy(true);
    try {
      await put("/autonomy/configuration", { action_key: action.key, autonomy: level, threshold_value: threshold || null, approver_roles: action.approver_roles });
      toast.success("Autonomy updated.");
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "Refused — it may be above this action's ceiling."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={action !== null} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{action?.description}</DialogTitle>
          <DialogDescription>Only levels up to this action&apos;s ceiling are offered: {action?.ceiling_reason}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="autonomy-level" label="The agent may">
            <Select value={level} onValueChange={(next) => setLevel(next as Autonomy)}>
              <SelectTrigger id="autonomy-level" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((key) => (
                  <SelectItem key={key} value={key}>
                    {AUTONOMY_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {level.startsWith("auto") && (
            <FormField htmlFor="autonomy-threshold" label="Still ask a person above" optional hint="A magnitude above which the action waits for approval even when auto-apply is allowed.">
              <Input id="autonomy-threshold" inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value.trim())} />
            </FormField>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy}>
            {isBusy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EvaluationTab() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("tenant_admin", "hr_admin");
  const coverage = useApiQuery<{
    suites: { agent_key: string; name: string; version: string; is_scoring_agent: boolean; case_count: number; regression_case_count: number }[];
    agents_without_suites: string[];
    not_built: string[] | string;
  }>("/agent-eval/coverage");
  const [agent, setAgent] = useState<string | null>(null);
  const runs = useApiQuery<{ runs: { id: string; started_at: string; triggered_by: string; pass_count: number; fail_count: number; error_count: number; gate_outcome: string; allows_merge: boolean; blocking_reasons: string[] }[] }>(
    agent ? `/agent-eval/${agent}/runs` : null,
  );
  const feedback = useApiQuery<{ feedback: { id: string; agent_key: string; was_useful: boolean; comment: string | null; created_at: string; promoted_to_case_id: string | null }[] }>("/agent-eval/feedback?limit=50");
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (agentKey: string) => {
    setBusy(agentKey);
    try {
      const result = await post<{ gate_outcome: string; pass_count: number; fail_count: number }>(`/agent-eval/${agentKey}/run`, { triggered_by: "manual" });
      toast.success(`${result.pass_count} passed, ${result.fail_count} failed — gate: ${result.gate_outcome}.`);
      setAgent(agentKey);
      runs.reload();
    } catch (caught) {
      toast.error(detail(caught, "The suite did not run."));
    } finally {
      setBusy(null);
    }
  };

  const seed = async () => {
    setBusy("seed");
    try {
      const result = await post<{ registered: number }>("/agent-eval/suites/seed");
      toast.success(`${result.registered} suites registered.`);
      coverage.reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not register the suites."));
    } finally {
      setBusy(null);
    }
  };

  const notBuilt = coverage.data?.not_built;

  return (
    <div className="flex flex-col gap-4">
      {coverage.data && coverage.data.agents_without_suites.length > 0 && (
        <Alert variant="warning">
          <ShieldAlert />
          <AlertTitle>Agents with no evaluation suite</AlertTitle>
          <AlertDescription>{coverage.data.agents_without_suites.join(", ")} — an agent nobody tests is an agent nobody can vouch for.</AlertDescription>
        </Alert>
      )}
      <DataPanel
        title="Evaluation suites"
        description={Array.isArray(notBuilt) ? notBuilt.join(" ") : notBuilt}
        actions={isAdmin ? <Button size="sm" variant="outline" disabled={busy !== null} onClick={seed}>{busy === "seed" && <Loader2 className="animate-spin" />} Register the standard suites</Button> : undefined}
        isLoading={coverage.isLoading}
        error={coverage.error?.detail ?? null}
        onRetry={coverage.reload}
        isEmpty={(coverage.data?.suites ?? []).length === 0}
        empty={{ icon: FlaskConical, title: "No suites registered" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Cases</TableHead>
              <TableHead className="text-right">Regression cases</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(coverage.data?.suites ?? []).map((row) => (
              <TableRow key={row.agent_key}>
                <TableCell>
                  <div className="font-medium text-foreground">{row.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {row.agent_key} v{row.version}
                    {row.is_scoring_agent && " · produces a score"}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.case_count}</TableCell>
                <TableCell className="text-right tabular-nums">{row.regression_case_count}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => setAgent(row.agent_key)}>
                      History
                    </Button>
                    {isAdmin && (
                      <Button size="sm" disabled={busy !== null} onClick={() => run(row.agent_key)}>
                        {busy === row.agent_key && <Loader2 className="animate-spin" />} Run
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      {agent && (
        <DataPanel title={`Runs for ${agent}`} isLoading={runs.isLoading} error={runs.error?.detail ?? null} onRetry={runs.reload} isEmpty={(runs.data?.runs ?? []).length === 0} empty={{ icon: FlaskConical, title: "Never run" }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead className="text-right">Pass / fail / error</TableHead>
                <TableHead>Gate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(runs.data?.runs ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(row.started_at)} · {row.triggered_by}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.pass_count} / {row.fail_count} / {row.error_count}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.allows_merge ? "success" : "destructive"}>{row.gate_outcome}</Badge>
                    {row.blocking_reasons.length > 0 && <div className="max-w-sm text-xs text-muted-foreground">{row.blocking_reasons.join("; ")}</div>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      )}

      <DataPanel title="Feedback from people" description="A 'not useful' from a real user can become a regression case, so the same mistake is caught next time." isLoading={feedback.isLoading} error={feedback.error?.detail ?? null} onRetry={feedback.reload} isEmpty={(feedback.data?.feedback ?? []).length === 0} empty={{ icon: Bot, title: "No feedback yet" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Verdict</TableHead>
              <TableHead>Comment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(feedback.data?.feedback ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</TableCell>
                <TableCell className="font-mono text-xs">{row.agent_key}</TableCell>
                <TableCell>
                  <Badge variant={row.was_useful ? "success" : "destructive"}>{row.was_useful ? "Useful" : "Not useful"}</Badge>
                  {row.promoted_to_case_id && <div className="text-xs text-muted-foreground">now a test case</div>}
                </TableCell>
                <TableCell className="max-w-md text-sm">{row.comment ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
    </div>
  );
}

function GroundingTab() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("tenant_admin", "hr_admin");
  const sources = useApiQuery<{ retrievable: string[]; never_retrievable: string[]; statement: string }>("/grounding/sources");
  const attempts = useApiQuery<{ attempts: { id: string; source_field: string; source_table: string; severity: string; matched_text: string; intent: string; reviewed_at: string | null; created_at: string }[] }>("/grounding/injection-attempts?limit=100");
  const invocations = useApiQuery<{
    invocations: { id: string; agent_key: string; model: string; outcome: string; citations: string[]; citation_failures: string[]; confidence: number | null; confidence_band: string | null; created_at: string }[];
  }>("/grounding/invocations?limit=50");
  const [busy, setBusy] = useState<string | null>(null);

  const review = async (id: string) => {
    setBusy(id);
    try {
      await post(`/grounding/injection-attempts/${id}/review`);
      attempts.reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not mark it reviewed."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <DataPanel title="What agents may read" description={sources.data?.statement} isLoading={sources.isLoading} error={sources.error?.detail ?? null} onRetry={sources.reload}>
        {sources.data && (
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">May retrieve</h3>
              <div className="flex flex-wrap gap-1.5">
                {sources.data.retrievable.map((key) => (
                  <Badge key={key} variant="outline" className="font-mono text-[11px]">
                    {key}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Never retrievable</h3>
              <div className="flex flex-wrap gap-1.5">
                {sources.data.never_retrievable.map((key) => (
                  <Badge key={key} variant="secondary" className="font-mono text-[11px]">
                    <Lock /> {key}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </DataPanel>

      <DataPanel title="Prompt-injection attempts" description="Text in employee data that tried to instruct an agent. Neutralised, logged, and waiting for a person to look." isLoading={attempts.isLoading} error={attempts.error?.detail ?? null} onRetry={attempts.reload} isEmpty={(attempts.data?.attempts ?? []).length === 0} empty={{ icon: ShieldAlert, title: "None detected" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Where</TableHead>
              <TableHead>What it said</TableHead>
              <TableHead>Reviewed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(attempts.data?.attempts ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</TableCell>
                <TableCell className="font-mono text-xs">
                  {row.source_table}.{row.source_field}
                </TableCell>
                <TableCell className="max-w-md text-xs">
                  <Badge variant={row.severity === "high" ? "destructive" : "outline"} className="mb-1 capitalize">
                    {row.severity} · {row.intent.replaceAll("_", " ")}
                  </Badge>
                  <div className="truncate font-mono">{row.matched_text}</div>
                </TableCell>
                <TableCell>
                  {row.reviewed_at ? (
                    <span className="text-xs text-muted-foreground">{formatDateTime(row.reviewed_at)}</span>
                  ) : isAdmin ? (
                    <Button size="sm" variant="outline" disabled={busy === row.id} onClick={() => review(row.id)}>
                      Mark reviewed
                    </Button>
                  ) : (
                    <Badge variant="warning">Not yet</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      <DataPanel title="Agent calls" description="Every call, including the citations that failed verification — a caught fabrication is shown, not hidden." isLoading={invocations.isLoading} error={invocations.error?.detail ?? null} onRetry={invocations.reload} isEmpty={(invocations.data?.invocations ?? []).length === 0} empty={{ icon: Bot, title: "No agent has been called" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Citations</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(invocations.data?.invocations ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</TableCell>
                <TableCell className="font-mono text-xs">
                  {row.agent_key}
                  <div className="text-muted-foreground">{row.model}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {row.outcome.replaceAll("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {row.confidence !== null ? `${Math.round(row.confidence * 100)}%` : "—"}
                  {row.confidence_band && <div className="text-xs text-muted-foreground">{row.confidence_band}</div>}
                </TableCell>
                <TableCell className="text-xs">
                  {row.citations.length} cited
                  {row.citation_failures.length > 0 && <div className="text-destructive">{row.citation_failures.length} failed verification</div>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
    </div>
  );
}

function TransparencyTab() {
  const { data, error, isLoading, reload } = useApiQuery<Record<string, unknown>>("/autonomy/transparency");
  return (
    <DataPanel title="Transparency" description="What each agent may do, has done, is waiting on, and has had reverted." isLoading={isLoading} error={error?.detail ?? null} onRetry={reload}>
      {data && (
        <div className="p-5">
          <FactTree value={data} />
        </div>
      )}
    </DataPanel>
  );
}
