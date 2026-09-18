"use client";

import { BellRing, CircleCheck, Hourglass, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post, put } from "@/lib/api";
import type { DriftReport, ProbationPolicy, SilencePolicy } from "@/lib/types/people";
import { formatDate } from "@/lib/utils";

import { apiMessage } from "../labels";

const SILENCE: Record<SilencePolicy, { label: string; consequence: string }> = {
  auto_confirm: {
    label: "Confirm them",
    consequence: "Nobody deciding means the person is confirmed. Kind to the employee; it rewards a manager for ignoring the review.",
  },
  require_decision: {
    label: "Wait for a decision",
    consequence: "Nothing happens until somebody decides, and the case escalates to HR. The person stays on probation meanwhile.",
  },
  auto_extend_once: {
    label: "Extend once, then wait",
    consequence: "Probation is extended once automatically; after that, a decision is required.",
  },
};

/**
 * Probation: what happens when a manager does not decide, and who is overdue.
 *
 * The silence policy has no default in the API, deliberately — confirming and
 * waiting lead to opposite outcomes for a real person, so the workspace chooses
 * with the consequence written next to each option.
 */
export function ProbationTab() {
  const { hasRole } = useAuth();
  const canSetPolicy = hasRole("tenant_admin", "hr_admin");
  const policy = useApiQuery<ProbationPolicy>("/lifecycle/probation/policy");
  const drift = useApiQuery<DriftReport>(
    policy.data?.configured ? "/lifecycle/probation/drift" : null,
  );

  const [silence, setSilence] = useState<SilencePolicy | "">("");
  const [grace, setGrace] = useState("3");
  const [raisesSalary, setRaisesSalary] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [reminding, setReminding] = useState(false);

  useEffect(() => {
    if (!policy.data) return;
    setSilence(policy.data.silence_policy ?? "");
    setGrace(String(policy.data.grace_days ?? 3));
    setRaisesSalary(policy.data.confirmation_raises_salary ?? false);
  }, [policy.data]);

  const save = async () => {
    if (!silence) return;
    setIsBusy(true);
    try {
      await put("/lifecycle/probation/policy", {
        silence_policy: silence,
        grace_days: Number(grace),
        confirmation_raises_salary: raisesSalary,
        hr_escalation_user_id: policy.data?.hr_escalation_user_id ?? null,
      });
      toast.success("Probation policy saved.");
      policy.reload();
      drift.reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not save the policy."));
    } finally {
      setIsBusy(false);
    }
  };

  const remind = async () => {
    setReminding(true);
    try {
      const result = await post<{ count: number }>("/lifecycle/probation/remind");
      const sent = result.count;
      toast.success(sent ? `${sent} reminder${sent === 1 ? "" : "s"} sent.` : "Nobody was due a reminder.");
      drift.reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "Reminders were not sent."));
    } finally {
      setReminding(false);
    }
  };

  const graceOk = /^\d+$/.test(grace) && Number(grace) <= 90;

  return (
    <div className="flex flex-col gap-4">
      <DataPanel
        title="When nobody decides"
        description="What happens to a person whose probation review is overdue."
        isLoading={policy.isLoading}
        error={policy.error?.detail ?? null}
        onRetry={policy.reload}
      >
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {policy.data && !policy.data.configured && (
            <Alert variant="warning" className="sm:col-span-2">
              <Hourglass />
              <AlertTitle>No policy chosen yet</AlertTitle>
              <AlertDescription>
                Overdue reviews are not resolved until one is. There is no default, because the
                two main options lead to opposite outcomes for the person.
              </AlertDescription>
            </Alert>
          )}
          <FormField
            htmlFor="silence-policy"
            label="If the review is overdue"
            className="sm:col-span-2"
            hint={silence ? SILENCE[silence].consequence : "Choose deliberately — the consequence is shown once you do."}
          >
            <Select value={silence} onValueChange={(next) => setSilence(next as SilencePolicy)} disabled={!canSetPolicy}>
              <SelectTrigger id="silence-policy" className="w-full">
                <SelectValue placeholder="Choose what happens" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SILENCE) as SilencePolicy[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {SILENCE[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            htmlFor="grace-days"
            label="Grace days after the due date"
            error={graceOk ? undefined : "Whole days, 0 to 90."}
          >
            <Input id="grace-days" value={grace} onChange={(e) => setGrace(e.target.value.trim())} inputMode="numeric" disabled={!canSetPolicy} />
          </FormField>
          <div className="flex items-center gap-3 self-end pb-2">
            <Switch id="raises-salary" checked={raisesSalary} onCheckedChange={setRaisesSalary} disabled={!canSetPolicy} />
            <Label htmlFor="raises-salary" className="text-sm font-normal">
              Confirmation can carry a salary revision
            </Label>
          </div>
          {canSetPolicy && (
            <div className="sm:col-span-2">
              <Button onClick={save} disabled={isBusy || !silence || !graceOk}>
                {isBusy && <Loader2 className="animate-spin" />} Save policy
              </Button>
            </div>
          )}
        </div>
      </DataPanel>

      {policy.data?.configured && (
        <DataPanel
          title="Overdue probation reviews"
          description={drift.data ? `${drift.data.count} overdue as of ${formatDate(drift.data.as_of)}.` : undefined}
          actions={
            <Button size="sm" variant="outline" onClick={remind} disabled={reminding}>
              {reminding ? <Loader2 className="animate-spin" /> : <BellRing />} Send due reminders
            </Button>
          }
          isLoading={drift.isLoading}
          error={drift.error?.detail ?? null}
          onRetry={drift.reload}
          isEmpty={(drift.data?.cases ?? []).length === 0}
          empty={{ icon: CircleCheck, title: "No overdue reviews" }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead className="text-right">Days overdue</TableHead>
                <TableHead>Reminders</TableHead>
                <TableHead>What the policy does</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(drift.data?.cases ?? []).map((row) => (
                <TableRow key={row.review_id}>
                  <TableCell className="font-medium text-foreground">{row.employee}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.days_overdue}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {Array.isArray(row.reminders_sent) ? row.reminders_sent.join(", ") || "None" : row.reminders_sent}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.resolution}
                    {row.new_probation_end_date && (
                      <div className="text-xs text-muted-foreground">
                        New end date {formatDate(row.new_probation_end_date)}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      )}
    </div>
  );
}
