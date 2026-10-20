"use client";

import { HeartPulse, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { NoEmployeeRecord, useHasEmployeeRecord } from "@/components/common/NoEmployeeRecord";
import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import { formatDay } from "@/lib/utils";

export type Relation = "spouse" | "child" | "parent" | "parent_in_law";

export const RELATION_LABEL: Record<string, string> = {
  self: "Self",
  spouse: "Spouse",
  child: "Child",
  parent: "Parent",
  parent_in_law: "Parent-in-law",
};

export interface Member {
  name: string;
  relationship: Relation;
  date_of_birth: string | null;
  gender: string | null;
}

export interface Plan {
  id: string;
  name: string;
  kind: string;
  insurer: string;
  tpa: string | null;
  policy_number: string | null;
  policy_start: string;
  policy_end: string;
  sum_insured: string;
  covers: Relation[];
  max_children: number | null;
  employer_premium_per_member: string;
  top_ups: { code: string; name: string; sum_insured: string; employee_premium_annual: string }[];
  enrolment_opens: string | null;
  enrolment_closes: string | null;
  life_event_window_days: number;
  active: boolean;
  enrolled?: number | null;
}

interface Enrolment {
  id: string;
  status: "enrolled" | "waived";
  members: Member[];
  top_up_code: string | null;
  employee_premium_annual: string;
  effective_from: string;
}

interface MyPlan {
  plan: Plan;
  enrolment: Enrolment | null;
  window_open: boolean;
}

interface LifeEvent {
  id: string;
  plan_name: string | null;
  kind: string;
  event_date: string;
  add_members: Member[];
  remove_members: string[];
  status: "pending" | "approved" | "rejected";
  decision_note: string | null;
}

const NO_TOP_UP = "__none";

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

export function MyBenefitsScreen() {
  const hasRecord = useHasEmployeeRecord();
  const { data, error, isLoading, reload } = useApiQuery<MyPlan[]>(hasRecord ? "/benefits/me" : null);
  const events = useApiQuery<LifeEvent[]>(hasRecord ? "/benefits/life-events" : null);
  const [enrolling, setEnrolling] = useState<MyPlan | null>(null);
  const [changing, setChanging] = useState<MyPlan | null>(null);
  const plans = data ?? [];

  if (!hasRecord) {
    return (
      <PageShell title="Benefits" description="Your group insurance, who it covers, and changes after a life event.">
        <NoEmployeeRecord what="Benefit plans" />
      </PageShell>
    );
  }

  return (
    <PageShell title="Benefits" description="Your group insurance, who it covers, and changes after a life event.">
      <div className="grid gap-6">
        <DataPanel
          tier="tier1"
          title="Your plans"
          isLoading={isLoading && !data}
          error={error?.detail ?? null}
          onRetry={reload}
          isEmpty={plans.length === 0}
          empty={{ icon: ShieldCheck, title: "No group plans yet", description: "Plans appear here once HR sets them up." }}
        >
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {plans.map((item) => (
              <PlanCard
                key={item.plan.id}
                item={item}
                onEnrol={() => setEnrolling(item)}
                onLifeEvent={() => setChanging(item)}
              />
            ))}
          </div>
        </DataPanel>
        <DataPanel
          tier="tier2"
          title="Life-event changes"
          isLoading={events.isLoading && !events.data}
          error={events.error?.detail ?? null}
          onRetry={events.reload}
          isEmpty={(events.data ?? []).length === 0}
          empty={{ icon: HeartPulse, title: "No changes asked for" }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(events.data ?? []).map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{event.plan_name}</TableCell>
                  <TableCell className="capitalize">
                    {event.kind} · {formatDay(event.event_date, true)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {event.add_members.map((m) => `+ ${m.name}`).concat(event.remove_members.map((n) => `− ${n}`)).join(", ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={event.status === "approved" ? "success" : event.status === "rejected" ? "muted" : "warning"}>
                      {event.status}
                    </Badge>
                    {event.decision_note && <p className="text-xs text-muted-foreground">{event.decision_note}</p>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      </div>
      {enrolling && (
        <EnrolDialog
          item={enrolling}
          onClose={() => setEnrolling(null)}
          onDone={() => {
            setEnrolling(null);
            reload();
          }}
        />
      )}
      {changing && (
        <LifeEventDialog
          item={changing}
          onClose={() => setChanging(null)}
          onDone={() => {
            setChanging(null);
            events.reload();
          }}
        />
      )}
    </PageShell>
  );
}

function PlanCard({ item, onEnrol, onLifeEvent }: { item: MyPlan; onEnrol: () => void; onLifeEvent: () => void }) {
  const { plan, enrolment } = item;
  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle className="text-base">{plan.name}</CardTitle>
        <CardDescription>
          {plan.insurer}
          {plan.tpa ? ` · TPA ${plan.tpa}` : ""} · cover <Money value={plan.sum_insured} /> · {formatDay(plan.policy_start, true)} to{" "}
          {formatDay(plan.policy_end, true)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {enrolment ? (
          enrolment.status === "enrolled" ? (
            <>
              <p>
                <Badge variant="success">Enrolled</Badge> from {formatDay(enrolment.effective_from, true)}
              </p>
              <p className="text-muted-foreground">
                Covers you
                {enrolment.members.length > 0 &&
                  ` and ${enrolment.members.map((m) => `${m.name} (${RELATION_LABEL[m.relationship]})`).join(", ")}`}
                .
              </p>
              {enrolment.top_up_code && (
                <p className="text-muted-foreground">
                  Top-up {enrolment.top_up_code}: <Money value={enrolment.employee_premium_annual} /> a year, deducted monthly from pay.
                </p>
              )}
            </>
          ) : (
            <p>
              <Badge variant="muted">Waived</Badge>
            </p>
          )
        ) : (
          <p className="text-muted-foreground">Not enrolled yet.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {item.window_open ? (
            <Button size="sm" onClick={onEnrol}>
              {enrolment ? "Change enrolment" : "Enrol"}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {plan.enrolment_closes ? `Enrolment closed ${formatDay(plan.enrolment_closes, true)}.` : ""}
            </p>
          )}
          {enrolment?.status === "enrolled" && !item.window_open && (
            <Button size="sm" variant="outline" onClick={onLifeEvent}>
              Marriage, birth or other change
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MemberRows({
  members,
  covers,
  onChange,
}: {
  members: Member[];
  covers: Relation[];
  onChange: (members: Member[]) => void;
}) {
  const update = (index: number, patch: Partial<Member>) =>
    onChange(members.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  return (
    <div className="grid gap-2">
      {members.map((member, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[1fr_9rem_9rem_auto]">
          <Input aria-label="Name" placeholder="Name" value={member.name} onChange={(e) => update(index, { name: e.target.value })} />
          <Select value={member.relationship} onValueChange={(v) => update(index, { relationship: v as Relation })}>
            <SelectTrigger aria-label="Relationship" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {covers.map((r) => (
                <SelectItem key={r} value={r}>
                  {RELATION_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label="Date of birth"
            type="date"
            value={member.date_of_birth ?? ""}
            onChange={(e) => update(index, { date_of_birth: e.target.value || null })}
          />
          <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => onChange(members.filter((_, i) => i !== index))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      {covers.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          className="justify-self-start"
          onClick={() => onChange([...members, { name: "", relationship: covers[0], date_of_birth: null, gender: null }])}
        >
          <Plus /> Add a person
        </Button>
      )}
    </div>
  );
}

function EnrolDialog({ item, onClose, onDone }: { item: MyPlan; onClose: () => void; onDone: () => void }) {
  const { plan, enrolment } = item;
  const [members, setMembers] = useState<Member[]>(enrolment?.members ?? []);
  const [topUp, setTopUp] = useState(enrolment?.top_up_code ?? NO_TOP_UP);
  const [busy, setBusy] = useState(false);

  const submit = async (waive: boolean) => {
    setBusy(true);
    try {
      await post(`/benefits/plans/${plan.id}/enrol`, {
        waive,
        members: waive ? [] : members.filter((m) => m.name.trim()),
        top_up_code: waive || topUp === NO_TOP_UP ? null : topUp,
      });
      toast.success(waive ? "Plan waived." : "Enrolment saved.");
      onDone();
    } catch (caught) {
      toast.error(failure(caught, "The enrolment could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enrol in {plan.name}</DialogTitle>
          <DialogDescription>
            You are always covered. Add the family members the plan covers ({plan.covers.map((c) => RELATION_LABEL[c]).join(", ") || "none"}
            {plan.max_children !== null ? `, up to ${plan.max_children} children` : ""}).
          </DialogDescription>
        </DialogHeader>
        <MemberRows members={members} covers={plan.covers} onChange={setMembers} />
        {plan.top_ups.length > 0 && (
          <FormField htmlFor="enrol-top-up" label="Top-up (paid by you, deducted monthly)">
            <Select value={topUp} onValueChange={setTopUp}>
              <SelectTrigger id="enrol-top-up" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TOP_UP}>No top-up</SelectItem>
                {plan.top_ups.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.name} — ₹{Number(t.employee_premium_annual).toLocaleString("en-IN")} a year
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => void submit(true)}>
            Waive this plan
          </Button>
          <Button disabled={busy || members.some((m) => !m.name.trim())} onClick={() => void submit(false)}>
            {busy && <Loader2 className="animate-spin" />} Enrol
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const LIFE_EVENTS = [
  { value: "marriage", label: "Marriage" },
  { value: "birth", label: "Birth of a child" },
  { value: "adoption", label: "Adoption" },
  { value: "divorce", label: "Divorce" },
  { value: "death", label: "Death of a covered person" },
];

function LifeEventDialog({ item, onClose, onDone }: { item: MyPlan; onClose: () => void; onDone: () => void }) {
  const { plan, enrolment } = item;
  const [kind, setKind] = useState("marriage");
  const [eventDate, setEventDate] = useState("");
  const [adds, setAdds] = useState<Member[]>([]);
  const [removes, setRemoves] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const removing = kind === "divorce" || kind === "death";

  const submit = async () => {
    setBusy(true);
    try {
      await post("/benefits/life-events", {
        plan_id: plan.id,
        kind,
        event_date: eventDate,
        add_members: removing ? [] : adds.filter((m) => m.name.trim()),
        remove_members: removing ? removes : [],
        note: note.trim() || null,
      });
      toast.success("Sent to HR.");
      onDone();
    } catch (caught) {
      toast.error(failure(caught, "The change could not be sent."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Change cover after a life event</DialogTitle>
          <DialogDescription>
            Within {plan.life_event_window_days} days of the event. HR approves, then the insurer is told.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="le-kind" label="What happened">
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="le-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIFE_EVENTS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="le-date" label="When">
              <Input id="le-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </FormField>
          </div>
          {removing ? (
            <FormField htmlFor="le-remove" label="Who to remove from cover">
              <Select value={removes[0] ?? ""} onValueChange={(v) => setRemoves([v])}>
                <SelectTrigger id="le-remove" className="w-full">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {(enrolment?.members ?? []).map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.name} ({RELATION_LABEL[m.relationship]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : (
            <MemberRows members={adds} covers={plan.covers} onChange={setAdds} />
          )}
          <FormField htmlFor="le-note" label="Note" optional>
            <Textarea id="le-note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !eventDate || (removing ? removes.length === 0 : adds.filter((m) => m.name.trim()).length === 0)}
            onClick={() => void submit()}
          >
            {busy && <Loader2 className="animate-spin" />} Send to HR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
