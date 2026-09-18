"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { EmployeePicker, type PickedEmployee } from "@/components/people/EmployeePicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { post } from "@/lib/api";
import type { AwardCycle } from "@/lib/types/culture";

import { apiDetail } from "../cultureShared";

const MIN_CITATION = 10;

/** Nominate somebody, with the case for it. */
export function NominateDialog({
  cycle,
  onOpenChange,
  onDone,
}: {
  cycle: AwardCycle | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [nominee, setNominee] = useState<PickedEmployee | null>(null);
  const [category, setCategory] = useState("");
  const [citation, setCitation] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!cycle) return;
    setNominee(null);
    setCategory(cycle.categories[0]?.key ?? "");
    setCitation("");
  }, [cycle]);

  const submit = async () => {
    if (!cycle || !nominee) return;
    setIsBusy(true);
    try {
      await post("/culture/nominations", {
        cycle_id: cycle.id,
        category_key: category,
        nominee_employee_id: nominee.id,
        citation: citation.trim(),
      });
      toast.success(`${nominee.label} nominated. The jury will not see that it was you.`);
      onDone();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not submit the nomination."));
    } finally {
      setIsBusy(false);
    }
  };

  const chosen = cycle?.categories.find((row) => row.key === category);

  return (
    <Dialog open={cycle !== null} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Nominate for {cycle?.programme_name} — {cycle?.label}
          </DialogTitle>
          <DialogDescription>
            The jury sees the nomination and your citation, never who nominated. Make the case on
            the work.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="nominee" label="Who">
            <EmployeePicker id="nominee" value={nominee} onChange={setNominee} excludeId={user?.employee_id} />
          </FormField>
          <FormField htmlFor="nomination-category" label="Category" hint={chosen?.description ?? undefined}>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="nomination-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(cycle?.categories ?? []).map((row) => (
                  <SelectItem key={row.key} value={row.key}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            htmlFor="nomination-citation"
            label="Citation"
            hint={`What did they do, and what came of it? At least ${MIN_CITATION} characters. Jurors score against: ${(cycle?.criteria ?? []).map((row) => row.name).join(", ")}.`}
          >
            <Textarea
              id="nomination-citation"
              value={citation}
              onChange={(event) => setCitation(event.target.value)}
              rows={5}
              maxLength={4000}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || !nominee || !category || citation.trim().length < MIN_CITATION}>
            {isBusy && <Loader2 className="animate-spin" />} Nominate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
