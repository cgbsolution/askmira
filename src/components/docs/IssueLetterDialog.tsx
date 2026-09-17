"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { LETTER_CATEGORY } from "@/components/docs/letterLabels";
import { EmployeePicker, type PickedEmployee } from "@/components/people/EmployeePicker";
import { apiMessage } from "@/components/people/labels";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { post } from "@/lib/api";
import type { BulkLetterJob, IssuedLetter, LetterTemplate } from "@/lib/types/docs";

type Mode = "single" | "bulk";

/**
 * Issue a letter to one person, or the same template to many.
 *
 * The template's manual fields are asked for here, because issuance refuses a
 * letter with a hole in it. Bulk reports every person's outcome.
 */
export function IssueLetterDialog({
  open,
  onOpenChange,
  templates,
  onIssued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: LetterTemplate[];
  onIssued: () => void;
}) {
  const [mode, setMode] = useState<Mode>("single");
  const [templateId, setTemplateId] = useState("");
  const [people, setPeople] = useState<PickedEmployee[]>([]);
  const [picking, setPicking] = useState<PickedEmployee | null>(null);
  const [manual, setManual] = useState<Record<string, string>>({});
  const [asOf, setAsOf] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [job, setJob] = useState<BulkLetterJob | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("single");
    setTemplateId("");
    setPeople([]);
    setPicking(null);
    setManual({});
    setAsOf("");
    setServerError(null);
    setJob(null);
  }, [open]);

  const template = templates.find((t) => t.id === templateId);
  const manualFields = useMemo(
    () => (template?.fields ?? []).filter((f) => f.source === "manual"),
    [template],
  );

  const addPerson = (person: PickedEmployee | null) => {
    if (!person) return;
    if (mode === "single") {
      setPeople([person]);
    } else if (!people.some((p) => p.id === person.id)) {
      setPeople((current) => [...current, person]);
    }
    setPicking(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);
    if (!template) return setServerError("Choose a template.");
    if (people.length === 0) return setServerError("Choose who the letter is for.");
    const missing = manualFields.filter((f) => f.required && !manual[f.token.split(".").pop() ?? ""]?.trim());
    if (missing.length) {
      return setServerError(`Fill in: ${missing.map((f) => f.label).join(", ")}.`);
    }
    const manualValues = Object.fromEntries(
      Object.entries(manual).filter(([, value]) => value.trim() !== ""),
    );

    setIsSaving(true);
    try {
      if (mode === "single") {
        const letter = await post<IssuedLetter>("/letters/issue", {
          employee_id: people[0].id,
          template_id: template.id,
          manual_values: manualValues,
          as_of: asOf || null,
        });
        toast.success(`Letter ${letter.reference_number} issued`);
        onIssued();
        onOpenChange(false);
      } else {
        const result = await post<BulkLetterJob>(
          "/letters/issue-bulk",
          {
            employee_ids: people.map((p) => p.id),
            template_id: template.id,
            manual_values: manualValues,
            as_of: asOf || null,
          },
          { timeout: 300_000 },
        );
        setJob(result);
        onIssued();
      }
    } catch (error) {
      setServerError(apiMessage(error, "The letter could not be issued."));
    } finally {
      setIsSaving(false);
    }
  };

  const names = new Map(people.map((p) => [p.id, p.label]));

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Issue a letter</DialogTitle>
            <DialogDescription>
              Each letter gets its own reference number and a fixed copy of its content.
            </DialogDescription>
          </DialogHeader>

          {job ? (
            <div className="grid gap-3">
              <Alert variant={job.failed ? "warning" : "success"}>
                <AlertDescription>
                  {job.succeeded} issued, {job.failed} failed, of {job.total}.
                </AlertDescription>
              </Alert>
              <ul className="grid max-h-72 gap-1 overflow-y-auto text-sm">
                {job.results.map((row) => (
                  <li key={row.employee_id} className="flex items-start justify-between gap-3">
                    <span className="truncate">{names.get(row.employee_id) ?? row.employee_id}</span>
                    {row.error ? (
                      <span className="text-right text-destructive">{row.error}</span>
                    ) : (
                      <Badge variant="success">{row.reference_number}</Badge>
                    )}
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <Button type="button" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <Tabs
                value={mode}
                onValueChange={(value) => {
                  setMode(value as Mode);
                  setPeople([]);
                }}
              >
                <TabsList>
                  <TabsTrigger value="single">One person</TabsTrigger>
                  <TabsTrigger value="bulk">Many people</TabsTrigger>
                </TabsList>
              </Tabs>
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}
              <FormField htmlFor="issue-template" label="Template">
                <Select
                  value={templateId}
                  onValueChange={(value) => {
                    setTemplateId(value);
                    setManual({});
                  }}
                >
                  <SelectTrigger id="issue-template" className="w-full">
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} · {LETTER_CATEGORY[t.category]} · v{t.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              {template?.requires_approval && (
                <p className="text-xs text-muted-foreground">
                  Letters from this template wait for an admin&apos;s approval before they can be sent.
                </p>
              )}
              <FormField
                htmlFor="issue-person"
                label={mode === "single" ? "Employee" : `Employees (${people.length})`}
              >
                <EmployeePicker
                  id="issue-person"
                  value={mode === "single" ? (people[0] ?? null) : picking}
                  onChange={addPerson}
                  placeholder={mode === "single" ? "Choose a person" : "Add a person"}
                />
              </FormField>
              {mode === "bulk" && people.length > 0 && (
                <ul className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                  {people.map((p) => (
                    <li key={p.id}>
                      <Badge variant="outline" className="gap-1 pr-0.5">
                        {p.label}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-5"
                          aria-label={`Remove ${p.label}`}
                          onClick={() => setPeople((current) => current.filter((x) => x.id !== p.id))}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              {manualFields.map((field) => {
                const key = field.token.split(".").pop() ?? field.token;
                return (
                  <FormField
                    key={field.token}
                    htmlFor={`manual-${key}`}
                    label={field.label}
                    optional={!field.required}
                  >
                    <Input
                      id={`manual-${key}`}
                      value={manual[key] ?? ""}
                      onChange={(event) =>
                        setManual((current) => ({ ...current, [key]: event.target.value }))
                      }
                    />
                  </FormField>
                );
              })}
              <FormField
                htmlFor="issue-asof"
                label="Values as of"
                optional
                hint="A relieving letter for a past exit should show the salary in force then."
              >
                <Input id="issue-asof" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
              </FormField>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="accent" disabled={isSaving}>
                  {isSaving ? <Loader2 className="animate-spin" /> : <Plus />}
                  {mode === "single" ? "Issue letter" : `Issue ${people.length} letters`}
                </Button>
              </DialogFooter>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
