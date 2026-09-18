"use client";

import { Check, ClipboardCheck, Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { EmployeePicker, type PickedEmployee } from "@/components/people/EmployeePicker";
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
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch, post } from "@/lib/api";
import type { ActionPlan, ActionPlanItem, PlanStatus } from "@/lib/types/culture";
import { formatDate, toISODate } from "@/lib/utils";

import { apiDetail } from "../cultureShared";

const PLAN_STATUS: Record<PlanStatus, { label: string; variant: "outline" | "secondary" | "warning" | "success" | "muted" }> = {
  draft: { label: "Draft", variant: "outline" },
  committed: { label: "Committed", variant: "secondary" },
  in_progress: { label: "In progress", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  dropped: { label: "Dropped", variant: "muted" },
};

/**
 * Action plans: what a manager or HR committed to after a survey.
 *
 * A plan completes only when every item is done or explicitly dropped with a
 * reason — the survey said something, and "we quietly stopped" is not an
 * answer the people who responded ever get to hear.
 */
export function ActionPlansTab({ surveys }: { surveys: { id: string; name: string }[] }) {
  const { data, error, isLoading, reload, setData } = useApiQuery<ActionPlan[]>("/culture/action-plans");
  const [creating, setCreating] = useState(false);

  const replace = (plan: ActionPlan) =>
    setData((current) => (current ?? []).map((row) => (row.id === plan.id ? plan : row)));

  return (
    <>
      <DataPanel
        tier="tier2"
        title="Action plans"
        actions={
          <Button size="sm" onClick={() => setCreating(true)} disabled={surveys.length === 0}>
            <Plus /> New plan
          </Button>
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data ?? []).length === 0}
        empty={{
          icon: ClipboardCheck,
          title: "No action plans yet",
          description: "After a survey closes, commit to what you will change — and then report back.",
        }}
      >
        <ul className="divide-y divide-border">
          {(data ?? []).map((plan) => (
            <PlanRow key={plan.id} plan={plan} onChanged={replace} />
          ))}
        </ul>
      </DataPanel>
      <NewPlanDialog open={creating} surveys={surveys} onOpenChange={setCreating} onCreated={reload} />
    </>
  );
}

function PlanRow({ plan, onChanged }: { plan: ActionPlan; onChanged: (plan: ActionPlan) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [dropping, setDropping] = useState<ActionPlanItem | null>(null);
  const [dropReason, setDropReason] = useState("");

  const run = async (key: string, action: () => Promise<ActionPlan>, success: string) => {
    setBusy(key);
    try {
      onChanged(await action());
      toast.success(success);
    } catch (caught) {
      toast.error(apiDetail(caught, "That did not work."));
    } finally {
      setBusy(null);
    }
  };

  const open = plan.status !== "completed" && plan.status !== "dropped";
  const unresolved = plan.items.filter((item) => !item.done_on && !item.dropped_reason).length;
  const status = PLAN_STATUS[plan.status];

  return (
    <li className="grid gap-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground capitalize">{plan.theme.replaceAll("_", " ")}</span>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {plan.survey_name ?? "Survey"} · {plan.scope} {plan.scope_key} · owned by {plan.owner.name} · due{" "}
            {formatDate(plan.due_date)}
          </div>
        </div>
        {plan.can_edit && open && (
          <Button
            size="sm"
            variant="outline"
            disabled={unresolved > 0 || busy !== null}
            title={unresolved > 0 ? `${unresolved} item(s) still open` : undefined}
            onClick={() =>
              run("complete", () => post<ActionPlan>(`/culture/action-plans/${plan.id}/complete`, {}), "Plan completed.")
            }
          >
            {busy === "complete" && <Loader2 className="animate-spin" />} Complete plan
          </Button>
        )}
      </div>

      <ul className="grid gap-2">
        {plan.items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <div className="min-w-0">
              <span className={item.done_on || item.dropped_reason ? "text-muted-foreground line-through" : "text-foreground"}>
                {item.description}
              </span>
              <div className="text-xs text-muted-foreground">
                {item.owner.name} · due {formatDate(item.due_date)}
                {item.done_on && ` · done ${formatDate(item.done_on)}`}
                {item.dropped_reason && ` · dropped: ${item.dropped_reason}`}
              </div>
            </div>
            {plan.can_edit && !item.done_on && !item.dropped_reason && (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() =>
                    run(
                      item.id,
                      () => patch<ActionPlan>(`/culture/action-plan-items/${item.id}`, { done_on: toISODate(new Date()) }),
                      "Marked done.",
                    )
                  }
                >
                  <Check /> Done
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDropping(item)}>
                  <X /> Drop
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {plan.progress_notes.length > 0 && (
        <ul className="grid gap-1 text-xs text-muted-foreground">
          {plan.progress_notes.map((row, index) => (
            <li key={index}>
              {formatDate(row.at)} · {row.by}: {row.note}
            </li>
          ))}
        </ul>
      )}

      {plan.can_edit && open && (
        <div className="flex gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a progress note" aria-label="Progress note" />
          <Button
            size="sm"
            variant="outline"
            disabled={!note.trim() || busy !== null}
            onClick={() =>
              run(
                "note",
                async () => {
                  const updated = await post<ActionPlan>(`/culture/action-plans/${plan.id}/notes`, { note: note.trim() });
                  setNote("");
                  return updated;
                },
                "Note added.",
              )
            }
          >
            Add
          </Button>
        </div>
      )}

      <Dialog open={dropping !== null} onOpenChange={(next) => !next && setDropping(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Drop this item?</DialogTitle>
            <DialogDescription>Say why. The reason is what the people who responded will eventually hear.</DialogDescription>
          </DialogHeader>
          <Textarea value={dropReason} onChange={(e) => setDropReason(e.target.value)} rows={3} aria-label="Why it is dropped" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDropping(null)}>
              Keep it
            </Button>
            <Button
              disabled={!dropReason.trim() || busy !== null}
              onClick={async () => {
                if (!dropping) return;
                await run(
                  dropping.id,
                  () => patch<ActionPlan>(`/culture/action-plan-items/${dropping.id}`, { dropped_reason: dropReason.trim() }),
                  "Item dropped, with the reason recorded.",
                );
                setDropping(null);
                setDropReason("");
              }}
            >
              Drop item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

interface ItemDraft {
  description: string;
  owner: PickedEmployee | null;
  due: string;
}

function NewPlanDialog({
  open,
  surveys,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  surveys: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [surveyId, setSurveyId] = useState("");
  const [scope, setScope] = useState<"company" | "department" | "team">("team");
  const [scopeKey, setScopeKey] = useState("");
  const [theme, setTheme] = useState("");
  const [owner, setOwner] = useState<PickedEmployee | null>(null);
  const [due, setDue] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([{ description: "", owner: null, due: "" }]);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSurveyId(surveys[0]?.id ?? "");
    setScope("team");
    setScopeKey("");
    setTheme("");
    setOwner(null);
    setDue("");
    setItems([{ description: "", owner: null, due: "" }]);
  }, [open, surveys]);

  const ready = items.filter((item) => item.description.trim() && item.owner && item.due);
  const invalid =
    !surveyId || !scopeKey.trim() || !theme.trim() || !owner || !due || ready.length === 0 || ready.length !== items.length;

  const submit = async () => {
    if (!owner) return;
    setIsBusy(true);
    try {
      await post("/culture/action-plans", {
        survey_id: surveyId,
        scope,
        scope_key: scopeKey.trim(),
        theme: theme.trim(),
        owner_employee_id: owner.id,
        due_date: due,
        items: ready.map((item) => ({
          description: item.description.trim(),
          owner_employee_id: item.owner!.id,
          due_date: item.due,
        })),
      });
      toast.success("Plan created.");
      onCreated();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not create the plan."));
    } finally {
      setIsBusy(false);
    }
  };

  const setItem = (index: number, patchValue: Partial<ItemDraft>) =>
    setItems(items.map((item, at) => (at === index ? { ...item, ...patchValue } : item)));

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New action plan</DialogTitle>
          <DialogDescription>What you will change in response to a survey, who owns each part, and by when.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="plan-survey" label="Survey">
              <Select value={surveyId} onValueChange={setSurveyId}>
                <SelectTrigger id="plan-survey" className="w-full">
                  <SelectValue placeholder="Choose a survey" />
                </SelectTrigger>
                <SelectContent>
                  {surveys.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="plan-theme" label="Theme it addresses">
              <Input id="plan-theme" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="workload" />
            </FormField>
            <FormField htmlFor="plan-scope" label="Scope">
              <Select value={scope} onValueChange={(next) => setScope(next as typeof scope)}>
                <SelectTrigger id="plan-scope" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="plan-scope-key" label="Which one" hint="The department or team name, as in the results.">
              <Input id="plan-scope-key" value={scopeKey} onChange={(e) => setScopeKey(e.target.value)} />
            </FormField>
            <FormField htmlFor="plan-owner" label="Plan owner">
              <EmployeePicker id="plan-owner" value={owner} onChange={setOwner} />
            </FormField>
            <FormField htmlFor="plan-due" label="Due">
              <Input id="plan-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </FormField>
          </div>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium">Items</legend>
            {items.map((item, index) => (
              <div key={index} className="grid gap-2 rounded-md border border-border p-3">
                <Input
                  aria-label={`Item ${index + 1}`}
                  value={item.description}
                  onChange={(e) => setItem(index, { description: e.target.value })}
                  placeholder="No meetings on Friday afternoons for a quarter"
                />
                <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
                  <EmployeePicker value={item.owner} onChange={(next) => setItem(index, { owner: next })} placeholder="Owner" />
                  <Input type="date" aria-label={`Item ${index + 1} due`} value={item.due} onChange={(e) => setItem(index, { due: e.target.value })} />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove item"
                    disabled={items.length === 1}
                    onClick={() => setItems(items.filter((_, at) => at !== index))}
                  >
                    <X />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-fit" onClick={() => setItems([...items, { description: "", owner: null, due: "" }])}>
              <Plus /> Add item
            </Button>
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || invalid}>
            {isBusy && <Loader2 className="animate-spin" />} Create plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
