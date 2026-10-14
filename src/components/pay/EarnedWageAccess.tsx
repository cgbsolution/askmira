"use client";

import { Banknote, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post, put } from "@/lib/api";
import { toISODate } from "@/lib/utils";

interface Position {
  enabled: boolean;
  monthly_gross: string;
  days_paid_so_far: string;
  days_in_month: number;
  basis: "attendance" | "calendar";
  earned_to_date: string;
  max_percent: string;
  already_drawn: string;
  available: string;
  min_amount: string;
  requests_left: number;
}

interface AdvanceRequest {
  id: string;
  employee_name: string | null;
  employee_code: string | null;
  period: string;
  amount: string;
  earned_to_date: string;
  status: "requested" | "approved" | "rejected" | "disbursed" | "cancelled";
  decision_note: string | null;
  disbursed_on: string | null;
}

interface Policy {
  enabled: boolean;
  max_percent: string;
  min_amount: string;
  max_requests_per_month: number;
}

const STATUS_VARIANT: Record<AdvanceRequest["status"], "warning" | "secondary" | "muted" | "success"> = {
  requested: "warning",
  approved: "secondary",
  rejected: "muted",
  disbursed: "success",
  cancelled: "muted",
};

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/** For the person: what they have earned this month and what they can draw now. */
export function EarnedWageCard() {
  const position = useApiQuery<Position>("/ewa/me");
  const requests = useApiQuery<AdvanceRequest[]>("/ewa/requests");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const data = position.data;
  if (!data?.enabled) return null;

  const ask = async () => {
    setBusy(true);
    try {
      await post("/ewa/requests", { amount });
      toast.success("Asked. It is recovered from this month's pay.");
      setAmount("");
      position.reload();
      requests.reload();
    } catch (caught) {
      toast.error(failure(caught, "The advance could not be asked for."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Banknote className="size-4 text-primary" /> Pay you have already earned
        </CardTitle>
        <CardDescription>
          {data.days_paid_so_far} of {data.days_in_month} days paid so far
          {data.basis === "calendar" ? " (counted by calendar, as attendance is not tracked)" : ""}. You can draw up to {data.max_percent}% of it
          before payday; it comes off this month&apos;s pay.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Earned this month</p>
            <p className="text-lg font-semibold">
              <Money value={data.earned_to_date} />
            </p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Already drawn</p>
            <p className="text-lg font-semibold">
              <Money value={data.already_drawn} />
            </p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Available now</p>
            <p className="text-lg font-semibold">
              <Money value={data.available} />
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <FormField htmlFor="ewa-amount" label="Amount" hint={`At least ₹${data.min_amount}; ${data.requests_left} request(s) left this month.`}>
            <Input id="ewa-amount" inputMode="decimal" className="w-40 tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormField>
          <Button
            disabled={busy || data.requests_left === 0 || !(Number(amount) >= Number(data.min_amount)) || Number(amount) > Number(data.available)}
            onClick={() => void ask()}
          >
            {busy && <Loader2 className="animate-spin" />} Ask for it
          </Button>
        </div>
        {(requests.data ?? []).length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(requests.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.period}</TableCell>
                  <TableCell className="text-right">
                    <Money value={r.amount} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                    {r.decision_note && <p className="text-xs text-muted-foreground">{r.decision_note}</p>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** For HR: the policy, and requests to approve and pay out. */
export function EwaAdminScreen() {
  const policy = useApiQuery<Policy>("/ewa/policy");
  const requests = useApiQuery<AdvanceRequest[]>("/ewa/requests");
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (request: AdvanceRequest, path: string, body: object, done: string) => {
    setBusy(request.id);
    try {
      await post(`/ewa/requests/${request.id}/${path}`, body);
      toast.success(done);
      requests.reload();
    } catch (caught) {
      toast.error(failure(caught, "That did not go through."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageShell title="Earned wage access" description="Advances on pay already earned this month, recovered in the same month's payroll.">
      <div className="grid gap-6">
        {policy.data && <PolicyCard policy={policy.data} onSaved={policy.reload} />}
        <DataPanel
          tier="tier1"
          title="Requests"
          isLoading={requests.isLoading && !requests.data}
          error={requests.error?.detail ?? null}
          onRetry={requests.reload}
          isEmpty={(requests.data ?? []).length === 0}
          empty={{ icon: Banknote, title: "No requests yet" }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Earned then</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(requests.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <p className="font-medium">{r.employee_name}</p>
                    <p className="text-xs text-muted-foreground">{r.employee_code}</p>
                  </TableCell>
                  <TableCell>{r.period}</TableCell>
                  <TableCell className="text-right">
                    <Money value={r.amount} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={r.earned_to_date} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {r.status === "requested" && (
                        <>
                          <Button size="sm" disabled={busy === r.id} onClick={() => void act(r, "decide", { approve: true }, "Approved; the deduction is in this month's payroll.")}>
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === r.id}
                            onClick={() => void act(r, "decide", { approve: false, note: "Declined by payroll." }, "Declined.")}
                          >
                            Decline
                          </Button>
                        </>
                      )}
                      {r.status === "approved" && (
                        <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => void act(r, "disbursed", { paid_on: toISODate(new Date()) }, "Recorded as paid out.")}>
                          Paid out today
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      </div>
    </PageShell>
  );
}

function PolicyCard({ policy, onSaved }: { policy: Policy; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(policy.enabled);
  const [percent, setPercent] = useState(policy.max_percent);
  const [minimum, setMinimum] = useState(policy.min_amount);
  const [count, setCount] = useState(String(policy.max_requests_per_month));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await put("/ewa/policy", { enabled, max_percent: percent, min_amount: minimum, max_requests_per_month: Number(count) });
      toast.success("Policy saved.");
      onSaved();
    } catch (caught) {
      toast.error(failure(caught, "The policy could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="text-base">Policy</CardTitle>
        <CardDescription>Off until switched on. Only an admin changes it.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center gap-2">
          <Switch id="ewa-enabled" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="ewa-enabled" className="font-normal">
            People may draw earned pay early
          </Label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField htmlFor="ewa-percent" label="Share of earned pay (%)">
            <Input id="ewa-percent" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} />
          </FormField>
          <FormField htmlFor="ewa-min" label="Smallest advance (₹)">
            <Input id="ewa-min" inputMode="decimal" value={minimum} onChange={(e) => setMinimum(e.target.value)} />
          </FormField>
          <FormField htmlFor="ewa-count" label="Requests a month">
            <Input id="ewa-count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} />
          </FormField>
        </div>
        <div>
          <Button disabled={busy || !(Number(percent) > 0 && Number(percent) <= 100) || !(Number(count) >= 1)} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Save policy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
