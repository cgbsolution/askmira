"use client";

import { AlertTriangle, Clock, Download, FileWarning, Globe, Loader2, ScrollText, Settings2, Siren, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, downloadFile, post, put } from "@/lib/api";
import { NOTICE_LANGUAGES, REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL, type ErasurePlan, type RequestStatus, type RequestType } from "@/lib/types/dpdp";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

function detail(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

interface QueueRequest {
  id: string;
  principal: string;
  principal_kind: string;
  type: RequestType;
  status: RequestStatus;
  details: string | null;
  responded_at: string | null;
  rejection_reason: string | null;
  clock: {
    due_by: string;
    sla_days: number;
    statutory_bound_days: number;
    days_remaining: number;
    is_overdue: boolean;
    needs_escalation: boolean;
  };
}

interface BreachSummary {
  id: string;
  reference: string;
  is_rehearsal: boolean;
  severity: string;
  became_aware_at: string;
  affected_principal_count: number;
  board_report_due_at: string;
  reported_to_board_at: string | null;
}

interface BreachState {
  id: string;
  reference: string;
  is_rehearsal: boolean;
  severity: string;
  description: string;
  affected_data_categories: string[];
  affected_principal_count: number;
  clock: {
    became_aware_at: string;
    intimation_target_at: string;
    board_report_due_at: string;
    hours_remaining_for_board: number;
    board_report_overdue: boolean;
    intimation_overdue: boolean;
  };
  obligations: { key: string; description: string; due_at: string | null; is_done: boolean; is_overdue: boolean }[];
  remediation: string | null;
}

const OPEN: RequestStatus[] = ["received", "verifying_identity", "in_progress", "escalated"];

/**
 * Compliance → Data protection.
 *
 * The DPDP Act obligations an administrator has to be able to evidence: the
 * rights-request queue with each statutory clock, the breach register with its
 * 72-hour board deadline, consent across the workforce, the Record of
 * Processing, and where data is transferred.
 */
export function DataProtectionScreen() {
  const config = useApiQuery<{ configured: boolean }>("/dpdp/configuration");

  return (
    <PageShell title="Data protection" description="Rights requests, breaches, consent and the record of processing, under the DPDP Act.">
      {config.data && !config.data.configured && (
        <Alert variant="warning">
          <Settings2 />
          <AlertTitle>Data protection is not configured</AlertTitle>
          <AlertDescription>
            Rights requests, notices and breach notifications need a grievance contact and response periods. Set them
            under Configuration first.
          </AlertDescription>
        </Alert>
      )}
      <Tabs defaultValue="requests">
        <TabsList className="flex-wrap">
          <TabsTrigger value="requests">Rights requests</TabsTrigger>
          <TabsTrigger value="breaches">Breaches</TabsTrigger>
          <TabsTrigger value="consent">Consent</TabsTrigger>
          <TabsTrigger value="ropa">Record of processing</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>
        <TabsContent value="requests" className="mt-4">
          <RequestsTab />
        </TabsContent>
        <TabsContent value="breaches" className="mt-4">
          <BreachesTab />
        </TabsContent>
        <TabsContent value="consent" className="mt-4">
          <ConsentTab />
        </TabsContent>
        <TabsContent value="ropa" className="mt-4">
          <RopaTab />
        </TabsContent>
        <TabsContent value="transfers" className="mt-4">
          <TransfersTab />
        </TabsContent>
        <TabsContent value="config" className="mt-4">
          <ConfigTab onSaved={config.reload} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function RequestsTab() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("tenant_admin", "hr_admin");
  const [openOnly, setOpenOnly] = useState(true);
  const { data, error, isLoading, reload } = useApiQuery<{ requests: QueueRequest[]; escalations: { request_id?: string; message?: string }[] }>(
    `/dpdp/requests?open_only=${openOnly}`,
  );
  const [resolving, setResolving] = useState<QueueRequest | null>(null);
  const [erasing, setErasing] = useState<QueueRequest | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const exportFor = async (row: QueueRequest) => {
    setDownloading(row.id);
    try {
      await downloadFile(`/dpdp/requests/${row.id}/export/download`, `access-${row.principal}.json`);
    } catch (caught) {
      toast.error(detail(caught, "The export failed."));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {(data?.escalations ?? []).length > 0 && (
        <Alert variant="destructive">
          <Clock />
          <AlertTitle>{data!.escalations.length} request(s) need escalation</AlertTitle>
          <AlertDescription>They are close to or past the response period the law allows.</AlertDescription>
        </Alert>
      )}
      <DataPanel
        title="Rights requests"
        actions={
          <div className="flex items-center gap-2">
            <Switch id="dpr-open" checked={openOnly} onCheckedChange={setOpenOnly} />
            <Label htmlFor="dpr-open" className="text-sm font-normal">
              Open only
            </Label>
          </div>
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data?.requests ?? []).length === 0}
        empty={{ icon: ScrollText, title: openOnly ? "No open requests" : "No requests yet" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Who</TableHead>
              <TableHead>Request</TableHead>
              <TableHead>Clock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.requests ?? []).map((row) => {
              const open = OPEN.includes(row.status);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{row.principal}</div>
                    <div className="text-xs text-muted-foreground capitalize">{row.principal_kind.replaceAll("_", " ")}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {REQUEST_TYPE_LABEL[row.type]}
                    {row.details && <div className="max-w-xs text-xs text-muted-foreground">{row.details}</div>}
                  </TableCell>
                  <TableCell className={cn("text-sm", open && row.clock.is_overdue && "font-medium text-destructive")}>
                    Due {formatDate(row.clock.due_by)}
                    {open && (
                      <div className="text-xs">
                        {row.clock.is_overdue ? "Overdue" : `${row.clock.days_remaining} days left`} · law allows {row.clock.statutory_bound_days}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.status === "completed" ? "success" : row.status === "escalated" ? "destructive" : "outline"}>
                      {REQUEST_STATUS_LABEL[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {row.type === "access" && isAdmin && (
                        <Button size="sm" variant="outline" disabled={downloading === row.id} onClick={() => exportFor(row)}>
                          {downloading === row.id ? <Loader2 className="animate-spin" /> : <Download />} Export
                        </Button>
                      )}
                      {row.type === "erasure" && open && (
                        <Button size="sm" variant="outline" onClick={() => setErasing(row)}>
                          <Trash2 /> Erasure
                        </Button>
                      )}
                      {open && (
                        <Button size="sm" onClick={() => setResolving(row)}>
                          Update
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataPanel>
      <ResolveDialog request={resolving} onOpenChange={(open) => !open && setResolving(null)} onDone={reload} />
      <ErasureSheet request={erasing} canExecute={isAdmin} onOpenChange={(open) => !open && setErasing(null)} onDone={reload} />
    </div>
  );
}

function ResolveDialog({ request, onOpenChange, onDone }: { request: QueueRequest | null; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const [status, setStatus] = useState<RequestStatus>("in_progress");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!request) return;
    setStatus(request.status === "received" ? "verifying_identity" : "in_progress");
    setNote("");
    setReason("");
  }, [request]);

  const submit = async () => {
    if (!request) return;
    setIsBusy(true);
    try {
      await post(`/dpdp/requests/${request.id}/resolve`, {
        status,
        note: note.trim() || null,
        rejection_reason: status === "rejected" ? reason.trim() : null,
      });
      toast.success("Request updated.");
      onDone();
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "Could not update the request."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={request !== null} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update {request?.principal}&apos;s request</DialogTitle>
          <DialogDescription>{request ? REQUEST_TYPE_LABEL[request.type] : ""}. Every change is audited.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="dpr-status" label="Status">
            <Select value={status} onValueChange={(next) => setStatus(next as RequestStatus)}>
              <SelectTrigger id="dpr-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REQUEST_STATUS_LABEL) as RequestStatus[]).filter((key) => key !== "received").map((key) => (
                  <SelectItem key={key} value={key}>
                    {REQUEST_STATUS_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {status === "rejected" && (
            <FormField htmlFor="dpr-reason" label="Why it is declined" hint="The person sees this, and can take it to the Board.">
              <Textarea id="dpr-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </FormField>
          )}
          <FormField htmlFor="dpr-note" label="Internal note" optional>
            <Textarea id="dpr-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || (status === "rejected" && !reason.trim())}>
            {isBusy && <Loader2 className="animate-spin" />} Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ErasureSheet({
  request,
  canExecute,
  onOpenChange,
  onDone,
}: {
  request: QueueRequest | null;
  canExecute: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { data, error, isLoading, reload } = useApiQuery<ErasurePlan>(request ? `/dpdp/requests/${request.id}/erasure-preview` : null);
  const [confirming, setConfirming] = useState(false);

  const execute = async () => {
    if (!request) return;
    try {
      const result = await post<{ rows_deleted: number }>(`/dpdp/requests/${request.id}/execute-erasure`);
      toast.success(`Erasure carried out: ${result.rows_deleted} records deleted, statutory records retained.`);
      onDone();
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "The erasure did not run."));
      throw caught;
    }
  };

  return (
    <Sheet open={request !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Erasure for {request?.principal}</SheetTitle>
          <SheetDescription>What would be erased, what is kept, and the law that keeps it.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : error ? (
            <ErrorState message={error.detail} onRetry={reload} />
          ) : data ? (
            <>
              <Alert>
                <AlertTitle>
                  {data.purged_count} to erase, {data.retained_count} to keep
                </AlertTitle>
                <AlertDescription>{data.summary}</AlertDescription>
              </Alert>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Why</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.decisions.map((row) => (
                    <TableRow key={row.category}>
                      <TableCell className="text-sm">{row.category_name}</TableCell>
                      <TableCell>
                        <Badge variant={row.outcome === "purged" ? "destructive" : row.outcome === "pseudonymised" ? "warning" : "secondary"}>
                          {row.outcome.replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.explanation}
                        {row.statutory_reference && <div>{row.statutory_reference}</div>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {canExecute ? (
                <Button variant="destructive" className="w-fit" onClick={() => setConfirming(true)}>
                  <Trash2 /> Carry out erasure
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">Carrying out an erasure needs a tenant or HR admin.</p>
              )}
            </>
          ) : null}
        </div>
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title="Carry out this erasure?"
          description="Rows marked 'purged' are deleted and cannot be recovered. Records the law requires are kept exactly as the plan shows."
          confirmLabel="Erase"
          destructive
          onConfirm={execute}
        />
      </SheetContent>
    </Sheet>
  );
}

function BreachesTab() {
  const { data, error, isLoading, reload } = useApiQuery<BreachSummary[]>("/dpdp/breaches");
  const [raising, setRaising] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  return (
    <>
      <DataPanel
        title="Breach register"
        description="The Board must receive a detailed report within 72 hours of becoming aware."
        actions={
          <Button size="sm" variant="destructive" onClick={() => setRaising(true)}>
            <Siren /> Report a breach
          </Button>
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data ?? []).length === 0}
        empty={{ icon: FileWarning, title: "No breaches recorded", description: "Rehearsals are recorded here too, marked as such." }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Incident</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead className="text-right">People</TableHead>
              <TableHead>Board report</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((row) => {
              const overdue = !row.reported_to_board_at && new Date(row.board_report_due_at) < new Date();
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-mono text-sm text-foreground">{row.reference}</div>
                    <div className="text-xs text-muted-foreground">aware {formatDateTime(row.became_aware_at)}</div>
                    {row.is_rehearsal && <Badge variant="outline" className="mt-1">Rehearsal</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.severity === "severe" || row.severity === "high" ? "destructive" : "outline"} className="capitalize">
                      {row.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.affected_principal_count.toLocaleString("en-IN")}</TableCell>
                  <TableCell className={cn("text-sm", overdue && "font-medium text-destructive")}>
                    {row.reported_to_board_at ? `Sent ${formatDateTime(row.reported_to_board_at)}` : `Due ${formatDateTime(row.board_report_due_at)}`}
                    {overdue && <div className="text-xs">Overdue</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setViewing(row.id)}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataPanel>
      <RaiseBreachDialog open={raising} onOpenChange={setRaising} onRaised={(id) => { reload(); setViewing(id); }} />
      <BreachSheet incidentId={viewing} onOpenChange={(open) => !open && setViewing(null)} />
    </>
  );
}

function RaiseBreachDialog({ open, onOpenChange, onRaised }: { open: boolean; onOpenChange: (open: boolean) => void; onRaised: (id: string) => void }) {
  const categories = useApiQuery<{ categories: { key: string; name: string }[] }>(open ? "/dpdp/categories" : null);
  const [reference, setReference] = useState("");
  const [awareAt, setAwareAt] = useState("");
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [count, setCount] = useState("");
  const [leftControl, setLeftControl] = useState(false);
  const [rehearsal, setRehearsal] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReference("");
    setAwareAt("");
    setDescription("");
    setPicked([]);
    setCount("");
    setLeftControl(false);
    setRehearsal(false);
  }, [open]);

  const submit = async () => {
    setIsBusy(true);
    try {
      const result = await post<{ id: string; severity: string; board_report_due_at: string }>("/dpdp/breaches", {
        reference: reference.trim(),
        became_aware_at: new Date(awareAt).toISOString(),
        description: description.trim(),
        affected_data_categories: picked,
        affected_principal_count: Number(count),
        data_left_our_control: leftControl,
        is_rehearsal: rehearsal,
      });
      toast.success(`Graded ${result.severity}. The Board report is due ${formatDateTime(result.board_report_due_at)}.`);
      onRaised(result.id);
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "The incident was not recorded."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Report a personal data breach</DialogTitle>
          <DialogDescription>
            The 72-hour clock runs from when you became aware, not from now. Severity is graded from what you enter; a
            category that is not classified is refused rather than guessed low.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="breach-ref" label="Reference">
            <Input id="breach-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="INC-2026-001" className="font-mono" />
          </FormField>
          <FormField htmlFor="breach-aware" label="Became aware at">
            <Input id="breach-aware" type="datetime-local" value={awareAt} onChange={(e) => setAwareAt(e.target.value)} />
          </FormField>
          <FormField htmlFor="breach-description" label="What happened" className="sm:col-span-2">
            <Textarea id="breach-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </FormField>
          <FormField htmlFor="breach-count" label="People affected">
            <Input id="breach-count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} />
          </FormField>
          <div className="grid content-end gap-3">
            <div className="flex items-center gap-3">
              <Switch id="breach-left" checked={leftControl} onCheckedChange={setLeftControl} />
              <Label htmlFor="breach-left" className="text-sm font-normal">
                The data reached someone outside our control
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="breach-rehearsal" checked={rehearsal} onCheckedChange={setRehearsal} />
              <Label htmlFor="breach-rehearsal" className="text-sm font-normal">
                This is a rehearsal
              </Label>
            </div>
          </div>
          <fieldset className="grid gap-1.5 sm:col-span-2">
            <legend className="mb-1 text-sm font-medium">Data affected</legend>
            <div className="grid max-h-44 gap-1.5 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
              {(categories.data?.categories ?? []).map((row) => (
                <div key={row.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`breach-cat-${row.key}`}
                    checked={picked.includes(row.key)}
                    onCheckedChange={() => setPicked(picked.includes(row.key) ? picked.filter((key) => key !== row.key) : [...picked, row.key])}
                  />
                  <Label htmlFor={`breach-cat-${row.key}`} className="text-sm font-normal">
                    {row.name}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={isBusy || !reference.trim() || !awareAt || !description.trim() || count === "" || picked.length === 0}>
            {isBusy && <Loader2 className="animate-spin" />} Record incident
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BreachSheet({ incidentId, onOpenChange }: { incidentId: string | null; onOpenChange: (open: boolean) => void }) {
  const state = useApiQuery<BreachState>(incidentId ? `/dpdp/breaches/${incidentId}` : null);
  const [showDraft, setShowDraft] = useState(false);
  const draft = useApiQuery<{ subject: string; body: string; categories_named: string[]; actions_advised: string[] }>(
    incidentId && showDraft ? `/dpdp/breaches/${incidentId}/notification` : null,
  );

  useEffect(() => setShowDraft(false), [incidentId]);

  const data = state.data;

  return (
    <Sheet open={incidentId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="font-mono">{data?.reference}</SheetTitle>
          <SheetDescription>{data?.is_rehearsal ? "Rehearsal — no real notification is owed." : "A live incident."}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6 text-sm">
          {state.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : state.error ? (
            <ErrorState message={state.error.detail} onRetry={state.reload} />
          ) : data ? (
            <>
              <p className="whitespace-pre-line">{data.description}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs text-muted-foreground">Board report due</div>
                  <div className={cn("font-medium", data.clock.board_report_overdue && "text-destructive")}>
                    {formatDateTime(data.clock.board_report_due_at)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data.clock.board_report_overdue ? "Overdue" : `${Math.max(0, Math.round(data.clock.hours_remaining_for_board))} hours left`}
                  </div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs text-muted-foreground">Tell affected people by</div>
                  <div className={cn("font-medium", data.clock.intimation_overdue && "text-destructive")}>
                    {formatDateTime(data.clock.intimation_target_at)}
                  </div>
                </div>
              </div>
              <section className="grid gap-2">
                <h3 className="font-semibold text-foreground">What is still owed</h3>
                <ul className="grid gap-1.5">
                  {data.obligations.map((row) => (
                    <li key={row.key} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2">
                      <span className={row.is_done ? "text-muted-foreground line-through" : undefined}>{row.description}</span>
                      {row.is_done ? (
                        <Badge variant="success">Done</Badge>
                      ) : row.is_overdue ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : row.due_at ? (
                        <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(row.due_at)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
              {!showDraft ? (
                <Button variant="outline" className="w-fit" onClick={() => setShowDraft(true)}>
                  Draft the notice to affected people
                </Button>
              ) : draft.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : draft.error ? (
                <Alert variant="warning">
                  <AlertTriangle />
                  <AlertTitle>No draft yet</AlertTitle>
                  <AlertDescription>{draft.error.detail}</AlertDescription>
                </Alert>
              ) : draft.data ? (
                <div className="grid gap-2 rounded-md border border-border p-3">
                  <div className="font-medium text-foreground">{draft.data.subject}</div>
                  <p className="whitespace-pre-line">{draft.data.body}</p>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground">
                    {draft.data.actions_advised.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">A draft. Nothing has been sent.</p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ConsentTab() {
  const { data, error, isLoading, reload } = useApiQuery<{
    headcount: number;
    purposes: { purpose: string; name: string; granted: number; declined: number; never_asked: number; active_employees: number }[];
  }>("/dpdp/consent/summary");

  return (
    <DataPanel
      title="Consent across the workforce"
      description="Counts only. Never asked is kept apart from declined — a blank is not a no."
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={(data?.purposes ?? []).length === 0}
      empty={{ icon: Users, title: "No consent-based purposes" }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Purpose</TableHead>
            <TableHead className="text-right">Agreed</TableHead>
            <TableHead className="text-right">Declined</TableHead>
            <TableHead className="text-right">Never asked</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data?.purposes ?? []).map((row) => (
            <TableRow key={row.purpose}>
              <TableCell className="text-sm font-medium text-foreground">{row.name}</TableCell>
              <TableCell className="text-right tabular-nums">{row.granted}</TableCell>
              <TableCell className="text-right tabular-nums">{row.declined}</TableCell>
              <TableCell className="text-right tabular-nums">{row.never_asked}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataPanel>
  );
}

function RopaTab() {
  const { data, error, isLoading, reload } = useApiQuery<{
    activities: {
      purpose: string;
      purpose_name: string;
      description: string;
      lawful_basis_label: string;
      can_be_withdrawn: boolean;
      data_category_names: string[];
      data_principals: string[];
      source_tables: string[];
      max_retention_months: number | null;
    }[];
    classification_gaps: string[];
  }>("/dpdp/processing-record");

  return (
    <div className="flex flex-col gap-4">
      {(data?.classification_gaps ?? []).length > 0 && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>Personal data with no classification</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {data!.classification_gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <DataPanel
        title="Record of Processing Activities"
        description="Generated from the data classification, so it cannot drift from what the system actually holds."
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Purpose</TableHead>
              <TableHead>Lawful basis</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Kept for</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.activities ?? []).map((row) => (
              <TableRow key={row.purpose}>
                <TableCell>
                  <div className="font-medium text-foreground">{row.purpose_name}</div>
                  <div className="max-w-sm text-xs text-muted-foreground">{row.description}</div>
                </TableCell>
                <TableCell className="text-sm">
                  {row.lawful_basis_label}
                  {row.can_be_withdrawn && <div className="text-xs text-muted-foreground">withdrawable</div>}
                </TableCell>
                <TableCell className="max-w-xs text-xs">{row.data_category_names.join(", ")}</TableCell>
                <TableCell className="text-sm">{row.max_retention_months ? `${row.max_retention_months} months` : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
    </div>
  );
}

function TransfersTab() {
  const processors = useApiQuery<{
    ai_model_providers: { key: string; name: string; service: string; location: string; is_cross_border: boolean; category_names: string[] }[];
    other_sub_processors: { key: string; name: string; service: string; location: string; is_cross_border: boolean; category_names: string[] }[];
    cross_border_count: number;
    in_india_count: number;
    statement: string;
  }>("/dpdp/sub-processors");
  const history = useApiQuery<{
    cross_border_transfers_recorded: number;
    recent: { sub_processor: string; purpose: string; categories: string[]; principal_count: number; occurred_at: string; was_cross_border: boolean; description: string }[];
  }>("/dpdp/transfers");

  const all = [...(processors.data?.ai_model_providers ?? []).map((row) => ({ ...row, ai: true })), ...(processors.data?.other_sub_processors ?? []).map((row) => ({ ...row, ai: false }))];

  return (
    <div className="flex flex-col gap-4">
      <DataPanel title="Where data goes" description={processors.data?.statement} isLoading={processors.isLoading} error={processors.error?.detail ?? null} onRetry={processors.reload}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sub-processor</TableHead>
              <TableHead>Where</TableHead>
              <TableHead>May receive</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {all.map((row) => (
              <TableRow key={row.key}>
                <TableCell>
                  <div className="font-medium text-foreground">{row.name}</div>
                  <div className="text-xs text-muted-foreground">{row.service}</div>
                  {row.ai && <Badge variant="outline" className="mt-1">AI model provider</Badge>}
                </TableCell>
                <TableCell className="text-sm">
                  {row.location}
                  {row.is_cross_border && (
                    <Badge variant="warning" className="ml-2">
                      <Globe /> Cross-border
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-sm text-xs">{row.category_names.join(", ")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
      <DataPanel
        title="Transfers that happened"
        description={history.data ? `${history.data.cross_border_transfers_recorded} cross-border transfers recorded.` : undefined}
        isLoading={history.isLoading}
        error={history.error?.detail ?? null}
        onRetry={history.reload}
        isEmpty={(history.data?.recent ?? []).length === 0}
        empty={{ icon: Globe, title: "No transfers recorded" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>To</TableHead>
              <TableHead>What</TableHead>
              <TableHead className="text-right">People</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(history.data?.recent ?? []).map((row, index) => (
              <TableRow key={index}>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.occurred_at)}</TableCell>
                <TableCell className="text-sm">
                  {row.sub_processor}
                  {row.was_cross_border && <Badge variant="warning" className="ml-2">Cross-border</Badge>}
                </TableCell>
                <TableCell className="max-w-sm text-xs">
                  {row.purpose} · {row.categories.join(", ")}
                  <div className="text-muted-foreground">{row.description}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.principal_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
    </div>
  );
}

const SLA_TYPES: RequestType[] = ["access", "correction", "erasure", "grievance", "nomination"];

function ConfigTab({ onSaved }: { onSaved: () => void }) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("tenant_admin", "hr_admin");
  const { data, isLoading, reload } = useApiQuery<{
    configured: boolean;
    grievance_contact?: string;
    data_protection_officer_name?: string | null;
    sla_days?: Record<string, number>;
    default_notice_language?: string;
    ai_processing_enabled?: boolean;
  }>(isAdmin ? "/dpdp/configuration" : null);
  const [contact, setContact] = useState("");
  const [dpo, setDpo] = useState("");
  const [language, setLanguage] = useState("en");
  const [ai, setAi] = useState(false);
  const [sla, setSla] = useState<Record<string, string>>({});
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setContact(data.grievance_contact ?? "");
    setDpo(data.data_protection_officer_name ?? "");
    setLanguage(data.default_notice_language ?? "en");
    setAi(data.ai_processing_enabled ?? false);
    setSla(Object.fromEntries(Object.entries(data.sla_days ?? {}).map(([key, value]) => [key, String(value)])));
  }, [data]);

  if (!isAdmin) {
    return <Alert><AlertDescription>Configuration is managed by tenant and HR admins.</AlertDescription></Alert>;
  }

  const save = async () => {
    setIsBusy(true);
    try {
      await put("/dpdp/configuration", {
        grievance_contact: contact.trim(),
        data_protection_officer_name: dpo.trim() || null,
        default_notice_language: language,
        ai_processing_enabled: ai,
        sla_days: Object.fromEntries(Object.entries(sla).filter(([, value]) => value !== "").map(([key, value]) => [key, Number(value)])),
      });
      toast.success("Data protection configuration saved.");
      reload();
      onSaved();
    } catch (caught) {
      toast.error(detail(caught, "Could not save. A response period longer than the law allows is refused."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <DataPanel title="Configuration" isLoading={isLoading}>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <FormField htmlFor="dpdp-contact" label="Grievance contact" hint="Shown on every notice and every breach notification.">
          <Input id="dpdp-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="dpo@company.com" />
        </FormField>
        <FormField htmlFor="dpdp-dpo" label="Data protection officer" optional>
          <Input id="dpdp-dpo" value={dpo} onChange={(e) => setDpo(e.target.value)} />
        </FormField>
        <FormField htmlFor="dpdp-language" label="Default notice language">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id="dpdp-language" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTICE_LANGUAGES.map((row) => (
                <SelectItem key={row.code} value={row.code}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <div className="flex items-center gap-3 self-end pb-2">
          <Switch id="dpdp-ai" checked={ai} onCheckedChange={setAi} />
          <Label htmlFor="dpdp-ai" className="text-sm font-normal">
            AI processing of employee data is enabled
          </Label>
        </div>
        <fieldset className="grid gap-2 sm:col-span-2">
          <legend className="text-sm font-medium">Response periods (days)</legend>
          <p className="text-xs text-muted-foreground">Blank uses the default. A period longer than the statutory bound is refused.</p>
          <div className="grid gap-3 sm:grid-cols-5">
            {SLA_TYPES.map((type) => (
              <FormField key={type} htmlFor={`sla-${type}`} label={type}>
                <Input id={`sla-${type}`} inputMode="numeric" value={sla[type] ?? ""} onChange={(e) => setSla({ ...sla, [type]: e.target.value.replace(/\D/g, "") })} />
              </FormField>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <Button onClick={save} disabled={isBusy || !contact.trim()}>
            {isBusy && <Loader2 className="animate-spin" />} Save configuration
          </Button>
        </div>
      </div>
    </DataPanel>
  );
}
