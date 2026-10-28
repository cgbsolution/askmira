"use client";

import { Download, HeartPulse, Loader2, Plus, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { RequireRole } from "@/components/common/RequireRole";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, downloadFile, post } from "@/lib/api";
import { formatDay } from "@/lib/utils";

import { type Member, type Plan, RELATION_LABEL, type Relation } from "./MyBenefitsScreen";
import { DatePicker } from "@/components/common/DatePicker";
import { FieldLegend, FieldSet } from "@/components/ui/field";

interface PendingEvent {
  id: string;
  plan_name: string | null;
  employee_name: string;
  employee_code: string;
  kind: string;
  event_date: string;
  add_members: Member[];
  remove_members: string[];
  note: string | null;
}

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export function BenefitsAdminScreen() {
  const plans = useApiQuery<Plan[]>("/benefits/plans");
  const events = useApiQuery<PendingEvent[]>("/benefits/life-events");
  const [creating, setCreating] = useState(false);
  const [since, setSince] = useState(startOfYear);
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (event: PendingEvent, approve: boolean) => {
    setBusy(event.id);
    try {
      await post(`/benefits/life-events/${event.id}/decide`, { approve, note: null });
      toast.success(approve ? "Approved; cover updated." : "Rejected.");
      events.reload();
    } catch (caught) {
      toast.error(failure(caught, "The decision could not be saved."));
    } finally {
      setBusy(null);
    }
  };

  const download = async (path: string, name: string) => {
    try {
      await downloadFile(path, name);
    } catch (caught) {
      toast.error(failure(caught, "The file could not be downloaded."));
    }
  };

  return (
    <PageShell title="Benefits admin" description="Group plans, who is covered, changes to approve, and files for the insurer.">
      <div className="grid gap-6">
        <DataPanel
          tier="tier1"
          title="Plans"
          actions={
            <RequireRole roles={["admin"]}>
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus /> New plan
              </Button>
            </RequireRole>
          }
          toolbar={
            <FormField htmlFor="endorse-since" label="Endorsements since" className="max-w-44">
              <DatePicker id="endorse-since" value={since} onChange={setSince} />
            </FormField>
          }
          isLoading={plans.isLoading && !plans.data}
          error={plans.error?.detail ?? null}
          onRetry={plans.reload}
          isEmpty={(plans.data ?? []).length === 0}
          empty={{ icon: ShieldCheck, title: "No plans yet", description: "Add the group policies the company buys." }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Policy</TableHead>
                <TableHead className="text-right">Cover</TableHead>
                <TableHead className="text-right">Enrolled</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(plans.data ?? []).map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <p className="font-medium">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {plan.insurer}
                      {plan.tpa ? ` · ${plan.tpa}` : ""} · covers {plan.covers.map((c) => RELATION_LABEL[c]).join(", ") || "employee only"}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {plan.policy_number ?? "—"}
                    <p className="text-xs text-muted-foreground">
                      {formatDay(plan.policy_start, true)} to {formatDay(plan.policy_end, true)}
                    </p>
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={plan.sum_insured} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{plan.enrolled ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => void download(`/benefits/plans/${plan.id}/census`, "census.csv")}>
                        <Download /> Census
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void download(`/benefits/plans/${plan.id}/endorsements?since=${since}`, "endorsements.csv")}
                      >
                        <Download /> Endorsements
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>

        <DataPanel
          tier="tier1"
          title="Changes to approve"
          description="Life events outside the enrolment window. Approving updates cover and the endorsement file."
          isLoading={events.isLoading && !events.data}
          error={events.error?.detail ?? null}
          onRetry={events.reload}
          isEmpty={(events.data ?? []).length === 0}
          empty={{ icon: HeartPulse, title: "Nothing waiting" }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Change</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(events.data ?? []).map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <p className="font-medium">{event.employee_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.employee_code} · {event.plan_name}
                    </p>
                  </TableCell>
                  <TableCell className="capitalize">
                    {event.kind} · {formatDay(event.event_date, true)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {event.add_members
                      .map((m) => `+ ${m.name} (${RELATION_LABEL[m.relationship]})`)
                      .concat(event.remove_members.map((n) => `− ${n}`))
                      .join(", ")}
                    {event.note && <p className="text-xs text-muted-foreground">{event.note}</p>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" disabled={busy === event.id} onClick={() => void decide(event, true)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy === event.id} onClick={() => void decide(event, false)}>
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      </div>
      {creating && (
        <NewPlanDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            plans.reload();
          }}
        />
      )}
    </PageShell>
  );
}

const KINDS = [
  { value: "health", label: "Group health" },
  { value: "life", label: "Group life" },
  { value: "accident", label: "Personal accident" },
  { value: "other", label: "Other" },
];
const COVERABLE: Relation[] = ["spouse", "child", "parent", "parent_in_law"];

function NewPlanDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("health");
  const [insurer, setInsurer] = useState("");
  const [tpa, setTpa] = useState("");
  const [policy, setPolicy] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [sum, setSum] = useState("");
  const [premium, setPremium] = useState("");
  const [covers, setCovers] = useState<Set<Relation>>(new Set(["spouse", "child"]));
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");
  const [topUpName, setTopUpName] = useState("");
  const [topUpSum, setTopUpSum] = useState("");
  const [topUpPremium, setTopUpPremium] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await post("/benefits/plans", {
        name: name.trim(),
        kind,
        insurer: insurer.trim(),
        tpa: tpa.trim() || null,
        policy_number: policy.trim() || null,
        policy_start: start,
        policy_end: end,
        sum_insured: sum,
        covers: [...covers],
        employer_premium_per_member: premium || "0",
        enrolment_opens: opens || null,
        enrolment_closes: closes || null,
        top_ups:
          topUpName.trim() && topUpPremium
            ? [{ code: "TOPUP1", name: topUpName.trim(), sum_insured: topUpSum || "0", employee_premium_annual: topUpPremium }]
            : [],
      });
      toast.success("Plan added.");
      onCreated();
    } catch (caught) {
      toast.error(failure(caught, "The plan could not be added."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New benefit plan</DialogTitle>
          <DialogDescription>The group policy as the insurer issued it. Amounts are yearly, in rupees.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="plan-name" label="Name">
              <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField htmlFor="plan-kind" label="Kind">
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="plan-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="plan-insurer" label="Insurer">
              <Input id="plan-insurer" value={insurer} onChange={(e) => setInsurer(e.target.value)} />
            </FormField>
            <FormField htmlFor="plan-tpa" label="TPA" optional>
              <Input id="plan-tpa" value={tpa} onChange={(e) => setTpa(e.target.value)} />
            </FormField>
            <FormField htmlFor="plan-policy" label="Policy number" optional>
              <Input id="plan-policy" value={policy} onChange={(e) => setPolicy(e.target.value)} />
            </FormField>
            <FormField htmlFor="plan-sum" label="Sum insured">
              <Input id="plan-sum" inputMode="decimal" value={sum} onChange={(e) => setSum(e.target.value)} />
            </FormField>
            <FormField htmlFor="plan-start" label="Policy starts">
              <DatePicker id="plan-start" value={start} onChange={setStart} />
            </FormField>
            <FormField htmlFor="plan-end" label="Policy ends">
              <DatePicker id="plan-end" value={end} onChange={setEnd} />
            </FormField>
            <FormField htmlFor="plan-opens" label="Enrolment opens" optional>
              <DatePicker id="plan-opens" value={opens} onChange={setOpens} />
            </FormField>
            <FormField htmlFor="plan-closes" label="Enrolment closes" optional>
              <DatePicker id="plan-closes" value={closes} onChange={setCloses} />
            </FormField>
            <FormField htmlFor="plan-premium" label="Company premium per covered person" optional>
              <Input id="plan-premium" inputMode="decimal" value={premium} onChange={(e) => setPremium(e.target.value)} />
            </FormField>
          </div>
          <FieldSet className="grid gap-1.5">
            <FieldLegend className="mb-1 text-sm font-medium">Covers, besides the employee</FieldLegend>
            <div className="flex flex-wrap gap-4">
              {COVERABLE.map((relation) => (
                <div key={relation} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`plan-cover-${relation}`}
                    checked={covers.has(relation)}
                    onCheckedChange={(on) =>
                      setCovers((current) => {
                        const next = new Set(current);
                        if (on) next.add(relation);
                        else next.delete(relation);
                        return next;
                      })
                    }
                  />
                  <Label htmlFor={`plan-cover-${relation}`} className="font-normal">
                    {RELATION_LABEL[relation]}
                  </Label>
                </div>
              ))}
            </div>
          </FieldSet>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField htmlFor="plan-topup-name" label="Top-up offered" optional>
              <Input id="plan-topup-name" placeholder="+5 lakh" value={topUpName} onChange={(e) => setTopUpName(e.target.value)} />
            </FormField>
            <FormField htmlFor="plan-topup-sum" label="Top-up cover" optional>
              <Input id="plan-topup-sum" inputMode="decimal" value={topUpSum} onChange={(e) => setTopUpSum(e.target.value)} />
            </FormField>
            <FormField htmlFor="plan-topup-premium" label="Employee pays a year" optional>
              <Input id="plan-topup-premium" inputMode="decimal" value={topUpPremium} onChange={(e) => setTopUpPremium(e.target.value)} />
            </FormField>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || name.trim().length < 2 || insurer.trim().length < 2 || !start || !end || !sum} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Add plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

