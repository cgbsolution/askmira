"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
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
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { Instrument, SurveyKind } from "@/lib/types/culture";
import { toISODate } from "@/lib/utils";

import { apiDetail } from "../cultureShared";
import { DatePicker } from "@/components/common/DatePicker";

const KINDS: { value: SurveyKind; label: string }[] = [
  { value: "pulse", label: "Pulse" },
  { value: "enps", label: "eNPS" },
  { value: "engagement", label: "Engagement" },
  { value: "wellbeing", label: "Wellbeing" },
  { value: "inclusion", label: "Inclusion" },
  { value: "custom", label: "Custom" },
];

const NO_RESURVEY = "__none__";

/**
 * Create a survey from a validated instrument.
 *
 * Questions come from a published, validated instrument with its source named,
 * not typed freehand: a home-made question produces a number nobody can
 * compare with anything. The reporting threshold cannot go below the engine's
 * floor, because a threshold an admin can set to one is not a threshold.
 */
export function NewSurveyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const catalogue = useApiQuery<{ instruments: Instrument[]; min_responses: number }>(
    open ? "/culture/instruments" : null,
  );
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SurveyKind>("pulse");
  const [instrumentKey, setInstrumentKey] = useState("");
  const [opensOn, setOpensOn] = useState(toISODate(new Date()));
  const [closesOn, setClosesOn] = useState("");
  const [minResponses, setMinResponses] = useState("5");
  const [resurvey, setResurvey] = useState(NO_RESURVEY);
  const [isBusy, setIsBusy] = useState(false);

  const floor = catalogue.data?.min_responses ?? 5;
  const instruments = catalogue.data?.instruments ?? [];
  const chosen = instruments.find((row) => row.key === instrumentKey);

  useEffect(() => {
    if (!open) return;
    setName("");
    setKind("pulse");
    setOpensOn(toISODate(new Date()));
    setClosesOn("");
    setResurvey(NO_RESURVEY);
  }, [open]);

  useEffect(() => {
    if (instruments.length > 0 && !instrumentKey) setInstrumentKey(instruments[0].key);
    setMinResponses(String(floor));
    // Only when the catalogue arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue.data]);

  const min = Number(minResponses);
  const invalid =
    !name.trim() || !instrumentKey || !closesOn || closesOn < opensOn || !Number.isInteger(min) || min < floor || min > 500;

  const submit = async () => {
    setIsBusy(true);
    try {
      await post("/culture/surveys", {
        name: name.trim(),
        kind,
        instrument_key: instrumentKey,
        opens_on: opensOn,
        closes_on: closesOn,
        min_responses_to_report: min,
        resurvey_interval_days: resurvey === NO_RESURVEY ? null : Number(resurvey),
      });
      toast.success("Survey created. Invitations go out when it opens.");
      onCreated();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not create the survey."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New survey</DialogTitle>
          <DialogDescription>Questions come from a validated instrument, so results can be compared.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="survey-name" label="Name">
            <Input id="survey-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="October pulse" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="survey-kind" label="Kind">
              <Select value={kind} onValueChange={(next) => setKind(next as SurveyKind)}>
                <SelectTrigger id="survey-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="survey-instrument" label="Instrument">
              <Select value={instrumentKey} onValueChange={setInstrumentKey}>
                <SelectTrigger id="survey-instrument" className="w-full">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {instruments.map((row) => (
                    <SelectItem key={row.key} value={row.key}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          {chosen && (
            <p className="rounded-md border border-border p-3 text-xs text-muted-foreground">
              {chosen.items.length} questions on a {chosen.scale} scale. Source: {chosen.source}. {chosen.rationale}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="survey-opens" label="Opens">
              <DatePicker id="survey-opens" value={opensOn} onChange={setOpensOn} />
            </FormField>
            <FormField htmlFor="survey-closes" label="Closes" error={closesOn && closesOn < opensOn ? "Closes before it opens." : undefined}>
              <DatePicker id="survey-closes" value={closesOn} onChange={setClosesOn} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              htmlFor="survey-min"
              label="Report a group from"
              hint={`Responses. Never below ${floor}.`}
              error={minResponses && (min < floor || min > 500) ? `Between ${floor} and 500.` : undefined}
            >
              <Input id="survey-min" inputMode="numeric" value={minResponses} onChange={(e) => setMinResponses(e.target.value.replace(/\D/g, ""))} />
            </FormField>
            <FormField htmlFor="survey-resurvey" label="Repeat">
              <Select value={resurvey} onValueChange={setResurvey}>
                <SelectTrigger id="survey-resurvey" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_RESURVEY}>Do not repeat</SelectItem>
                  <SelectItem value="90">Every quarter</SelectItem>
                  <SelectItem value="180">Every six months</SelectItem>
                  <SelectItem value="365">Every year</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || invalid}>
            {isBusy && <Loader2 className="animate-spin" />} Create survey
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
