"use client";

import { ArrowDown, ArrowUp, Info, Loader2, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import {
  DOCUMENT_TYPE_LABELS,
  offsetLabel,
  OWNER_LABELS,
  pluralCount,
  TASK_TYPE_LABELS,
} from "@/components/onboarding/shared";
import { apiErrorMessage, InlineProblem } from "@/components/payroll-ops/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post, put } from "@/lib/api";
import type {
  OnboardingDocumentType,
  OnboardingOwnerCandidate,
  OnboardingOwnerType,
  OnboardingTaskType,
  OnboardingTemplate,
  TemplateInput,
} from "@/lib/types/onboarding";
import { humanizeRole } from "@/lib/utils";

type NamedRef = { id: string; name: string };

const EVERYONE = "__everyone";
const STARTER = "__starter";
const DESK_OWNERS: OnboardingOwnerType[] = ["hr", "it", "finance"];

interface DraftTask {
  key: string;
  title: string;
  description: string;
  owner_type: OnboardingOwnerType;
  owner_user_id: string;
  due_offset_days: string;
  task_type: OnboardingTaskType;
  document_type: OnboardingDocumentType | "";
  is_mandatory: boolean;
}

let draftCounter = 0;
function nextKey(): string {
  draftCounter += 1;
  return `draft-${draftCounter}`;
}

function blankTask(): DraftTask {
  return {
    key: nextKey(),
    title: "",
    description: "",
    owner_type: "new_joiner",
    owner_user_id: STARTER,
    due_offset_days: "0",
    task_type: "general",
    document_type: "",
    is_mandatory: true,
  };
}

function fromTemplate(template: OnboardingTemplate | null): DraftTask[] {
  if (!template) return [blankTask()];
  return template.tasks.map((task) => ({
    key: nextKey(),
    title: task.title,
    description: task.description ?? "",
    owner_type: task.owner_type,
    owner_user_id: task.owner_user_id ?? STARTER,
    due_offset_days: String(task.due_offset_days),
    task_type: task.task_type,
    document_type: (task.document_type as OnboardingDocumentType | null) ?? "",
    is_mandatory: task.is_mandatory,
  }));
}

function offsetProblem(value: string): string | null {
  if (!/^-?\d+$/.test(value.trim())) return "Whole days, e.g. -7 or 30.";
  const days = Number(value.trim());
  if (days < -180 || days > 365) return "Between 180 days before and 365 days after joining.";
  return null;
}

/**
 * Create or edit a checklist: its name, who it applies to, and its tasks in
 * order. Plans already started keep the tasks they started with.
 */
export function TemplateEditor({
  template,
  open,
  onClose,
  onSaved,
}: {
  /** Null for a new checklist. */
  template: OnboardingTemplate | null;
  open: boolean;
  onClose: () => void;
  onSaved: (template: OnboardingTemplate) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{template ? `Edit ${template.name}` : "New checklist"}</SheetTitle>
          <SheetDescription>
            Due dates are days relative to the joining date; negative is before day one.
          </SheetDescription>
        </SheetHeader>
        {open && (
          <EditorForm
            key={template?.id ?? "new"}
            template={template}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function EditorForm({
  template,
  onClose,
  onSaved,
}: {
  template: OnboardingTemplate | null;
  onClose: () => void;
  onSaved: (template: OnboardingTemplate) => void;
}) {
  const departments = useApiQuery<NamedRef[]>("/org/departments");
  const locations = useApiQuery<NamedRef[]>("/org/locations");
  const owners = useApiQuery<OnboardingOwnerCandidate[]>("/onboarding/owner-candidates");

  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [departmentId, setDepartmentId] = useState(template?.department_id ?? EVERYONE);
  const [locationId, setLocationId] = useState(template?.location_id ?? EVERYONE);
  const [active, setActive] = useState(template?.active ?? true);
  const [isDefault, setIsDefault] = useState(template?.is_default ?? false);
  const [tasks, setTasks] = useState<DraftTask[]>(() => fromTemplate(template));
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const update = (key: string, changes: Partial<DraftTask>) =>
    setTasks((current) => current.map((task) => (task.key === key ? { ...task, ...changes } : task)));
  const move = (index: number, by: number) =>
    setTasks((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(index + by, 0, row);
      return next;
    });

  const taskProblems = tasks.map((task) => ({
    title: task.title.trim() ? null : "Give the task a title.",
    offset: offsetProblem(task.due_offset_days),
    document:
      task.task_type === "document_upload" && !task.document_type
        ? "Choose where the upload is filed."
        : null,
  }));
  const hasProblem =
    !name.trim() ||
    tasks.length === 0 ||
    taskProblems.some((p) => p.title || p.offset || p.document) ||
    (isDefault && !active);

  const save = async () => {
    setTouched(true);
    if (hasProblem) return;
    const input: TemplateInput = {
      name: name.trim(),
      description: description.trim() || null,
      department_id: departmentId === EVERYONE ? null : departmentId,
      location_id: locationId === EVERYONE ? null : locationId,
      active,
      is_default: isDefault,
      tasks: tasks.map((task) => ({
        title: task.title.trim(),
        description: task.description.trim() || null,
        owner_type: task.owner_type,
        owner_user_id:
          DESK_OWNERS.includes(task.owner_type) && task.owner_user_id !== STARTER
            ? task.owner_user_id
            : null,
        due_offset_days: Number(task.due_offset_days.trim()),
        task_type: task.task_type,
        document_type: task.task_type === "document_upload" ? task.document_type || null : null,
        is_mandatory: task.is_mandatory,
      })),
    };
    setIsSaving(true);
    setError(null);
    try {
      const saved = template
        ? await put<OnboardingTemplate>(`/onboarding/templates/${template.id}`, input)
        : await post<OnboardingTemplate>("/onboarding/templates", input);
      toast.success(template ? "Checklist saved" : "Checklist created");
      onSaved(saved);
    } catch (caught) {
      setError(apiErrorMessage(caught, "The checklist could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-6 p-4">
        {template && template.plan_count > 0 && (
          <Alert>
            <Info />
            <AlertDescription>
              {pluralCount(template.plan_count, "plan was", "plans were")} started from this
              checklist. They keep the tasks they started with; your changes apply to plans
              started from now on.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            htmlFor="template-name"
            label="Name"
            className="sm:col-span-2"
            error={touched && !name.trim() ? "The checklist needs a name." : null}
          >
            <Input
              id="template-name"
              value={name}
              maxLength={160}
              disabled={isSaving}
              aria-invalid={touched && !name.trim()}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="template-description" label="Description" optional className="sm:col-span-2">
            <Textarea
              id="template-description"
              rows={2}
              maxLength={4000}
              value={description}
              disabled={isSaving}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="template-department" label="Department">
            <Select value={departmentId} onValueChange={setDepartmentId} disabled={isSaving}>
              <SelectTrigger id="template-department" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EVERYONE}>Every department</SelectItem>
                {(departments.data ?? []).map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="template-location" label="Location">
            <Select value={locationId} onValueChange={setLocationId} disabled={isSaving}>
              <SelectTrigger id="template-location" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EVERYONE}>Every location</SelectItem>
                {(locations.data ?? []).map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="flex items-center gap-3">
            <Switch
              id="template-active"
              checked={active}
              disabled={isSaving}
              onCheckedChange={(value) => {
                setActive(value);
                if (!value) setIsDefault(false);
              }}
            />
            <Label htmlFor="template-active" className="font-normal">
              Active — can be used for new plans
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="template-default"
              checked={isDefault}
              disabled={isSaving || !active}
              onCheckedChange={setIsDefault}
            />
            <Label htmlFor="template-default" className="font-normal">
              Default — starts automatically when an offer converts
            </Label>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Tasks <span className="font-normal text-muted-foreground">({tasks.length})</span>
            </h3>
            <Button
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={() => setTasks((current) => [...current, blankTask()])}
            >
              <Plus /> Add task
            </Button>
          </div>
          {touched && tasks.length === 0 && (
            <InlineProblem>A checklist needs at least one task.</InlineProblem>
          )}
          <ol className="space-y-3">
            {tasks.map((task, index) => {
              const problems = taskProblems[index];
              const isDesk = DESK_OWNERS.includes(task.owner_type);
              const id = `task-${task.key}`;
              return (
                <li key={task.key} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 w-6 shrink-0 text-right text-xs font-semibold text-muted-foreground tabular-nums">
                      {index + 1}.
                    </span>
                    <div className="grid min-w-0 flex-1 gap-3">
                      <FormField
                        htmlFor={`${id}-title`}
                        label="Task"
                        error={touched ? problems.title : null}
                      >
                        <Input
                          id={`${id}-title`}
                          value={task.title}
                          maxLength={255}
                          disabled={isSaving}
                          aria-invalid={touched && Boolean(problems.title)}
                          onChange={(event) => update(task.key, { title: event.target.value })}
                        />
                      </FormField>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <FormField htmlFor={`${id}-owner`} label="Owner">
                          <Select
                            value={task.owner_type}
                            disabled={isSaving}
                            onValueChange={(value) =>
                              update(task.key, { owner_type: value as OnboardingOwnerType })
                            }
                          >
                            <SelectTrigger id={`${id}-owner`} className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(OWNER_LABELS) as OnboardingOwnerType[]).map((value) => (
                                <SelectItem key={value} value={value}>
                                  {OWNER_LABELS[value]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormField>
                        <FormField
                          htmlFor={`${id}-offset`}
                          label="Due (days from joining)"
                          hint={problems.offset ? undefined : offsetLabel(Number(task.due_offset_days))}
                          error={problems.offset}
                        >
                          <Input
                            id={`${id}-offset`}
                            inputMode="numeric"
                            value={task.due_offset_days}
                            disabled={isSaving}
                            className="tabular-nums"
                            aria-invalid={Boolean(problems.offset)}
                            onChange={(event) =>
                              update(task.key, { due_offset_days: event.target.value })
                            }
                          />
                        </FormField>
                        <FormField htmlFor={`${id}-type`} label="Type">
                          <Select
                            value={task.task_type}
                            disabled={isSaving}
                            onValueChange={(value) =>
                              update(task.key, { task_type: value as OnboardingTaskType })
                            }
                          >
                            <SelectTrigger id={`${id}-type`} className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(TASK_TYPE_LABELS) as OnboardingTaskType[]).map((value) => (
                                <SelectItem key={value} value={value}>
                                  {TASK_TYPE_LABELS[value]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormField>
                        {isDesk && (
                          <FormField
                            htmlFor={`${id}-person`}
                            label="Done by"
                            className="sm:col-span-2"
                          >
                            <Select
                              value={task.owner_user_id}
                              disabled={isSaving}
                              onValueChange={(value) => update(task.key, { owner_user_id: value })}
                            >
                              <SelectTrigger id={`${id}-person`} className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={STARTER}>
                                  Whoever in HR starts the plan
                                </SelectItem>
                                {(owners.data ?? []).map((person) => (
                                  <SelectItem key={person.user_id} value={person.user_id}>
                                    {person.full_name} · {humanizeRole(person.role)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormField>
                        )}
                        {task.task_type === "document_upload" && (
                          <FormField
                            htmlFor={`${id}-document`}
                            label="Filed as"
                            error={touched ? problems.document : null}
                          >
                            <Select
                              value={task.document_type}
                              disabled={isSaving}
                              onValueChange={(value) =>
                                update(task.key, {
                                  document_type: value as OnboardingDocumentType,
                                })
                              }
                            >
                              <SelectTrigger
                                id={`${id}-document`}
                                className="w-full"
                                aria-invalid={touched && Boolean(problems.document)}
                              >
                                <SelectValue placeholder="Vault category" />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(DOCUMENT_TYPE_LABELS) as OnboardingDocumentType[]).map(
                                  (value) => (
                                    <SelectItem key={value} value={value}>
                                      {DOCUMENT_TYPE_LABELS[value]}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                          </FormField>
                        )}
                      </div>
                      <FormField htmlFor={`${id}-description`} label="Instructions" optional>
                        <Textarea
                          id={`${id}-description`}
                          rows={2}
                          maxLength={4000}
                          value={task.description}
                          disabled={isSaving}
                          onChange={(event) =>
                            update(task.key, { description: event.target.value })
                          }
                        />
                      </FormField>
                      <div className="flex items-center gap-3">
                        <Switch
                          id={`${id}-mandatory`}
                          checked={task.is_mandatory}
                          disabled={isSaving}
                          onCheckedChange={(value) => update(task.key, { is_mandatory: value })}
                        />
                        <Label htmlFor={`${id}-mandatory`} className="font-normal">
                          Mandatory — the plan is not complete until this is done or skipped
                        </Label>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Move up"
                        disabled={isSaving || index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Move down"
                        disabled={isSaving || index === tasks.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove task"
                        disabled={isSaving}
                        onClick={() =>
                          setTasks((current) => current.filter((row) => row.key !== task.key))
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {touched && hasProblem && !error && (
          <InlineProblem>Some fields need attention before this can be saved.</InlineProblem>
        )}
        {error && <InlineProblem>{error}</InlineProblem>}
      </div>
      <SheetFooter className="flex-row justify-end border-t border-border">
        <Button variant="outline" disabled={isSaving} onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={isSaving} onClick={() => void save()}>
          {isSaving && <Loader2 className="animate-spin" />}
          {template ? "Save checklist" : "Create checklist"}
        </Button>
      </SheetFooter>
    </>
  );
}
