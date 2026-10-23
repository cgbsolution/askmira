"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ListOrdered, Pencil, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { InterviewRequisitionSelect } from "@/components/hiring/InterviewRequisitionSelect";
import { humanize, INTERVIEW_MODE } from "@/components/hiring/labels";
import { ActionDialog } from "@/components/hiring/OfferActionDialog";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch, post } from "@/lib/api";
import type { InterviewMode, InterviewStage, InterviewStageType, StageInput } from "@/lib/types/hiring";

const STAGE_TYPES: InterviewStageType[] = ["ai_screen", "technical", "managerial", "hr", "panel"];

/** HR's configuration of a requisition's interview rounds. */
export function InterviewRoundsPanel() {
  const [requisitionId, setRequisitionId] = useState("");
  const [editing, setEditing] = useState<InterviewStage | "new" | null>(null);
  const stages = useApiQuery<InterviewStage[]>(
    requisitionId ? `/interviews/stages?requisition_id=${requisitionId}` : null,
  );
  const rows = (stages.data ?? [])
    .filter((stage) => stage.requisition_id === requisitionId)
    .sort((a, b) => a.sequence - b.sequence);

  const columns: ColumnDef<InterviewStage>[] = [
    { accessorKey: "sequence", header: "#", meta: { className: "text-right tabular-nums" } },
    { accessorKey: "name", header: "Round", meta: { cellClassName: "font-medium text-foreground" } },
    {
      accessorKey: "stage_type",
      header: "Type",
      meta: { text: (stage) => humanize(stage.stage_type) },
      cell: ({ row }) => humanize(row.original.stage_type),
    },
    { accessorKey: "duration_minutes", header: "Minutes", meta: { className: "text-right tabular-nums" } },
    {
      accessorKey: "mode",
      header: "Mode",
      meta: { text: (stage) => INTERVIEW_MODE[stage.mode] ?? stage.mode },
      cell: ({ row }) => INTERVIEW_MODE[row.original.mode] ?? row.original.mode,
    },
    {
      id: "competencies",
      header: "Competencies",
      accessorFn: (stage) =>
        stage.required_competencies.length ? stage.required_competencies.map(humanize).join(", ") : "None",
      meta: { cellClassName: "max-w-56 text-xs text-muted-foreground" },
    },
    {
      id: "rules",
      header: "Rules",
      meta: {
        text: (stage) =>
          [stage.is_eliminating && "Eliminating", stage.feedback_required && "Feedback required"]
            .filter(Boolean)
            .join(", "),
      },
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.is_eliminating && <Badge variant="warning">Eliminating</Badge>}
          {row.original.feedback_required && <Badge variant="secondary">Feedback required</Badge>}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={() => setEditing(row.original)}>
          <Pencil /> Edit
        </Button>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="max-w-md">
        <InterviewRequisitionSelect id="rounds-requisition" value={requisitionId} onChange={setRequisitionId} />
      </div>
      {requisitionId && (
        <DataTable
          title="Interview rounds"
          description="The rounds every candidate on this requisition goes through, in order."
          actions={
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus /> Add round
            </Button>
          }
          columns={columns}
          data={rows}
          noun="rounds"
          exportName="interview-rounds"
          searchPlaceholder="Search rounds"
          isLoading={stages.isLoading && rows.length === 0}
          error={stages.error?.detail}
          onRetry={stages.reload}
          empty={{
            icon: ListOrdered,
            title: "No rounds configured",
            description: "Add the rounds before scheduling interviews for this requisition.",
          }}
        />
      )}
      {editing && requisitionId && (
        <InterviewStageDialog
          key={editing === "new" ? "new" : editing.id}
          requisitionId={requisitionId}
          stage={editing === "new" ? null : editing}
          nextSequence={rows.length ? rows[rows.length - 1].sequence + 1 : 1}
          onClose={() => setEditing(null)}
          onSaved={stages.reload}
        />
      )}
    </div>
  );
}

/** Add or edit one interview round. */
function InterviewStageDialog({
  requisitionId,
  stage,
  nextSequence,
  onClose,
  onSaved,
}: {
  requisitionId: string;
  stage: InterviewStage | null;
  nextSequence: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sequence, setSequence] = useState(String(stage?.sequence ?? nextSequence));
  const [name, setName] = useState(stage?.name ?? "");
  const [stageType, setStageType] = useState<InterviewStageType>(stage?.stage_type ?? "technical");
  const [duration, setDuration] = useState(String(stage?.duration_minutes ?? 60));
  const [mode, setMode] = useState<InterviewMode>(stage?.mode ?? "video");
  const [competencies, setCompetencies] = useState((stage?.required_competencies ?? []).join(", "));
  const [eliminating, setEliminating] = useState(stage?.is_eliminating ?? false);
  const [feedbackRequired, setFeedbackRequired] = useState(stage?.feedback_required ?? true);
  const [notes, setNotes] = useState(stage?.preparation_notes ?? "");

  const validate = () => {
    if (!/^\d+$/.test(sequence.trim()) || Number(sequence) < 1) return "Order must be a whole number from 1.";
    if (!name.trim()) return "Give the round a name.";
    const minutes = Number(duration);
    if (!/^\d+$/.test(duration.trim()) || minutes < 5 || minutes > 480) {
      return "Duration must be a whole number of minutes between 5 and 480.";
    }
    return null;
  };

  const submit = async () => {
    const body: Omit<StageInput, "requisition_id"> = {
      sequence: Number(sequence),
      name: name.trim(),
      stage_type: stageType,
      duration_minutes: Number(duration),
      mode,
      required_competencies: competencies
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      is_eliminating: eliminating,
      feedback_required: feedbackRequired,
      preparation_notes: notes.trim() || null,
    };
    if (stage) {
      await patch(`/interviews/stages/${stage.id}`, body);
      toast.success("Round updated");
    } else {
      const input: StageInput = { requisition_id: requisitionId, ...body };
      await post("/interviews/stages", input);
      toast.success("Round added");
    }
    onSaved();
  };

  return (
    <ActionDialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={stage ? "Edit round" : "Add round"}
      submitLabel={stage ? "Save round" : "Add round"}
      validate={validate}
      onSubmit={submit}
      errorFallback="The round could not be saved."
    >
      <div className="grid gap-3 sm:grid-cols-[6rem_1fr]">
        <FormField htmlFor="stage-sequence" label="Order">
          <Input
            id="stage-sequence"
            type="number"
            min={1}
            step={1}
            value={sequence}
            onChange={(event) => setSequence(event.target.value)}
          />
        </FormField>
        <FormField htmlFor="stage-name" label="Name">
          <Input id="stage-name" maxLength={255} value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField htmlFor="stage-type" label="Type">
          <Select value={stageType} onValueChange={(value) => setStageType(value as InterviewStageType)}>
            <SelectTrigger id="stage-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {humanize(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField htmlFor="stage-duration" label="Minutes">
          <Input
            id="stage-duration"
            type="number"
            min={5}
            max={480}
            step={5}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </FormField>
        <FormField htmlFor="stage-mode" label="Mode">
          <Select value={mode} onValueChange={(value) => setMode(value as InterviewMode)}>
            <SelectTrigger id="stage-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(INTERVIEW_MODE) as InterviewMode[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {INTERVIEW_MODE[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField
        htmlFor="stage-competencies"
        label="Required competencies"
        optional
        hint="Comma-separated, for example: problem_solving, communication. Each is rated 1–10 in feedback."
      >
        <Input
          id="stage-competencies"
          value={competencies}
          onChange={(event) => setCompetencies(event.target.value)}
        />
      </FormField>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <Label htmlFor="stage-eliminating">Eliminating round</Label>
          <Switch id="stage-eliminating" checked={eliminating} onCheckedChange={setEliminating} />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <Label htmlFor="stage-feedback">Feedback required</Label>
          <Switch id="stage-feedback" checked={feedbackRequired} onCheckedChange={setFeedbackRequired} />
        </div>
      </div>
      <FormField htmlFor="stage-notes" label="Preparation notes" optional>
        <Textarea
          id="stage-notes"
          rows={3}
          maxLength={4000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </FormField>
    </ActionDialog>
  );
}
