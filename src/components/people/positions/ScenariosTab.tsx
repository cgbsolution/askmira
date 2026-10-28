"use client";

import type { ColumnDef, SortingFn } from "@tanstack/react-table";
import { FlaskConical, Loader2, Plus, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type {
  Position,
  ScenarioChangeKind,
  ScenarioProjection,
  ScenarioSummary,
} from "@/lib/types/people";
import { formatDate, toISODate } from "@/lib/utils";

import { NONE, apiMessage, fromSelect } from "../labels";
import { useOrgReference } from "../useOrgReference";
import { DatePicker } from "@/components/common/DatePicker";

const KIND_LABEL: Record<ScenarioChangeKind, string> = {
  create: "New seat",
  move: "Move",
  freeze: "Freeze",
  unfreeze: "Unfreeze",
  abolish: "Abolish",
};

const STATUS_VARIANT = { draft: "secondary", committed: "success", discarded: "muted" } as const;

type ScenarioChange = ScenarioProjection["changes"][number];
type ScenarioComparison = ScenarioProjection["comparison"][number];

function changeDetail(change: ScenarioChange): string {
  return (
    Object.entries(change.values)
      .filter(([key]) => !key.endsWith("_id"))
      .map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`)
      .join(" · ") || (change.position_id ? "Existing seat" : "—")
  );
}

const CHANGE_COLUMNS: ColumnDef<ScenarioChange>[] = [
  {
    id: "kind",
    header: "Change",
    accessorFn: (change) => KIND_LABEL[change.kind],
    cell: ({ row }) => <Badge variant="outline">{KIND_LABEL[row.original.kind]}</Badge>,
  },
  {
    id: "detail",
    header: "Detail",
    accessorFn: changeDetail,
    meta: { cellClassName: "text-xs text-muted-foreground" },
  },
  {
    accessorKey: "reason",
    header: "Reason",
    meta: { cellClassName: "text-sm" },
    cell: ({ row }) => row.original.reason || "—",
  },
];

/** The deltas are signed decimal strings: sorted by value, so -5 comes before -1. */
const byDelta: SortingFn<ScenarioComparison> = (a, b, id) => Number(a.getValue(id)) - Number(b.getValue(id));

const COMPARISON_COLUMNS: ColumnDef<ScenarioComparison>[] = [
  { accessorKey: "scope", header: "Scope", meta: { cellClassName: "font-medium text-foreground" } },
  {
    accessorKey: "fte_delta",
    header: "FTE change",
    sortingFn: byDelta,
    meta: { className: "text-right", cellClassName: "tabular-nums" },
  },
  {
    accessorKey: "cost_delta",
    header: "Cost change",
    sortingFn: byDelta,
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.cost_delta} />,
  },
];

/**
 * What-if scenarios.
 *
 * A scenario is modelled against the live organisation without touching it:
 * the projection shows the headcount and cost deltas and the vacancies that
 * would result, and only committing applies the changes. A move cannot change
 * grade or budget — that would hide a pay rise inside a reorg — so those are
 * their own changes.
 */
export function ScenariosTab() {
  const { hasRole } = useAuth();
  const canManage = hasRole("admin");
  const scenarios = useApiQuery<ScenarioSummary[]>("/positions/scenarios");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!selected && scenarios.data && scenarios.data.length > 0) {
      setSelected(scenarios.data[0].scenario_id);
    }
  }, [scenarios.data, selected]);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <DataPanel
        title="Scenarios"
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> New
            </Button>
          ) : undefined
        }
        isLoading={scenarios.isLoading}
        error={scenarios.error?.detail ?? null}
        onRetry={scenarios.reload}
        isEmpty={(scenarios.data ?? []).length === 0}
        empty={{
          icon: FlaskConical,
          title: "No scenarios",
          description: "Model a reorg or a growth plan before committing to it.",
        }}
      >
        <ul className="divide-y divide-border">
          {(scenarios.data ?? []).map((row) => (
            <li key={row.scenario_id}>
              <Button
                variant="ghost"
                className="h-auto w-full justify-start rounded-none px-5 py-3 text-left"
                aria-pressed={selected === row.scenario_id}
                onClick={() => setSelected(row.scenario_id)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{row.name}</span>
                    <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
                  </div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {row.changes} change{row.changes === 1 ? "" : "s"} · as of {formatDate(row.as_of)}
                  </div>
                </div>
              </Button>
            </li>
          ))}
        </ul>
      </DataPanel>

      {selected ? (
        <ScenarioDetail
          key={selected}
          scenarioId={selected}
          canManage={canManage}
          onChanged={scenarios.reload}
        />
      ) : (
        <div />
      )}

      <NewScenarioDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => {
          scenarios.reload();
          setSelected(id);
        }}
      />
    </div>
  );
}

function ScenarioDetail({
  scenarioId,
  canManage,
  onChanged,
}: {
  scenarioId: string;
  canManage: boolean;
  onChanged: () => void;
}) {
  const { data, error, isLoading, reload } = useApiQuery<ScenarioProjection>(
    `/positions/scenarios/${scenarioId}`,
  );
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<"commit" | "discard" | null>(null);

  const isDraft = data?.status === "draft";

  const act = async (action: "commit" | "discard") => {
    try {
      await post(`/positions/scenarios/${scenarioId}/${action}`);
      toast.success(action === "commit" ? "Scenario applied to the live organisation." : "Scenario discarded.");
      reload();
      onChanged();
    } catch (caught) {
      toast.error(apiMessage(caught, `Could not ${action} the scenario.`));
      throw caught;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        title={data?.name ?? "Scenario"}
        description={data ? `Projected as of ${formatDate(data.as_of)}. Nothing here is live until it is committed.` : undefined}
        columns={CHANGE_COLUMNS}
        data={data?.changes ?? []}
        noun="changes"
        exportName="scenario-changes"
        searchPlaceholder="Search changes"
        actions={
          canManage && isDraft ? (
            <>
              <Button size="sm" variant="outline" className="h-9" onClick={() => setAdding(true)}>
                <Plus /> Add change
              </Button>
              <Button size="sm" variant="outline" className="h-9" onClick={() => setConfirm("discard")}>
                Discard
              </Button>
              <Button
                size="sm"
                className="h-9"
                onClick={() => setConfirm("commit")}
                disabled={(data?.changes.length ?? 0) === 0}
              >
                Commit
              </Button>
            </>
          ) : undefined
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        empty={{ icon: FlaskConical, title: "No changes yet", description: "Add a new seat, a move, a freeze or an abolition." }}
      />

      {data && data.warnings.length > 0 && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>What committing this would run into</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {data.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {data && data.comparison.length > 0 && (
        <DataTable
          title="Live against projected"
          columns={COMPARISON_COLUMNS}
          data={data.comparison}
          getRowId={(row) => row.scope}
          noun="scopes"
          exportName="scenario-live-against-projected"
          searchPlaceholder="Search scopes"
        />
      )}

      <ChangeDialog
        open={adding}
        scenarioId={scenarioId}
        onOpenChange={setAdding}
        onAdded={() => {
          reload();
          onChanged();
        }}
      />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === "commit" ? "Commit this scenario?" : "Discard this scenario?"}
        description={
          confirm === "commit"
            ? "Every change is applied to the live positions, and each is audited. This is the step that is not a what-if."
            : "The scenario is kept, marked discarded, and can no longer be committed."
        }
        confirmLabel={confirm === "commit" ? "Commit" : "Discard"}
        destructive={confirm === "discard"}
        onConfirm={() => (confirm ? act(confirm) : undefined)}
      />
    </div>
  );
}

function NewScenarioDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [asOf, setAsOf] = useState(toISODate(new Date()));
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setAsOf(toISODate(new Date()));
    }
  }, [open]);

  const submit = async () => {
    setIsBusy(true);
    try {
      const created = await post<ScenarioSummary>("/positions/scenarios", {
        name: name.trim(),
        description: description.trim() || null,
        as_of: asOf,
      });
      toast.success("Scenario created.");
      onCreated(created.scenario_id);
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not create the scenario."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New scenario</DialogTitle>
          <DialogDescription>Modelled against the organisation as of the date you pick.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="scenario-name" label="Name">
            <Input id="scenario-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="FY27 sales expansion" />
          </FormField>
          <FormField htmlFor="scenario-as-of" label="As of">
            <DatePicker id="scenario-as-of" value={asOf} onChange={setAsOf} />
          </FormField>
          <FormField htmlFor="scenario-description" label="Description" optional>
            <Textarea id="scenario-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || !name.trim()}>
            {isBusy && <Loader2 className="animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangeDialog({
  open,
  scenarioId,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  scenarioId: string;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const org = useOrgReference();
  const positions = useApiQuery<Position[]>(open ? "/positions" : null);
  const [kind, setKind] = useState<ScenarioChangeKind>("create");
  const [positionId, setPositionId] = useState(NONE);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState(NONE);
  const [ceiling, setCeiling] = useState("");
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setKind("create");
      setPositionId(NONE);
      setCode("");
      setTitle("");
      setDepartment(NONE);
      setCeiling("");
      setReason("");
    }
  }, [open]);

  const live = useMemo(
    () => (positions.data ?? []).filter((row) => row.status !== "abolished"),
    [positions.data],
  );

  const needsReason = kind === "freeze" || kind === "abolish";
  const invalid =
    kind === "create"
      ? !code.trim() || !title.trim() || !/^\d+(\.\d{1,2})?$/.test(ceiling)
      : positionId === NONE ||
        (kind === "move" && department === NONE) ||
        (needsReason && reason.trim().length < 3);

  const submit = async () => {
    setIsBusy(true);
    const departmentId = fromSelect(department);
    const departmentName = departmentId ? org.departmentName(departmentId) : undefined;
    const values: Record<string, unknown> =
      kind === "create"
        ? {
            code: code.trim(),
            title: title.trim(),
            budgeted_ctc_max: ceiling,
            ...(departmentId ? { department_id: departmentId, department_name: departmentName } : {}),
          }
        : kind === "move"
          ? { department_id: departmentId, department_name: departmentName }
          : {};
    try {
      await post(`/positions/scenarios/${scenarioId}/changes`, {
        kind,
        position_id: kind === "create" ? null : fromSelect(positionId),
        values,
        reason: reason.trim(),
      });
      toast.success("Change added to the scenario.");
      onAdded();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not add the change."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a change</DialogTitle>
          <DialogDescription>
            A move changes where a seat sits, never its grade or budget — a pay rise hidden inside
            a reorg is exactly what a scenario should not allow.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="change-kind" label="Kind of change">
            <Select value={kind} onValueChange={(next) => setKind(next as ScenarioChangeKind)}>
              <SelectTrigger id="change-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABEL) as ScenarioChangeKind[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {KIND_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {kind === "create" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField htmlFor="change-title" label="Title">
                  <Input id="change-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </FormField>
                <FormField htmlFor="change-code" label="Code">
                  <Input id="change-code" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
                </FormField>
              </div>
              <FormField
                htmlFor="change-ceiling"
                label="Budgeted CTC ceiling"
                hint="Required. A new seat with no cost makes the scenario look free."
              >
                <Input id="change-ceiling" value={ceiling} onChange={(e) => setCeiling(e.target.value.trim())} inputMode="decimal" />
              </FormField>
            </>
          ) : (
            <FormField htmlFor="change-position" label="Position">
              <Select value={positionId} onValueChange={setPositionId}>
                <SelectTrigger id="change-position" className="w-full">
                  <SelectValue placeholder="Choose a position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Choose a position</SelectItem>
                  {live.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.title} ({row.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          {(kind === "create" || kind === "move") && (
            <FormField htmlFor="change-department" label={kind === "move" ? "Move to department" : "Department"} optional={kind === "create"}>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger id="change-department" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {org.departments.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          <FormField htmlFor="change-reason" label="Reason" optional={!needsReason}>
            <Textarea id="change-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || invalid}>
            {isBusy && <Loader2 className="animate-spin" />} Add change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
