"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import type { ProjectRow } from "@/components/time/TimesheetScreen";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { patch, post } from "@/lib/api";
import type { Department, LegalEntity } from "@/lib/types/people";

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

// ── Departments that are really projects ───────────────────────────────────

/** Departments named like where people work rather than what they do. */
const PROJECT_LIKE = /\b(internal|external|client|project|onsite|deput)/i;

/**
 * The departments that look like projects: named Internal / External / a
 * client, or sharing a name or code with a project already made.
 */
export function projectLikeDepartments(departments: Department[], projects: ProjectRow[]): Department[] {
  const known = new Set(projects.flatMap((project) => [project.name.toLowerCase(), project.code.toLowerCase()]));
  return departments.filter(
    (department) =>
      PROJECT_LIKE.test(department.name) ||
      PROJECT_LIKE.test(department.code) ||
      known.has(department.name.toLowerCase()) ||
      known.has(department.code.toLowerCase()),
  );
}

interface FromDepartmentsResult {
  projects_created: string[];
  projects_reused: string[];
  moved: number;
  leavers_moved: number;
  unchanged: number;
  departments_deleted: string[];
  departments_closed: { name: string; reasons: string[] }[];
}

/**
 * Departments that stood in for projects ("Internal", "External") move to
 * Projects: each becomes a project of the same name, everybody in it goes onto
 * it, and the department is removed. Departments are for HR, IT, Finance.
 */
export function FromDepartmentsDialog({
  open,
  departments,
  preselected,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  departments: Department[];
  /** Ticked when the dialog opens: the departments that look like projects. */
  preselected?: string[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setChosen(new Set(preselected ?? []));
    // Only when it opens: the ticks are the user's from then on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const result = await post<FromDepartmentsResult>("/org/projects/from-departments", {
        department_ids: [...chosen],
      });
      const parts: string[] = [];
      if (result.projects_created.length) parts.push(`Projects added: ${result.projects_created.join(", ")}.`);
      if (result.moved) {
        parts.push(`${result.moved} ${result.moved === 1 ? "person" : "people"} moved to their project.`);
      }
      if (result.leavers_moved) {
        parts.push(
          `${result.leavers_moved} ${result.leavers_moved === 1 ? "person who has left was" : "people who have left were"} moved too.`,
        );
      }
      if (!result.moved && !result.leavers_moved) parts.push("Everyone was already on their project.");
      if (result.departments_deleted.length) {
        parts.push(`Removed from Departments: ${result.departments_deleted.join(", ")}.`);
      }
      if (result.departments_closed.length) {
        toast.warning(parts.join(" "), {
          description: result.departments_closed
            .map((row) => `${row.name} was closed, not deleted: ${row.reasons.join("; ")}.`)
            .join(" "),
        });
      } else {
        toast.success(parts.join(" "));
      }
      onDone();
      onOpenChange(false);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not move the departments to Projects."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Move departments to Projects</DialogTitle>
          <DialogDescription>
            Tick the departments that are really projects (Internal, External, a client). Each
            becomes a project of the same name, everybody in it goes onto that project, and the
            department is removed. Departments are for functions like HR, IT and Finance.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 rounded-xl border border-border p-3">
          {departments.length === 0 && <p className="text-sm text-muted-foreground">No departments yet.</p>}
          {departments.map((department) => (
            <div key={department.id} className="flex items-center gap-3">
              <Checkbox
                id={`dept-${department.id}`}
                checked={chosen.has(department.id)}
                onCheckedChange={(value) => toggle(department.id, value === true)}
              />
              <Label htmlFor={`dept-${department.id}`} className="text-sm font-normal">
                {department.name}{" "}
                <span className="ml-1 font-mono text-xs text-muted-foreground">{department.code}</span>
                {!department.is_active && <span className="ml-1 text-xs text-muted-foreground">(closed)</span>}
              </Label>
            </div>
          ))}
        </div>

        <Alert>
          <AlertDescription>
            Each person&apos;s project change goes in their history, dated today; people who have
            left move too. They will have no department until you set their real one (HR, IT,
            Finance…). A department something else still uses — a position, a budget, an approval
            rule — is closed instead of deleted, and you are told why.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || chosen.size === 0}>
            {busy && <Loader2 className="animate-spin" />}
            Move {chosen.size || ""} to Projects
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
