"use client";

import { Eye, Loader2, Plus, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { LETTER_CATEGORY } from "@/components/docs/letterLabels";
import { PdfPreview } from "@/components/docs/PdfPreview";
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
import { downloadFile, fetchFile, post } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  BulkLetterJob,
  IssuedLetter,
  LetterPrefill,
  LetterTemplate,
} from "@/lib/types/docs";
import { DatePicker } from "@/components/common/DatePicker";

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
  const [prefilled, setPrefilled] = useState<Record<string, string>>({});
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const typed = useRef<Set<string>>(new Set());

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
    setPrefilled({});
    setPdf(null);
    typed.current = new Set();
  }, [open]);

  const template = templates.find((t) => t.id === templateId);
  const manualFields = useMemo(
    () => (template?.fields ?? []).filter((f) => f.source === "manual"),
    [template],
  );
  const person = mode === "single" ? (people[0] ?? null) : null;

  // One person and a template: start each typed field from their record
  // (notice period in words, current designation) and the date the letter's
  // values resolve on. What HR has already typed is left alone.
  useEffect(() => {
    setPdf(null);
    if (!template || !person) {
      setPrefilled({});
      return;
    }
    let cancelled = false;
    setIsPrefilling(true);
    post<LetterPrefill>(`/letter-templates/${template.id}/prefill`, { employee_id: person.id })
      .then((result) => {
        if (cancelled) return;
        setPrefilled(result.values);
        setManual((current) => {
          const next = { ...current };
          for (const [key, value] of Object.entries(result.values)) {
            if (!typed.current.has(key)) next[key] = value;
          }
          return next;
        });
        setAsOf((current) => current || result.as_of);
      })
      .catch(() => {
        if (!cancelled) setPrefilled({});
      })
      .finally(() => {
        if (!cancelled) setIsPrefilling(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id, person?.id]);

  const preview = async () => {
    setServerError(null);
    if (!template) return setServerError("Choose a template.");
    if (!person) return setServerError("Choose who the letter is for.");
    setIsPreviewing(true);
    try {
      const { blob } = await fetchFile("/letter-templates/preview-pdf", {
        method: "POST",
        body: {
          template_id: template.id,
          employee_id: person.id,
          manual_values: Object.fromEntries(
            Object.entries(manual).filter(([, value]) => value.trim() !== ""),
          ),
          as_of: asOf || null,
        },
        timeout: 60_000,
      });
      setPdf(blob);
    } catch (error) {
      setServerError(apiMessage(error, "The preview could not be rendered."));
    } finally {
      setIsPreviewing(false);
    }
  };

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
    // In bulk, a typed field that starts from the record is filled in per person.
    const missing = manualFields.filter(
      (f) =>
        f.required &&
        !(mode === "bulk" && f.source_path) &&
        !manual[f.token.split(".").pop() ?? ""]?.trim(),
    );
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
        toast.success(`Letter ${letter.reference_number} issued`, {
          action: {
            label: "Download PDF",
            onClick: () =>
              void downloadFile(`/letters/${letter.id}/pdf`, `${letter.reference_number}.pdf`).catch(
                (error) => toast.error(apiMessage(error, "The PDF could not be downloaded.")),
              ),
          },
        });
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
      <DialogContent className={cn("max-h-[92vh] overflow-y-auto", pdf ? "sm:max-w-4xl" : "sm:max-w-xl")}>
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
                    setAsOf("");
                    typed.current = new Set();
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
                  onChange={(next) => {
                    if (mode === "single") {
                      setAsOf("");
                      typed.current = new Set();
                      setManual({});
                    }
                    addPerson(next);
                  }}
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
                const fromRecord = prefilled[key];
                const hint =
                  mode === "bulk" && field.source_path
                    ? "Leave blank to fill it in from each person's record."
                    : fromRecord !== undefined
                      ? manual[key] === fromRecord
                        ? "Filled in from the record. Change it if this letter needs something else."
                        : `The record says \u201c${fromRecord}\u201d.`
                      : undefined;
                return (
                  <FormField
                    key={field.token}
                    htmlFor={`manual-${key}`}
                    label={field.label}
                    optional={!field.required || (mode === "bulk" && Boolean(field.source_path))}
                    hint={hint}
                  >
                    <Input
                      id={`manual-${key}`}
                      value={manual[key] ?? ""}
                      maxLength={500}
                      disabled={isPrefilling && fromRecord === undefined && Boolean(field.source_path)}
                      onChange={(event) => {
                        typed.current.add(key);
                        setPdf(null);
                        setManual((current) => ({ ...current, [key]: event.target.value }));
                      }}
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
                <DatePicker
                  id="issue-asof"
                  value={asOf}
                  onChange={(value) => {
                    setAsOf(value);
                    setPdf(null);
                  }}
                />
              </FormField>
              {mode === "single" && (pdf || isPreviewing) && (
                <PdfPreview blob={pdf} isLoading={isPreviewing} title="Letter preview" className="h-[65vh]" />
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                {mode === "single" && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSaving || isPreviewing || !template || !person}
                    onClick={() => void preview()}
                  >
                    {isPreviewing ? <Loader2 className="animate-spin" /> : <Eye />}
                    Preview
                  </Button>
                )}
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
