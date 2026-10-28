"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { EmployeePicker, type PickedEmployee } from "@/components/people/EmployeePicker";
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
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type { AwardCadence, AwardProgramme } from "@/lib/types/culture";
import { toISODate } from "@/lib/utils";

import { apiDetail } from "../cultureShared";
import { DatePicker } from "@/components/common/DatePicker";
import { FieldLegend, FieldSet } from "@/components/ui/field";

const CADENCES: { value: AwardCadence; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half-yearly" },
  { value: "annual", label: "Annual" },
];

/** "Customer obsession" → "customer-obsession", matching the API's key pattern. */
function toKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

interface Row {
  name: string;
  weight: string;
}

/** A programme: its categories and the criteria jurors score them on. */
export function NewProgrammeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cadence, setCadence] = useState<AwardCadence>("quarterly");
  const [categories, setCategories] = useState<string[]>([""]);
  const [criteria, setCriteria] = useState<Row[]>([{ name: "", weight: "1" }]);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setCadence("quarterly");
    setCategories([""]);
    setCriteria([{ name: "", weight: "1" }]);
  }, [open]);

  const cleanCategories = categories.map((row) => row.trim()).filter(Boolean);
  const cleanCriteria = criteria.filter((row) => row.name.trim());
  const keys = [...cleanCategories.map(toKey)];
  const criterionKeys = cleanCriteria.map((row) => toKey(row.name));
  const duplicate =
    new Set(keys).size !== keys.length || new Set(criterionKeys).size !== criterionKeys.length;
  const weightsOk = cleanCriteria.every((row) => /^\d+$/.test(row.weight) && Number(row.weight) >= 1 && Number(row.weight) <= 10);
  const invalid =
    name.trim().length < 2 || cleanCategories.length === 0 || cleanCriteria.length === 0 || duplicate || !weightsOk;

  const submit = async () => {
    setIsBusy(true);
    try {
      await post("/culture/award-programmes", {
        name: name.trim(),
        description: description.trim() || null,
        cadence,
        categories: cleanCategories.map((row) => ({ key: toKey(row), name: row })),
        criteria: cleanCriteria.map((row) => ({ key: toKey(row.name), name: row.name.trim(), weight: Number(row.weight) })),
      });
      toast.success("Programme created.");
      onCreated();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not create the programme."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New award programme</DialogTitle>
          <DialogDescription>
            Criteria are what jurors score, 1 to 10 each. Weight the ones that matter more.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <FormField htmlFor="programme-name" label="Name">
              <Input id="programme-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Quarterly Stars" />
            </FormField>
            <FormField htmlFor="programme-cadence" label="Runs">
              <Select value={cadence} onValueChange={(next) => setCadence(next as AwardCadence)}>
                <SelectTrigger id="programme-cadence" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CADENCES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField htmlFor="programme-description" label="Description" optional>
            <Textarea id="programme-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </FormField>

          <FieldSet className="grid gap-2">
            <FieldLegend className="text-sm font-medium">Categories</FieldLegend>
            {categories.map((row, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  aria-label={`Category ${index + 1}`}
                  value={row}
                  onChange={(e) => setCategories(categories.map((item, at) => (at === index ? e.target.value : item)))}
                  placeholder="Customer hero"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove category"
                  disabled={categories.length === 1}
                  onClick={() => setCategories(categories.filter((_, at) => at !== index))}
                >
                  <X />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-fit" onClick={() => setCategories([...categories, ""])}>
              <Plus /> Add category
            </Button>
          </FieldSet>

          <FieldSet className="grid gap-2">
            <FieldLegend className="text-sm font-medium">Criteria</FieldLegend>
            {criteria.map((row, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  aria-label={`Criterion ${index + 1}`}
                  value={row.name}
                  onChange={(e) => setCriteria(criteria.map((item, at) => (at === index ? { ...item, name: e.target.value } : item)))}
                  placeholder="Impact"
                />
                <Input
                  aria-label={`Weight of criterion ${index + 1}`}
                  className="w-20"
                  inputMode="numeric"
                  value={row.weight}
                  onChange={(e) => setCriteria(criteria.map((item, at) => (at === index ? { ...item, weight: e.target.value } : item)))}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove criterion"
                  disabled={criteria.length === 1}
                  onClick={() => setCriteria(criteria.filter((_, at) => at !== index))}
                >
                  <X />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-fit" onClick={() => setCriteria([...criteria, { name: "", weight: "1" }])}>
              <Plus /> Add criterion
            </Button>
            {duplicate && <p className="text-xs text-destructive">Two categories or two criteria have the same name.</p>}
            {!weightsOk && <p className="text-xs text-destructive">Weights are whole numbers from 1 to 10.</p>}
          </FieldSet>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || invalid}>
            {isBusy && <Loader2 className="animate-spin" />} Create programme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Open a cycle of a programme: its label, nomination window and jury. */
export function NewCycleDialog({
  open,
  programmes,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  programmes: AwardProgramme[];
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [programmeId, setProgrammeId] = useState("");
  const [label, setLabel] = useState("");
  const [opensOn, setOpensOn] = useState(toISODate(new Date()));
  const [closesOn, setClosesOn] = useState("");
  const [announceOn, setAnnounceOn] = useState("");
  const [jurors, setJurors] = useState<PickedEmployee[]>([]);
  const [picker, setPicker] = useState<PickedEmployee | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProgrammeId(programmes[0]?.id ?? "");
    setLabel("");
    setOpensOn(toISODate(new Date()));
    setClosesOn("");
    setAnnounceOn("");
    setJurors([]);
    setPicker(null);
  }, [open, programmes]);

  const addJuror = (person: PickedEmployee | null) => {
    if (person && !jurors.some((row) => row.id === person.id)) setJurors([...jurors, person]);
    setPicker(null);
  };

  const invalid = !programmeId || !label.trim() || !closesOn || closesOn < opensOn || jurors.length === 0;

  const submit = async () => {
    setIsBusy(true);
    try {
      await post("/culture/award-cycles", {
        programme_id: programmeId,
        label: label.trim(),
        nominations_open_on: opensOn,
        nominations_close_on: closesOn,
        result_announcement_date: announceOn || null,
        juror_employee_ids: jurors.map((row) => row.id),
      });
      toast.success("Cycle created as a draft. Open nominations when you are ready.");
      onCreated();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not open the cycle."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open an award cycle</DialogTitle>
          <DialogDescription>
            Jurors need a login; anyone without one is refused by name.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="cycle-programme" label="Programme">
            <Select value={programmeId} onValueChange={setProgrammeId}>
              <SelectTrigger id="cycle-programme" className="w-full">
                <SelectValue placeholder="Choose a programme" />
              </SelectTrigger>
              <SelectContent>
                {programmes.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="cycle-label" label="Label">
            <Input id="cycle-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Q3 FY27" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="cycle-opens" label="Nominations open">
              <DatePicker id="cycle-opens" value={opensOn} onChange={setOpensOn} />
            </FormField>
            <FormField
              htmlFor="cycle-closes"
              label="Nominations close"
              error={closesOn && closesOn < opensOn ? "Closes before it opens." : undefined}
            >
              <DatePicker id="cycle-closes" value={closesOn} onChange={setClosesOn} />
            </FormField>
          </div>
          <FormField htmlFor="cycle-announce" label="Results announced" optional>
            <DatePicker id="cycle-announce" value={announceOn} onChange={setAnnounceOn} />
          </FormField>
          <FormField htmlFor="cycle-jurors" label={`Jury (${jurors.length})`}>
            <EmployeePicker id="cycle-jurors" value={picker} onChange={addJuror} placeholder="Add a juror" />
          </FormField>
          {jurors.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {jurors.map((row) => (
                <Badge key={row.id} variant="secondary" className="gap-1 pr-1">
                  {row.label}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-4"
                    aria-label={`Remove ${row.label}`}
                    onClick={() => setJurors(jurors.filter((item) => item.id !== row.id))}
                  >
                    <X className="size-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || invalid}>
            {isBusy && <Loader2 className="animate-spin" />} Create cycle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
