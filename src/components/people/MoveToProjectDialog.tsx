"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { personName } from "@/components/people/labels";
import type { ProjectRow } from "@/components/time/TimesheetScreen";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { ApiError, patch } from "@/lib/api";
import type { DirectoryEmployee, ProjectMoveResult } from "@/lib/types/people";

/** The choice for taking people off every project. */
const NO_PROJECT = "__none";

/**
 * People → Employees, a selection → Move to project.
 *
 * Puts the ticked people on one project (a client's, or Internal) — or on none.
 * Their company and payroll do not change. Each move is in their history as a
 * project change; their own record and people who have left are not moved.
 */
export function MoveToProjectDialog({
  open,
  people,
  projects,
  onOpenChange,
  onMoved,
}: {
  open: boolean;
  people: DirectoryEmployee[];
  projects: ProjectRow[];
  onOpenChange: (open: boolean) => void;
  onMoved: (result: ProjectMoveResult) => void;
}) {
  const { user } = useAuth();
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setProjectId("");
  }, [open]);

  const open_projects = projects.filter((project) => project.active);
  const chosen = projectId === "" ? undefined : projectId === NO_PROJECT ? null : projectId;
  const target = open_projects.find((project) => project.id === projectId);
  // Counted in the order the server decides: leavers, your own record, those already there.
  const includesSelf = Boolean(user?.employee_id && people.some((p) => p.id === user.employee_id));
  const others = people.filter((p) => p.id !== user?.employee_id);
  const leavers = others.filter((p) => p.status === "exited").length;
  const staying = others.filter((p) => p.status !== "exited");
  const alreadyThere =
    chosen === undefined ? 0 : staying.filter((p) => (p.project_id ?? null) === chosen).length;
  const toMove = staying.length - alreadyThere;
  const label = chosen === null ? "no project" : (target?.name ?? "");

  const submit = async () => {
    if (chosen === undefined) return;
    setBusy(true);
    try {
      const result = await patch<ProjectMoveResult>("/employees/bulk/project", {
        employee_ids: people.map((person) => person.id),
        project_id: chosen,
      });
      const where = result.project_name ?? "no project";
      const parts = [`${result.moved} moved to ${where}`];
      if (result.already_there) parts.push(`${result.already_there} already there`);
      if (result.skipped.length) parts.push(`${result.skipped.length} not moved`);
      if (result.skipped.length) {
        toast.warning(parts.join(", ") + ".", {
          description: result.skipped
            .slice(0, 3)
            .map((row) => `${row.employee_code ?? row.name ?? "Someone"}: ${row.reason}`)
            .join(" "),
        });
      } else {
        toast.success(parts.join(", ") + ".");
      }
      onMoved(result);
      onOpenChange(false);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The people could not be moved.");
    } finally {
      setBusy(false);
    }
  };

  const names = people.slice(0, 3).map(personName).join(", ");

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Move {people.length} {people.length === 1 ? "person" : "people"} to a project
          </DialogTitle>
          <DialogDescription>
            {names}
            {people.length > 3 ? ` and ${people.length - 3} more` : ""}. Their project changes
            today; their company and payroll stay as they are.
          </DialogDescription>
        </DialogHeader>

        <FormField htmlFor="move-project" label="Project">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger id="move-project" className="w-full">
              <SelectValue placeholder="Choose a project" />
            </SelectTrigger>
            <SelectContent>
              {open_projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                  {project.billable || /internal/i.test(project.name) ? "" : " (Internal)"}
                </SelectItem>
              ))}
              <SelectItem value={NO_PROJECT}>No project</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        {(leavers > 0 || includesSelf || (chosen !== undefined && alreadyThere > 0)) && (
          <Alert>
            <AlertDescription>
              {[
                chosen !== undefined &&
                  alreadyThere > 0 &&
                  `${alreadyThere} already ${alreadyThere === 1 ? "is" : "are"} on ${label}.`,
                leavers > 0 &&
                  `${leavers} ${leavers === 1 ? "has" : "have"} left and ${leavers === 1 ? "is" : "are"} not moved.`,
                includesSelf && "Your own record is left as it is: somebody else in HR changes it.",
              ]
                .filter(Boolean)
                .join(" ")}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || chosen === undefined || toMove <= 0}>
            {busy && <Loader2 className="animate-spin" />}
            {chosen === undefined ? "Move" : `Move ${Math.max(toMove, 0)} to ${label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
