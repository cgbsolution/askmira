"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import type { ProjectRow } from "@/components/time/TimesheetScreen";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { patch, post } from "@/lib/api";
import type { Department, LegalEntity, ProjectSheetResult, ProjectSheetRow } from "@/lib/types/people";

import { errorDetail } from "./settingsShared";

const NO_COMPANY = "__none";
const CODE = /^[A-Za-z0-9_-]+$/;

/** A code from a name: "DXC INET" -> "DXC-INET". */
function codeFrom(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

// ── Add or edit one project ────────────────────────────────────────────────

/**
 * A project: a client's (DXC INET, JK Paper…) or the company's own (Internal).
 * The code is fixed once made; timesheets and imports refer to it.
 */
export function ProjectDialog({
  open,
  editing,
  entities,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editing: ProjectRow | null;
  entities: LegalEntity[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [client, setClient] = useState("");
  const [kind, setKind] = useState<"client" | "internal">("client");
  const [company, setCompany] = useState(NO_COMPANY);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setCode(editing?.code ?? "");
    setCodeTouched(Boolean(editing));
    setClient(editing?.client ?? "");
    setKind(editing && !editing.billable ? "internal" : "client");
    setCompany(editing?.legal_entity_id ?? (entities.length === 1 ? entities[0].id : NO_COMPANY));
    setActive(editing?.active ?? true);
  }, [open, editing, entities]);

  const nameError = name.trim().length < 2 ? "At least two characters." : null;
  const codeError = !editing && !CODE.test(code.trim()) ? "Letters, digits, - and _ only." : null;
  const invalid = Boolean(nameError || codeError);

  const submit = async () => {
    setBusy(true);
    const body = {
      name: name.trim(),
      client: client.trim() || null,
      billable: kind === "client",
      legal_entity_id: company === NO_COMPANY ? null : company,
    };
    try {
      if (editing) {
        await patch(`/timesheets/projects/${editing.id}`, { ...body, active });
        toast.success("Project updated.");
      } else {
        await post("/timesheets/projects", { ...body, code: code.trim().toUpperCase() });
        toast.success("Project added.");
      }
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the project."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "Add a project"}</DialogTitle>
          <DialogDescription>
            Where people work: a client&apos;s project, or your own internal work. Their company and
            payroll stay as they are; the project is what the directory, reports and the salary
            register group them by.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="project-name" label="Project name" error={name ? nameError : null}>
            <Input
              id="project-name"
              value={name}
              maxLength={160}
              placeholder="DXC INET"
              onChange={(event) => {
                setName(event.target.value);
                if (!codeTouched) setCode(codeFrom(event.target.value));
              }}
            />
          </FormField>
          <FormField
            htmlFor="project-code"
            label="Code"
            error={code ? codeError : null}
            hint={editing ? "Fixed once made." : "Used in imports and timesheets."}
          >
            <Input
              id="project-code"
              value={code}
              maxLength={32}
              disabled={Boolean(editing)}
              className="font-mono uppercase"
              onChange={(event) => {
                setCodeTouched(true);
                setCode(event.target.value.toUpperCase());
              }}
            />
          </FormField>
          <FormField htmlFor="project-kind" label="Type">
            <Select value={kind} onValueChange={(value) => setKind(value as "client" | "internal")}>
              <SelectTrigger id="project-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client project</SelectItem>
                <SelectItem value="internal">Internal (your own staff)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="project-client" label="Client" optional hint="When it is not the project's name.">
            <Input
              id="project-client"
              value={client}
              maxLength={160}
              placeholder="DXC Technology"
              onChange={(event) => setClient(event.target.value)}
            />
          </FormField>
          <FormField
            htmlFor="project-company"
            label="Company that staffs it"
            optional
            className="sm:col-span-2"
          >
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger id="project-company" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COMPANY}>Not set</SelectItem>
                {entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {editing && (
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch id="project-active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="project-active" className="text-sm font-normal">
                Open. A closed project keeps the people already on it, but nobody new can be put on it.
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || invalid}>
            {busy && <Loader2 className="animate-spin" />}
            {editing ? "Save changes" : "Add project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Make projects from departments ─────────────────────────────────────────

/**
 * Departments that stood in for projects ("Internal", "External") become
 * projects of the same name, with their people on them.
 */
export function FromDepartmentsDialog({
  open,
  departments,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  departments: Department[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [clear, setClear] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setChosen(new Set());
      setClear(true);
    }
  }, [open]);

  const toggle = (id: string, on: boolean) =>
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const submit = async () => {
    setBusy(true);
    try {
      const result = await post<{
        projects_created: string[];
        projects_reused: string[];
        moved: number;
        skipped: { employee_code: string; reason: string }[];
      }>("/org/projects/from-departments", {
        department_ids: [...chosen],
        clear_department: clear,
      });
      const made = result.projects_created.length
        ? `Projects added: ${result.projects_created.join(", ")}. `
        : "";
      const message = `${made}${result.moved} ${result.moved === 1 ? "person" : "people"} put on their project.`;
      if (result.skipped.length) {
        toast.warning(message, {
          description: `${result.skipped.length} not moved (their own record, or they have left).`,
        });
      } else {
        toast.success(message);
      }
      onDone();
      onOpenChange(false);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not make the projects."));
    } finally {
      setBusy(false);
    }
  };

  const active = departments.filter((department) => department.is_active);

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Make projects from departments</DialogTitle>
          <DialogDescription>
            Tick the departments that really say where people work (Internal, External, a
            client). Each becomes a project of the same name and its people go onto it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 rounded-xl border border-border p-3">
          {active.length === 0 && <p className="text-sm text-muted-foreground">No departments yet.</p>}
          {active.map((department) => (
            <div key={department.id} className="flex items-center gap-3">
              <Checkbox
                id={`dept-${department.id}`}
                checked={chosen.has(department.id)}
                onCheckedChange={(value) => toggle(department.id, value === true)}
              />
              <Label htmlFor={`dept-${department.id}`} className="text-sm font-normal">
                {department.name}{" "}
                <span className="ml-1 font-mono text-xs text-muted-foreground">{department.code}</span>
              </Label>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-3">
          <Checkbox id="dept-clear" checked={clear} onCheckedChange={(value) => setClear(value === true)} />
          <Label htmlFor="dept-clear" className="text-sm leading-snug font-normal">
            Take these departments off their records. Approval rules or sub-admin access tied to
            these departments stop matching them; you can close the departments afterwards.
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || chosen.size === 0}>
            {busy && <Loader2 className="animate-spin" />}
            Make {chosen.size || ""} {chosen.size === 1 ? "project" : "projects"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Put everybody on their project from a sheet ────────────────────────────

const OUTCOME: Record<ProjectSheetRow["outcome"], { label: string; variant: "success" | "muted" | "warning" | "destructive" | "secondary" }> = {
  assign: { label: "Will move", variant: "success" },
  unchanged: { label: "Already there", variant: "muted" },
  blank: { label: "No project", variant: "muted" },
  unknown: { label: "Not found", variant: "destructive" },
  skipped: { label: "Not moved", variant: "warning" },
  duplicate: { label: "Listed twice", variant: "warning" },
};

/**
 * Upload the old HRMS's salary register (or any sheet with Emp Code and
 * Project): check what it would do, then apply it.
 */
export function AssignFromSheetDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ProjectSheetResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setFile(null);
      setResult(null);
    }
  }, [open]);

  const send = async (apply: boolean) => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("apply", apply ? "true" : "false");
      const answer = await post<ProjectSheetResult>("/org/projects/assign-from-sheet", form);
      if (apply) {
        const made = answer.projects_created.length
          ? ` Projects added: ${answer.projects_created.join(", ")}.`
          : "";
        toast.success(`${answer.moved} ${answer.moved === 1 ? "person" : "people"} put on their project.${made}`);
        onDone();
        onOpenChange(false);
      } else {
        setResult(answer);
      }
    } catch (caught) {
      toast.error(errorDetail(caught, "The sheet could not be read."));
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<ProjectSheetRow>[] = [
    { accessorKey: "line", header: "Row", meta: { cellClassName: "tabular-nums text-muted-foreground" } },
    {
      id: "person",
      header: "Employee",
      accessorFn: (row) => `${row.employee_code} ${row.name ?? ""}`,
      cell: ({ row }) => (
        <>
          <div className="font-medium text-foreground">{row.original.name ?? "—"}</div>
          <div className="font-mono text-xs text-muted-foreground">{row.original.employee_code}</div>
        </>
      ),
    },
    { id: "project", header: "Project", accessorFn: (row) => row.project ?? "—" },
    {
      id: "outcome",
      header: "What happens",
      accessorFn: (row) => `${OUTCOME[row.outcome].label}${row.note ? ` — ${row.note}` : ""}`,
      cell: ({ row }) => (
        <div className="grid gap-0.5">
          <Badge variant={OUTCOME[row.original.outcome].variant}>{OUTCOME[row.original.outcome].label}</Badge>
          {row.original.note && <span className="text-xs text-muted-foreground">{row.original.note}</span>}
        </div>
      ),
    },
  ];

  const moving = result?.counts.assign ?? 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Put people on projects from a sheet</DialogTitle>
          <DialogDescription>
            Your old HRMS&apos;s salary register works as it is: it needs an Emp Code column and a
            Project column. Check first; nothing changes until you apply.
          </DialogDescription>
        </DialogHeader>

        <FormField htmlFor="project-sheet" label="Excel or CSV file">
          <FileInput
            id="project-sheet"
            accept=".xlsx,.csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
        </FormField>

        {result && (
          <>
            <Alert>
              <AlertTitle>
                {moving} {moving === 1 ? "person moves" : "people move"}
                {result.counts.unchanged ? `, ${result.counts.unchanged} already on theirs` : ""}
              </AlertTitle>
              <AlertDescription className="grid gap-1">
                <span>Headings found on row {result.header_row}.</span>
                {result.new_projects.length > 0 && (
                  <span>
                    New projects, added on apply:{" "}
                    <span className="font-medium text-foreground">{result.new_projects.join(", ")}</span>
                  </span>
                )}
                {(result.counts.unknown ?? 0) > 0 && (
                  <span>{result.counts.unknown} codes are not employees here and are left out.</span>
                )}
              </AlertDescription>
            </Alert>
            <DataTable
              columns={columns}
              data={result.rows}
              noun="rows"
              exportName={false}
              selectable={false}
              searchPlaceholder="Search the sheet"
              pageSize={10}
            />
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {result ? (
            <Button onClick={() => void send(true)} disabled={busy || moving === 0}>
              {busy && <Loader2 className="animate-spin" />}
              Apply: move {moving}
            </Button>
          ) : (
            <Button onClick={() => void send(false)} disabled={busy || !file}>
              {busy && <Loader2 className="animate-spin" />}
              Check the sheet
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
