"use client";

import { Download, Loader2, Search, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { IconInput } from "@/components/common/IconInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, downloadFile } from "@/lib/api";
import type { ExportCatalogue, ExportSection } from "@/lib/types/people";
import { cn } from "@/lib/utils";

type FileType = "xlsx" | "csv";

/** What this browser remembers: the columns taken out, so a new custom field is still in. */
const MEMORY_KEY = "askmira.employee-export";
const IDENTIFIERS = new Set(["pan", "aadhaar", "account_number"]);

type Remembered = { removed: string[]; fileType: FileType };

function recall(): Remembered | null {
  try {
    const raw = window.localStorage.getItem(MEMORY_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Remembered>;
    return {
      removed: Array.isArray(value.removed) ? value.removed.filter((k) => typeof k === "string") : [],
      fileType: value.fileType === "csv" ? "csv" : "xlsx",
    };
  } catch {
    return null;
  }
}

function remember(value: Remembered) {
  try {
    window.localStorage.setItem(MEMORY_KEY, JSON.stringify(value));
  } catch {
    // Private window or blocked storage: the choice is simply not kept.
  }
}

/**
 * People → Employees → Export.
 *
 * Every column of the employee record is ticked to start with; HR takes out
 * what they do not want, a section at a time or one column at a time. Lists
 * (family, education…) come out as numbered column sets. The file is built on
 * the server, so the ticked people or the filtered list are exported whole,
 * not just the page on screen.
 */
export function ExportEmployeesDialog({
  open,
  onOpenChange,
  people,
  count,
  filters,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The ticked people's ids; null exports everyone the filters match. */
  people: string[] | null;
  /** How many people the file will hold. */
  count: number;
  /** The directory's filters, sent when nobody is ticked. */
  filters: Record<string, string | boolean>;
  /** Who is being exported, in words ("everyone matching your filters"). */
  description: string;
}) {
  const catalogue = useApiQuery<ExportCatalogue>(open ? "/employees/export/columns" : null);
  const sections = useMemo(() => catalogue.data?.sections ?? [], [catalogue.data]);
  const allKeys = useMemo(() => sections.flatMap((s) => s.columns.map((c) => c.key)), [sections]);

  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [fileType, setFileType] = useState<FileType>("xlsx");
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);

  // Each time it opens: every column, less those this browser was told to leave out.
  // The columns arriving again while it is open (the same list) change nothing ticked.
  const applied = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      applied.current = null;
      return;
    }
    const signature = allKeys.join(",");
    if (allKeys.length === 0 || applied.current === signature) return;
    applied.current = signature;
    const kept = recall();
    const removed = new Set(kept?.removed ?? []);
    const next = new Set(allKeys.filter((key) => !removed.has(key)));
    setChosen(next.size > 0 ? next : new Set(allKeys));
    setRestored(next.size > 0 && next.size < allKeys.length);
    setFileType(kept?.fileType ?? "xlsx");
    setTerm("");
  }, [open, allKeys]);

  const needle = term.trim().toLowerCase();
  const visible = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          columns: needle
            ? section.columns.filter(
                (c) => c.label.toLowerCase().includes(needle) || section.label.toLowerCase().includes(needle),
              )
            : section.columns,
        }))
        .filter((section) => section.columns.length > 0),
    [sections, needle],
  );

  const toggle = (keys: string[], on: boolean) =>
    setChosen((previous) => {
      const next = new Set(previous);
      keys.forEach((key) => (on ? next.add(key) : next.delete(key)));
      return next;
    });

  const picked = allKeys.filter((key) => chosen.has(key)).length;
  const withIdentifiers = [...IDENTIFIERS].some((key) => chosen.has(key));

  const download = async () => {
    if (picked === 0) return;
    setBusy(true);
    try {
      const everything = picked === allKeys.length;
      const body: Record<string, unknown> = {
        file_type: fileType,
        columns: everything ? undefined : allKeys.filter((key) => chosen.has(key)),
        // Ticked people are exported as ticked, whatever the filters now say.
        ...(people ? { employee_ids: people } : filters),
      };
      await downloadFile("/employees/export", `employees.${fileType}`, {
        method: "POST",
        body,
        timeout: 180_000,
      });
      remember({ removed: allKeys.filter((key) => !chosen.has(key)), fileType });
      toast.success(`Exported ${count} ${count === 1 ? "person" : "people"}, ${picked} columns.`);
      onOpenChange(false);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The employee data could not be exported.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-4 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Export employee data</DialogTitle>
          <DialogDescription>
            {count} {count === 1 ? "person" : "people"}: {description}. Untick the columns you do not want in the
            file{restored ? "; your last choice is ticked" : ""}.
          </DialogDescription>
        </DialogHeader>

        {catalogue.error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {catalogue.error.detail}
              <Button size="sm" variant="outline" onClick={catalogue.reload}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : !catalogue.data ? (
          <div className="grid gap-3" aria-busy="true" aria-label="Loading the columns">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-[12rem_1fr] sm:items-end">
              <FormField htmlFor="export-file-type" label="File type">
                <Select value={fileType} onValueChange={(v) => setFileType(v as FileType)}>
                  <SelectTrigger id="export-file-type" className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                    <SelectItem value="csv">CSV (.csv)</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <IconInput
                icon={Search}
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Find a column"
                aria-label="Find a column"
                className="h-9"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                <span className="font-medium text-foreground">{picked}</span> of {allKeys.length} columns
                ticked
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setChosen(new Set(allKeys))}>
                  Select all
                </Button>
                <Button size="sm" variant="outline" onClick={() => setChosen(new Set())}>
                  Clear all
                </Button>
              </div>
            </div>

            <ScrollArea className="max-h-[min(50vh,32rem)] rounded-lg border">
              <div className="grid gap-3 p-3">
                {visible.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No column matches “{term}”.</p>
                ) : (
                  visible.map((section) => (
                    <SectionPicker key={section.key} section={section} chosen={chosen} onToggle={toggle} />
                  ))
                )}
              </div>
            </ScrollArea>

            {withIdentifiers && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                PAN, Aadhaar and bank account numbers are written in full. Keep the file safe; the download is
                recorded in the audit log.
              </p>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void download()} disabled={busy || !catalogue.data || picked === 0}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            {picked === 0 ? "Tick at least one column" : `Download ${fileType === "xlsx" ? "Excel" : "CSV"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One section: a tick for all its columns, then a tick per column. */
function SectionPicker({
  section,
  chosen,
  onToggle,
}: {
  section: ExportSection;
  chosen: Set<string>;
  onToggle: (keys: string[], on: boolean) => void;
}) {
  const keys = section.columns.map((c) => c.key);
  const ticked = keys.filter((key) => chosen.has(key)).length;
  const state = ticked === 0 ? false : ticked === keys.length ? true : "indeterminate";
  const id = `export-section-${section.key}`;
  return (
    <FieldSet className="rounded-lg border bg-card p-3">
      <FieldLegend className="sr-only">{section.label}</FieldLegend>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <Checkbox id={id} checked={state} onCheckedChange={(next) => onToggle(keys, next === true)} />
          <Label htmlFor={id} className="cursor-pointer text-sm font-semibold">
            {section.label}
          </Label>
        </div>
        <span className="text-xs text-muted-foreground">
          {ticked}/{keys.length}
          {section.repeats && section.entry
            ? ` · columns repeat for each ${section.entry.toLowerCase()} (${section.entry} 1, ${section.entry} 2…)`
            : ""}
        </span>
      </div>
      <div className="grid gap-x-4 gap-y-2 pl-6 sm:grid-cols-2 lg:grid-cols-3">
        {section.columns.map((column) => {
          const columnId = `export-column-${column.key}`;
          return (
            <div key={column.key} className="flex items-center gap-2">
              <Checkbox
                id={columnId}
                checked={chosen.has(column.key)}
                onCheckedChange={(next) => onToggle([column.key], next === true)}
              />
              <Label
                htmlFor={columnId}
                className={cn(
                  "cursor-pointer leading-snug font-normal",
                  !chosen.has(column.key) && "text-muted-foreground",
                )}
              >
                {column.label}
              </Label>
            </div>
          );
        })}
      </div>
    </FieldSet>
  );
}
