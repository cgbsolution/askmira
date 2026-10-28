"use client";

import { AlertTriangle, CalendarPlus, Copy, Loader2, Search, Send } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { InterviewRequisitionSelect } from "@/components/hiring/InterviewRequisitionSelect";
import { CANDIDATE_STAGE, formatDateTime, humanize, INTERVIEW_MODE } from "@/components/hiring/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import type { Page } from "@/lib/types";
import type {
  CandidateSummary,
  InterviewStage,
  PanelPerson,
  ProposeResult,
  ProposedSlot,
  ScheduleInput,
  SelfScheduleLinkResult,
} from "@/lib/types/hiring";
import { toISODate } from "@/lib/utils";
import { DateTimePicker } from "@/components/common/DateTimePicker";

/**
 * HR's scheduling form: choose the candidate, round and panel, find times the
 * whole panel can make (unread calendars are named, never assumed free), then
 * book one — or send the candidate a link to pick from several.
 */
export function ScheduleForm({ onScheduled }: { onScheduled: () => void }) {
  const [requisitionId, setRequisitionId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [stageId, setStageId] = useState("");
  const [panel, setPanel] = useState<string[]>([]);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [proposal, setProposal] = useState<ProposeResult | null>(null);
  const [isProposing, setIsProposing] = useState(false);
  const [chosenSlot, setChosenSlot] = useState<ProposedSlot | null>(null);
  const [manualStart, setManualStart] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [linkSlots, setLinkSlots] = useState<string[]>([]);
  const [isLinking, setIsLinking] = useState(false);
  const [link, setLink] = useState<{ url: string; result: SelfScheduleLinkResult } | null>(null);

  const candidates = useApiQuery<Page<CandidateSummary>>(
    requisitionId ? `/hiring/candidates?requisition_id=${requisitionId}&page_size=200` : null,
  );
  const stages = useApiQuery<InterviewStage[]>(
    requisitionId ? `/interviews/stages?requisition_id=${requisitionId}` : null,
  );
  const people = useApiQuery<PanelPerson[]>("/interviews/panel-people");

  const peopleById = useMemo(
    () => new Map((people.data ?? []).map((person) => [person.user_id, person])),
    [people.data],
  );
  // A previous requisition's lists linger while the next ones load; never offer them.
  const candidateItems = requisitionId && !candidates.isLoading ? (candidates.data?.items ?? []) : [];
  const stageItems = (stages.data ?? []).filter((s) => s.requisition_id === requisitionId);
  const stage = stageItems.find((item) => item.id === stageId) ?? null;

  const clearTimes = () => {
    setProposal(null);
    setChosenSlot(null);
    setLinkSlots([]);
  };

  const missing = (): string | null => {
    if (!requisitionId) return "Choose a requisition.";
    if (!candidateId) return "Choose a candidate.";
    if (!stageId) return "Choose the interview round.";
    if (panel.length === 0) return "Choose at least one panellist.";
    if (!timezone.trim()) return "Enter the candidate's time zone.";
    return null;
  };

  const findTimes = async () => {
    const problem = missing();
    if (problem) {
      toast.error(problem);
      return;
    }
    setIsProposing(true);
    clearTimes();
    try {
      const result = await post<ProposeResult>("/interviews/propose", {
        stage_id: stageId,
        panelist_user_ids: panel,
        from_day: toISODate(new Date()),
        days: 7,
        timezone_name: timezone.trim(),
        limit: 20,
      });
      setProposal(result);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not look for times.");
    } finally {
      setIsProposing(false);
    }
  };

  const schedule = async () => {
    const problem = missing() ?? (!chosenSlot && !manualStart ? "Pick a proposed time or type one." : null);
    if (problem) {
      toast.error(problem);
      return;
    }
    const body: ScheduleInput = {
      candidate_id: candidateId,
      stage_id: stageId,
      start: chosenSlot ? chosenSlot.start_utc : manualStart,
      candidate_timezone: timezone.trim(),
      panelist_user_ids: panel,
    };
    setIsScheduling(true);
    try {
      const created = await post<{ calendar_warnings?: unknown }>("/interviews", body);
      const warnings = Array.isArray(created?.calendar_warnings) ? created.calendar_warnings.map(String) : [];
      if (warnings.length > 0) toast.warning("Interview scheduled", { description: warnings.join(" ") });
      else toast.success("Interview scheduled");
      setCandidateId("");
      setManualStart("");
      clearTimes();
      onScheduled();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "The interview could not be scheduled.");
    } finally {
      setIsScheduling(false);
    }
  };

  const sendLink = async () => {
    const problem = missing() ?? (linkSlots.length === 0 ? "Tick at least one proposed time to offer." : null);
    if (problem || !proposal) {
      toast.error(problem ?? "Find times first.");
      return;
    }
    const slots = proposal.slots
      .filter((slot) => linkSlots.includes(slot.start_utc))
      .map((slot) => ({ start: slot.start_utc, end: slot.end_utc, panelist_user_ids: panel }));
    setIsLinking(true);
    try {
      const result = await post<SelfScheduleLinkResult>("/interviews/self-schedule", {
        candidate_id: candidateId,
        stage_id: stageId,
        slots,
        candidate_timezone: timezone.trim(),
      });
      setLink({ url: `${window.location.origin}/interview/schedule/${result.token}`, result });
      setLinkSlots([]);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "The link could not be created.");
    } finally {
      setIsLinking(false);
    }
  };

  const personName = (id: string) => peopleById.get(id)?.full_name ?? "An unlisted panellist";

  return (
    <div className="grid gap-4">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Who and which round</CardTitle>
          <CardDescription>Only open requisitions can be scheduled.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <InterviewRequisitionSelect
            id="schedule-requisition"
            value={requisitionId}
            onChange={(value) => {
              setRequisitionId(value);
              setCandidateId("");
              setStageId("");
              clearTimes();
            }}
          />
          <FormField
            htmlFor="schedule-candidate"
            label="Candidate"
            error={candidates.error?.detail}
            hint={
              requisitionId && !candidates.isLoading && candidateItems.length === 0
                ? "No candidates on this requisition."
                : undefined
            }
          >
            <Select
              value={candidateId}
              onValueChange={(value) => {
                setCandidateId(value);
                clearTimes();
              }}
              disabled={candidateItems.length === 0}
            >
              <SelectTrigger id="schedule-candidate" className="w-full">
                <SelectValue placeholder={requisitionId ? "Choose a candidate" : "Choose a requisition first"} />
              </SelectTrigger>
              <SelectContent>
                {candidateItems.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.full_name} · {CANDIDATE_STAGE[candidate.stage]?.[0] ?? humanize(candidate.stage)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            htmlFor="schedule-stage"
            label="Round"
            error={stages.error?.detail}
            hint={
              requisitionId && !stages.isLoading && stageItems.length === 0
                ? "This requisition has no rounds yet. Add them on the Rounds tab."
                : stage
                  ? `${stage.duration_minutes} min · ${INTERVIEW_MODE[stage.mode]}`
                  : undefined
            }
          >
            <Select
              value={stageId}
              onValueChange={(value) => {
                setStageId(value);
                clearTimes();
              }}
              disabled={stageItems.length === 0}
            >
              <SelectTrigger id="schedule-stage" className="w-full">
                <SelectValue placeholder={requisitionId ? "Choose a round" : "Choose a requisition first"} />
              </SelectTrigger>
              <SelectContent>
                {stageItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.sequence}. {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            htmlFor="schedule-timezone"
            label="Candidate time zone"
            hint="An IANA zone name, for example Asia/Kolkata or Europe/London."
          >
            <Input
              id="schedule-timezone"
              value={timezone}
              maxLength={64}
              onChange={(event) => {
                setTimezone(event.target.value);
                clearTimes();
              }}
            />
          </FormField>

          <div className="grid gap-2 md:col-span-2">
            <p className="text-sm font-medium text-foreground">Panel</p>
            {people.isLoading && !people.data ? (
              <Skeleton className="h-20 w-full" />
            ) : people.error ? (
              <ErrorState message={people.error.detail} onRetry={people.reload} className="py-4" />
            ) : (people.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No one is available to sit on a panel.</p>
            ) : (
              <ul className="grid max-h-60 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
                {(people.data ?? []).map((person) => {
                  const checkboxId = `panel-${person.user_id}`;
                  return (
                    <li key={person.user_id} className="flex items-start gap-2 rounded px-1 py-1">
                      <Checkbox
                        id={checkboxId}
                        checked={panel.includes(person.user_id)}
                        onCheckedChange={(checked) => {
                          setPanel((current) =>
                            checked === true
                              ? [...current, person.user_id]
                              : current.filter((id) => id !== person.user_id),
                          );
                          clearTimes();
                        }}
                      />
                      <Label htmlFor={checkboxId} className="grid gap-0 font-normal">
                        <span className="text-foreground">{person.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {humanize(person.role)} · {person.email}
                        </span>
                      </Label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="md:col-span-2">
            <Button variant="outline" disabled={isProposing} onClick={() => void findTimes()}>
              {isProposing ? <Loader2 className="animate-spin" /> : <Search />}
              Find times
            </Button>
          </div>
        </CardContent>
      </Card>

      {proposal && (
        <Card tier="tier1">
          <CardHeader>
            <CardTitle>Proposed times</CardTitle>
            <CardDescription>
              Shown in {proposal.timezone}, {proposal.duration_minutes} minutes each.
              {proposal.all_calendars_read ? " Every panellist's calendar was read." : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {proposal.caveats.length > 0 && (
              <Alert variant="warning">
                <AlertTriangle />
                <AlertTitle>Check before booking</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {proposal.caveats.map((caveat) => (
                      <li key={caveat}>{caveat}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {proposal.slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No time in the next 7 days works for this panel. Try a smaller panel or type a time below.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {proposal.slots.map((slot) => {
                  const offerId = `offer-slot-${slot.start_utc}`;
                  const chosen = chosenSlot?.start_utc === slot.start_utc;
                  return (
                    <li key={slot.start_utc} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <Checkbox
                          id={offerId}
                          aria-label="Offer this time in a self-scheduling link"
                          checked={linkSlots.includes(slot.start_utc)}
                          onCheckedChange={(checked) =>
                            setLinkSlots((current) =>
                              checked === true
                                ? [...current, slot.start_utc]
                                : current.filter((value) => value !== slot.start_utc),
                            )
                          }
                        />
                        <div className="min-w-0">
                          <Label htmlFor={offerId} className="font-medium tabular-nums">
                            {slot.local_label}
                          </Label>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            Your time: {formatDateTime(slot.start_utc)}
                          </p>
                          {slot.unverified_panelist_ids.length > 0 && (
                            <p className="text-xs text-marigold-900 dark:text-marigold-100">
                              Calendar not read for: {slot.unverified_panelist_ids.map(personName).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {slot.fully_verified ? (
                          <Badge variant="success">Verified free</Badge>
                        ) : (
                          <Badge variant="warning">Not fully verified</Badge>
                        )}
                        <Button
                          size="sm"
                          variant={chosen ? "default" : "outline"}
                          onClick={() => {
                            setChosenSlot(chosen ? null : slot);
                            setManualStart("");
                          }}
                        >
                          {chosen ? "Chosen" : "Use this time"}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={isLinking || linkSlots.length === 0}
                onClick={() => void sendLink()}
              >
                {isLinking ? <Loader2 className="animate-spin" /> : <Send />}
                Send self-scheduling link
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {linkSlots.length} time{linkSlots.length === 1 ? "" : "s"} ticked for the candidate to choose from
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Book the interview</CardTitle>
          <CardDescription>
            {chosenSlot
              ? `Booking the proposed time ${chosenSlot.local_label}.`
              : "Pick a proposed time above, or type one. A typed time is read in the candidate's time zone."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <FormField htmlFor="schedule-manual-start" label="Or type a start time" optional className="w-64">
            <DateTimePicker
              id="schedule-manual-start"
              value={manualStart}
              onChange={(picked) => {
                setManualStart(picked);
                if (picked) setChosenSlot(null);
              }}
            />
          </FormField>
          <Button disabled={isScheduling} onClick={() => void schedule()}>
            {isScheduling ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
            Schedule
          </Button>
        </CardContent>
      </Card>

      <ScheduleLinkDialog link={link} onClose={() => setLink(null)} />
    </div>
  );
}

/** The self-scheduling link, shown exactly once, with a copy button. */
function ScheduleLinkDialog({
  link,
  onClose,
}: {
  link: { url: string; result: SelfScheduleLinkResult } | null;
  onClose: () => void;
}) {
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy. Select the link and copy it by hand.");
    }
  };
  return (
    <Dialog open={link !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Self-scheduling link</DialogTitle>
          <DialogDescription>{link?.result.note}</DialogDescription>
        </DialogHeader>
        {link && (
          <div className="grid gap-2">
            <Input readOnly value={link.url} aria-label="Self-scheduling link" onFocus={(event) => event.target.select()} />
            <p className="text-xs text-muted-foreground tabular-nums">
              {link.result.slot_count} time{link.result.slot_count === 1 ? "" : "s"} offered · expires{" "}
              {formatDateTime(link.result.expires_at)}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
          <Button onClick={() => void copy()}>
            <Copy /> Copy link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
