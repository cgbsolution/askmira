"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { personName } from "@/components/people/labels";
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
import type { DirectoryEmployee, EntityMoveResult, LegalEntity } from "@/lib/types/people";

/**
 * People → Employees, a selection → Move to company.
 *
 * Puts the ticked people in one legal entity in one go: the company whose
 * payroll run pays them, whose registration numbers their returns are filed
 * under, and whose logo they see. Each move is in their history as a transfer.
 */
export function MoveToCompanyDialog({
  open,
  people,
  entities,
  onOpenChange,
  onMoved,
}: {
  open: boolean;
  people: DirectoryEmployee[];
  entities: LegalEntity[];
  onOpenChange: (open: boolean) => void;
  onMoved: (result: EntityMoveResult) => void;
}) {
  const { user } = useAuth();
  const [entityId, setEntityId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setEntityId("");
  }, [open]);

  const active = entities.filter((entity) => entity.is_active);
  const target = active.find((entity) => entity.id === entityId);
  // Counted in the order the server decides: your own record first, then
  // people who have left, then those already in the company.
  const includesSelf = Boolean(user?.employee_id && people.some((p) => p.id === user.employee_id));
  const others = people.filter((p) => p.id !== user?.employee_id);
  const leavers = others.filter((p) => p.status === "exited").length;
  const staying = others.filter((p) => p.status !== "exited");
  const alreadyThere = target ? staying.filter((p) => p.legal_entity_id === target.id).length : 0;
  const toMove = staying.length - alreadyThere;
  const month = new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const result = await patch<EntityMoveResult>("/employees/bulk/legal-entity", {
        employee_ids: people.map((person) => person.id),
        legal_entity_id: target.id,
      });
      const parts = [`${result.moved} moved to ${result.legal_entity_name}`];
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
            Move {people.length} {people.length === 1 ? "person" : "people"} to a company
          </DialogTitle>
          <DialogDescription>
            {names}
            {people.length > 3 ? ` and ${people.length - 3} more` : ""}. Their company changes
            today. A month is paid by the company somebody belongs to on its last day, so the new
            company&apos;s payroll pays all of {month} and after, and files their PF, ESI and TDS
            for those months; earlier months stay with the old one. They see its logo after signing
            in.
          </DialogDescription>
        </DialogHeader>

        <FormField htmlFor="move-company" label="Company">
          <Select value={entityId} onValueChange={setEntityId}>
            <SelectTrigger id="move-company" className="w-full">
              <SelectValue placeholder="Choose a company" />
            </SelectTrigger>
            <SelectContent>
              {active.map((entity) => (
                <SelectItem key={entity.id} value={entity.id}>
                  {entity.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {(leavers > 0 || includesSelf || (target && alreadyThere > 0)) && (
          <Alert>
            <AlertDescription>
              {[
                target &&
                  alreadyThere > 0 &&
                  `${alreadyThere} already ${alreadyThere === 1 ? "is" : "are"} in ${target.name}.`,
                leavers > 0 &&
                  `${leavers} ${leavers === 1 ? "has" : "have"} left and ${leavers === 1 ? "is" : "are"} not moved: their past payroll and returns stay with the company that paid them.`,
                includesSelf && "Your own record is left as it is: somebody else in HR changes it.",
              ]
                .filter(Boolean)
                .join(" ")}
            </AlertDescription>
          </Alert>
        )}
        <p className="text-xs text-muted-foreground">
          A month another company&apos;s approved payroll already paid is never paid again. For a
          move on a later date, raise a Transfer under Employees → Lifecycle events, dated the 1st
          of a month.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !target || toMove <= 0}>
            {busy && <Loader2 className="animate-spin" />}
            {target ? `Move ${Math.max(toMove, 0)} to ${target.name}` : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
