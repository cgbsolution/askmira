"use client";

import { Award, Cake, Loader2, Megaphone, MoreHorizontal, Pin, PinOff, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { SectionNav } from "@/components/common/SectionNav";
import { EmployeePicker, type PickedEmployee } from "@/components/people/EmployeePicker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, get, post, put } from "@/lib/api";
import type { Page } from "@/lib/types";
import {
  ALLOWED_REACTIONS,
  type Announcement,
  type CalendarResponse,
  type CompanyValue,
  type ReactionSummary,
  type Shoutout,
  type ShoutoutVisibility,
} from "@/lib/types/culture";
import { cn, formatDay, toISODate } from "@/lib/utils";

import { CelebrationPrivacyCard } from "./CelebrationPrivacyCard";
import { apiDetail, timeAgo } from "./cultureShared";

const PAGE_SIZE = 20;
const NO_VALUE = "__none__";

const VISIBILITY_LABEL: Record<ShoutoutVisibility, string> = {
  company: "Everyone",
  department: "My department",
  private: "Only the two of us",
};

/**
 * Culture → Feed.
 *
 * Recognition between people, tagged with the value it shows. Posted only in
 * the caller's own name — the API refuses otherwise — and celebrations appear
 * only for people who opted in to sharing them, which is off by default.
 */
export function FeedScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<Shoutout[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const values = useApiQuery<CompanyValue[]>("/culture/values");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    get<Page<Shoutout>>(`/culture/shoutouts?page=${page}&page_size=${PAGE_SIZE}`)
      .then((result) => {
        if (cancelled) return;
        setItems((current) => (page === 1 ? result.items : [...current, ...result.items]));
        setTotal(result.total);
        setError(null);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.detail : "Could not load the feed.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, version]);

  const refresh = useCallback(() => {
    setPage(1);
    setVersion((current) => current + 1);
  }, []);

  const replace = (updated: Shoutout) =>
    setItems((current) => current.map((row) => (row.id === updated.id ? updated : row)));

  return (
    <PageShell
      tier="tier2"
      title="Feed"
      description="Recognition, awards and the moments people chose to share."
    >
      <SectionNav section="culture" />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {user?.employee_id ? (
            <Composer values={values.data ?? []} onPosted={refresh} />
          ) : (
            <Alert>
              <AlertTitle>Your login is not linked to an employee record</AlertTitle>
              <AlertDescription>
                Recognition is posted from your own record, so you can read the feed but not post to
                it until HR links your login.
              </AlertDescription>
            </Alert>
          )}

          <DataPanel
            tier="tier2"
            isLoading={isLoading && page === 1}
            error={page === 1 ? error : null}
            onRetry={refresh}
            isEmpty={items.length === 0}
            empty={{
              icon: Award,
              title: "No recognition yet",
              description: "The first shoutout sets the tone. Thank somebody for something specific.",
            }}
          >
            <ul className="divide-y divide-border">
              {items.map((row) => (
                <ShoutoutItem key={row.id} shoutout={row} onChanged={replace} onDeleted={refresh} />
              ))}
            </ul>
            {items.length < total && (
              <div className="border-t border-border p-4 text-center">
                <Button
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {isLoading && <Loader2 className="animate-spin" />} Show more
                </Button>
              </div>
            )}
          </DataPanel>
        </div>

        <aside className="flex flex-col gap-4">
          <AnnouncementsCard />
          <CelebrationsCard />
          {user?.employee_id && <CelebrationPrivacyCard />}
        </aside>
      </div>
    </PageShell>
  );
}

function Composer({ values, onPosted }: { values: CompanyValue[]; onPosted: () => void }) {
  const [to, setTo] = useState<PickedEmployee | null>(null);
  const [message, setMessage] = useState("");
  const [valueTag, setValueTag] = useState(NO_VALUE);
  const [visibility, setVisibility] = useState<ShoutoutVisibility>("company");
  const [isBusy, setIsBusy] = useState(false);
  const { user } = useAuth();

  const active = values.filter((value) => value.is_active);

  const submit = async () => {
    if (!to) return;
    setIsBusy(true);
    try {
      await post("/culture/shoutouts", {
        to_employee_id: to.id,
        message: message.trim(),
        value_tag: valueTag === NO_VALUE ? null : valueTag,
        visibility,
      });
      toast.success(`Recognition posted for ${to.label}.`);
      setTo(null);
      setMessage("");
      setValueTag(NO_VALUE);
      onPosted();
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not post."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle>Recognise somebody</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="shoutout-to" label="Who">
            <EmployeePicker
              id="shoutout-to"
              value={to}
              onChange={setTo}
              excludeId={user?.employee_id}
              placeholder="Search for a colleague"
            />
          </FormField>
          <FormField htmlFor="shoutout-value" label="Value it shows" optional>
            <Select value={valueTag} onValueChange={setValueTag}>
              <SelectTrigger id="shoutout-value" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VALUE}>No value</SelectItem>
                {active.map((value) => (
                  <SelectItem key={value.code} value={value.code}>
                    {value.icon ? `${value.icon} ` : ""}
                    {value.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <FormField
          htmlFor="shoutout-message"
          label="What they did"
          hint="Specific beats general — what did they do, and what difference did it make?"
        >
          <Textarea
            id="shoutout-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            maxLength={2000}
          />
        </FormField>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Select value={visibility} onValueChange={(next) => setVisibility(next as ShoutoutVisibility)}>
            <SelectTrigger className="w-52" aria-label="Who can see this">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(VISIBILITY_LABEL) as ShoutoutVisibility[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {VISIBILITY_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={submit} disabled={isBusy || !to || message.trim().length === 0}>
            {isBusy ? <Loader2 className="animate-spin" /> : <Send />} Post
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ShoutoutItem({
  shoutout,
  onChanged,
  onDeleted,
}: {
  shoutout: Shoutout;
  onChanged: (updated: Shoutout) => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const react = async (emoji: string, current: ReactionSummary | undefined) => {
    const active = !current?.reacted;
    try {
      const reactions = await put<ReactionSummary[]>(`/culture/shoutouts/${shoutout.id}/reactions`, {
        emoji,
        active,
      });
      onChanged({ ...shoutout, reactions });
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not react."));
    }
  };

  const pin = async () => {
    try {
      const updated = await put<Shoutout>(`/culture/shoutouts/${shoutout.id}/pin`, {
        is_pinned: !shoutout.is_pinned,
      });
      onChanged(updated);
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not pin."));
    }
  };

  const remove = async () => {
    try {
      await del(`/culture/shoutouts/${shoutout.id}`);
      toast.success("Removed from the feed.");
      onDeleted();
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not remove it."));
      throw caught;
    }
  };

  const byEmoji = new Map(shoutout.reactions.map((row) => [row.emoji, row]));

  return (
    <li className={cn("px-5 py-4", shoutout.is_pinned && "bg-accent/40")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {shoutout.kind === "award" ? (
            <Award className="size-4 text-primary" aria-label="Award" />
          ) : shoutout.sender ? (
            <PersonCell name={shoutout.sender.name} photoUrl={shoutout.sender.photo_url} size="sm" />
          ) : null}
          <span className="text-muted-foreground">{shoutout.kind === "award" ? "Award to" : "recognised"}</span>
          <PersonCell
            name={shoutout.recipient.name}
            photoUrl={shoutout.recipient.photo_url}
            subtitle={shoutout.recipient.designation}
            size="sm"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {shoutout.is_pinned && (
            <Badge variant="secondary">
              <Pin /> Pinned
            </Badge>
          )}
          {(shoutout.can_pin || shoutout.can_delete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Post actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {shoutout.can_pin && (
                  <DropdownMenuItem onSelect={pin}>
                    {shoutout.is_pinned ? <PinOff /> : <Pin />} {shoutout.is_pinned ? "Unpin" : "Pin to top"}
                  </DropdownMenuItem>
                )}
                {shoutout.can_delete && (
                  <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(true)}>
                    <Trash2 /> Remove
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {shoutout.award && (
        <div className="mt-2 text-sm font-medium text-foreground">
          {shoutout.award.programme_name}
          {shoutout.award.category_name && ` — ${shoutout.award.category_name}`}
        </div>
      )}
      <p className="mt-2 text-sm whitespace-pre-line text-foreground">{shoutout.message}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {shoutout.value_name && <Badge variant="outline">{shoutout.value_name}</Badge>}
        {shoutout.points_awarded > 0 && <Badge variant="secondary">+{shoutout.points_awarded} points</Badge>}
        {shoutout.visibility !== "company" && (
          <Badge variant="muted">{VISIBILITY_LABEL[shoutout.visibility]}</Badge>
        )}
        <span className="text-xs text-muted-foreground">{timeAgo(shoutout.created_at)}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Reactions">
        {ALLOWED_REACTIONS.map((emoji) => {
          const current = byEmoji.get(emoji);
          return (
            <Button
              key={emoji}
              variant={current?.reacted ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              aria-pressed={current?.reacted ?? false}
              aria-label={`React ${emoji}`}
              onClick={() => react(emoji, current)}
            >
              <span aria-hidden>{emoji}</span>
              {current && current.count > 0 && <span className="text-xs tabular-nums">{current.count}</span>}
            </Button>
          );
        })}
      </div>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Remove this post?"
        description="It disappears from the feed for everyone. The removal is recorded in the audit trail."
        confirmLabel="Remove"
        destructive
        onConfirm={remove}
      />
    </li>
  );
}

function AnnouncementsCard() {
  const { data, isLoading } = useApiQuery<Announcement[]>("/culture/announcements");
  const open = (data ?? []).filter((row) => row.requires_acknowledgement && !row.acknowledged);
  const latest = (data ?? []).slice(0, 3);

  return (
    <Card tier="tier2" className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="size-4" /> Announcements
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : latest.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing announced right now.</p>
        ) : (
          <>
            {open.length > 0 && (
              <Badge variant="warning" className="w-fit">
                {open.length} to acknowledge
              </Badge>
            )}
            <ul className="grid gap-2">
              {latest.map((row) => (
                <li key={row.id} className="text-sm">
                  <span className="font-medium text-foreground">{row.title}</span>
                  <div className="text-xs text-muted-foreground">{formatDay(row.publish_at.slice(0, 10))}</div>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" size="sm">
              <Link href="/culture/announcements">All announcements</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Birthdays and anniversaries in the next fortnight — only for people who chose to share them. */
function CelebrationsCard() {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 14);
  const { data, isLoading } = useApiQuery<CalendarResponse>(
    `/culture/calendar?from_date=${toISODate(from)}&to_date=${toISODate(to)}`,
  );
  const events = (data?.events ?? []).filter((event) => event.kind !== "holiday").slice(0, 8);

  return (
    <Card tier="tier2" className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cake className="size-4" /> Next two weeks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing shared for the next two weeks. Birthdays and anniversaries appear only for people
            who chose to share them.
          </p>
        ) : (
          <ul className="grid gap-2">
            {events.map((event, index) => (
              <li key={`${event.on_date}-${event.label}-${index}`} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-foreground">{event.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDay(event.on_date)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
