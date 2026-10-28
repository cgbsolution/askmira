"use client";

import { BarChart3, CalendarDays, ChevronRight, Loader2, MapPin, Plus, Trash2, Vote } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { RequireRole } from "@/components/common/RequireRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { HR } from "@/lib/access";
import { ApiError, post } from "@/lib/api";
import { DateTimePicker } from "@/components/common/DateTimePicker";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Poll {
  id: string;
  question: string;
  options: string[];
  is_anonymous: boolean;
  closes_at: string | null;
  is_open: boolean;
  responses: number;
  your_vote: number | null;
  results: { option: string; votes: number }[] | null;
  results_note: string | null;
}

interface TeamEvent {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  capacity: number | null;
  rsvp_by: string | null;
  cancelled: boolean;
  going: number;
  maybe: number;
  not_going: number;
  is_full: boolean;
  your_response: "going" | "maybe" | "not_going" | null;
  attendees: string[] | null;
}

const when = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

export function PollsEventsScreen() {
  return (
    <PageShell title="Polls and events" description="Quick questions to the company, and events to answer.">
      <Tabs defaultValue="polls">
        <TabsList>
          <TabsTrigger value="polls">Polls</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>
        <TabsContent value="polls" className="mt-4">
          <Polls />
        </TabsContent>
        <TabsContent value="events" className="mt-4">
          <Events />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function Polls() {
  const { data, error, isLoading, reload } = useApiQuery<Poll[]>("/culture/polls");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const polls = data ?? [];

  const act = async (poll: Poll, path: string, body?: object) => {
    setBusy(poll.id);
    try {
      await post(`/culture/polls/${poll.id}/${path}`, body);
      reload();
    } catch (caught) {
      toast.error(failure(caught, "That did not go through."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <DataPanel
        tier="tier2"
        title="Polls"
        description="One vote each. You can change it while the poll is open."
        actions={
          <RequireRole roles={HR}>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> Ask a question
            </Button>
          </RequireRole>
        }
        isLoading={isLoading && !data}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={polls.length === 0}
        empty={{ icon: Vote, title: "No polls yet" }}
      >
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {polls.map((poll) => {
            const total = poll.results?.reduce((sum, r) => sum + r.votes, 0) ?? 0;
            return (
              <Card key={poll.id} tier="tier2">
                <CardHeader>
                  <CardTitle className="text-base">{poll.question}</CardTitle>
                  <CardDescription className="flex flex-wrap gap-1.5">
                    <Badge variant={poll.is_open ? "success" : "muted"}>{poll.is_open ? "Open" : "Closed"}</Badge>
                    {poll.is_anonymous && <Badge variant="outline">Anonymous</Badge>}
                    <span>{poll.responses} answer(s)</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {poll.options.map((option, index) => {
                    const votes = poll.results?.[index]?.votes ?? 0;
                    return (
                      <div key={option} className="grid gap-1">
                        <Button
                          variant={poll.your_vote === index ? "default" : "outline"}
                          className="justify-between"
                          disabled={!poll.is_open || busy === poll.id}
                          onClick={() => void act(poll, "vote", { option_index: index })}
                        >
                          <span>{option}</span>
                          {poll.results && <span className="tabular-nums">{votes}</span>}
                        </Button>
                        {poll.results && <Progress value={total ? (votes / total) * 100 : 0} className="h-1.5" aria-label={`${option} share`} />}
                      </div>
                    );
                  })}
                  {poll.results_note && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <BarChart3 className="size-3.5" /> {poll.results_note}
                    </p>
                  )}
                  {poll.is_open && (
                    <RequireRole roles={HR}>
                      <Button size="sm" variant="ghost" className="justify-self-start" disabled={busy === poll.id} onClick={() => void act(poll, "close")}>
                        Close the poll
                      </Button>
                    </RequireRole>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DataPanel>
      {creating && (
        <NewPollDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </>
  );
}

function NewPollDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [anonymous, setAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);
  const filled = options.map((o) => o.trim()).filter(Boolean);

  const save = async () => {
    setBusy(true);
    try {
      await post("/culture/polls", { question: question.trim(), options: filled, is_anonymous: anonymous });
      toast.success("Poll opened.");
      onCreated();
    } catch (caught) {
      toast.error(failure(caught, "The poll could not be opened."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask a question</DialogTitle>
          <DialogDescription>Everyone can answer once. Results show to a person after they vote.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="poll-question" label="Question">
            <Input id="poll-question" maxLength={300} value={question} onChange={(e) => setQuestion(e.target.value)} />
          </FormField>
          <div className="grid gap-2">
            <Label>Options</Label>
            {options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  aria-label={`Option ${index + 1}`}
                  maxLength={120}
                  value={option}
                  onChange={(e) => setOptions((current) => current.map((o, i) => (i === index ? e.target.value : o)))}
                />
                {options.length > 2 && (
                  <Button size="icon" variant="ghost" aria-label="Remove option" onClick={() => setOptions((c) => c.filter((_, i) => i !== index))}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 10 && (
              <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setOptions((c) => [...c, ""])}>
                <Plus /> Add an option
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch id="poll-anonymous" checked={anonymous} onCheckedChange={setAnonymous} />
            <Label htmlFor="poll-anonymous" className="font-normal">
              Anonymous — nobody, HR included, can see who voted for what
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || question.trim().length < 3 || filled.length < 2} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Open the poll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Events() {
  const { data, error, isLoading, reload } = useApiQuery<TeamEvent[]>("/culture/events");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const events = data ?? [];

  const act = async (event: TeamEvent, path: string, body?: object) => {
    setBusy(event.id);
    try {
      await post(`/culture/events/${event.id}/${path}`, body);
      reload();
    } catch (caught) {
      toast.error(failure(caught, "That did not go through."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <DataPanel
        tier="tier2"
        title="Upcoming events"
        actions={
          <RequireRole roles={HR}>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> New event
            </Button>
          </RequireRole>
        }
        isLoading={isLoading && !data}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={events.length === 0}
        empty={{ icon: CalendarDays, title: "No upcoming events" }}
      >
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {events.map((event) => (
            <Card key={event.id} tier="tier2" className={event.cancelled ? "opacity-60" : undefined}>
              <CardHeader>
                <CardTitle className="text-base">{event.title}</CardTitle>
                <CardDescription className="grid gap-1">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" /> {when.format(new Date(event.starts_at))}
                  </span>
                  {event.venue && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> {event.venue}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {event.description && <p className="whitespace-pre-line text-sm">{event.description}</p>}
                <p className="text-sm text-muted-foreground">
                  {event.going} going{event.capacity ? ` of ${event.capacity}` : ""} · {event.maybe} maybe
                  {event.is_full && " · full"}
                  {event.cancelled && " · cancelled"}
                </p>
                {!event.cancelled && (
                  <div className="flex flex-wrap gap-2">
                    {(["going", "maybe", "not_going"] as const).map((answer) => (
                      <Button
                        key={answer}
                        size="sm"
                        variant={event.your_response === answer ? "default" : "outline"}
                        disabled={busy === event.id || (answer === "going" && event.is_full && event.your_response !== "going")}
                        onClick={() => void act(event, "rsvp", { response: answer })}
                      >
                        {answer === "going" ? "Going" : answer === "maybe" ? "Maybe" : "Not going"}
                      </Button>
                    ))}
                  </div>
                )}
                {event.attendees && event.attendees.length > 0 && (
                  <Collapsible className="text-sm">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="group h-7 justify-start px-1 font-normal text-muted-foreground">
                        <ChevronRight className="transition-transform group-data-[state=open]:rotate-90" />
                        Who is coming ({event.attendees.length})
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                    <ul className="mt-1 grid gap-0.5">
                      {event.attendees.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                {!event.cancelled && (
                  <RequireRole roles={HR}>
                    <Button size="sm" variant="ghost" className="justify-self-start" disabled={busy === event.id} onClick={() => void act(event, "cancel")}>
                      Cancel the event
                    </Button>
                  </RequireRole>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </DataPanel>
      {creating && (
        <NewEventDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </>
  );
}

function NewEventDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [starts, setStarts] = useState("");
  const [venue, setVenue] = useState("");
  const [capacity, setCapacity] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await post("/culture/events", {
        title: title.trim(),
        description: description.trim() || null,
        starts_at: new Date(starts).toISOString(),
        venue: venue.trim() || null,
        capacity: capacity.trim() ? Number(capacity) : null,
      });
      toast.success("Event created.");
      onCreated();
    } catch (caught) {
      toast.error(failure(caught, "The event could not be created."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
          <DialogDescription>People answer going, maybe or not going. A capacity stops over-booking.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="event-title" label="Title">
            <Input id="event-title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="event-starts" label="Starts">
              <DateTimePicker id="event-starts" value={starts} onChange={setStarts} />
            </FormField>
            <FormField htmlFor="event-capacity" label="Places" optional>
              <Input id="event-capacity" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))} />
            </FormField>
          </div>
          <FormField htmlFor="event-venue" label="Where" optional>
            <Input id="event-venue" maxLength={300} value={venue} onChange={(e) => setVenue(e.target.value)} />
          </FormField>
          <FormField htmlFor="event-description" label="Details" optional>
            <Textarea id="event-description" rows={3} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || title.trim().length < 3 || !starts} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
