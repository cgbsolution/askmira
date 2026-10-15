"use client";

import {
  ArrowRight,
  Cake,
  CalendarHeart,
  CircleDollarSign,
  Inbox,
  Link2,
  Palmtree,
  Pencil,
  Plus,
  PartyPopper,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { PersonCell } from "@/components/common/PersonCell";
import { Money } from "@/components/common/Money";
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
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, put } from "@/lib/api";
import { Tr } from "@/lib/i18n/Tr";
import type { DashboardSummary, LeaveBalance, WhoIsOut } from "@/lib/types";
import type { ApprovalInbox } from "@/lib/types/approvals";
import type { TeamToday } from "@/lib/types/attendance";
import type { Celebrations } from "@/lib/types/people";
import { formatDate, formatDay, formatDays, toISODate } from "@/lib/utils";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href={href}>
        {children} <ArrowRight />
      </Link>
    </Button>
  );
}

/** My leave balances, most-available first. Tier 2: it sits on the home screen. */
export function LeaveBalanceCard() {
  const { data, error, isLoading } = useApiQuery<LeaveBalance[]>("/leave/balances");
  // Statutory entitlements (maternity and the like) are not a running
  // balance; the Time page lists them separately, "when eligible".
  const rows = [...(data ?? [])]
    .filter((row) => !row.is_statutory)
    .sort((a, b) => Number(b.available) - Number(a.available))
    .slice(0, 4);

  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palmtree className="size-4 text-primary" /> Leave balance
        </CardTitle>
        <CardDescription>What you can take this year.</CardDescription>
        <CardAction>
          <CardLink href="/time">Apply</CardLink>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-8 w-full" />)
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error.detail}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No leave policy covers you yet. HR sets policies under Time off → Setup.
          </p>
        ) : (
          rows.map((row) => {
            const quota = Number(row.annual_quota_days ?? 0);
            const available = Number(row.available);
            const percent = quota > 0 ? Math.min(100, Math.max(0, (available / quota) * 100)) : 0;
            return (
              <div key={row.leave_type_id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{row.leave_type_name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatDays(row.available)}</span>
                    {quota > 0 && ` of ${formatDays(row.annual_quota_days)}`}
                  </span>
                </div>
                {quota > 0 && <Progress value={percent} className="h-1.5" />}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

/** The holidays that apply to me — my state's and my office's, not every state's. */
export function HolidaysCard({
  holidays,
  isLoading,
}: {
  holidays: DashboardSummary["upcoming_holidays"];
  isLoading: boolean;
}) {
  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarHeart className="size-4 text-primary" /> Upcoming holidays
        </CardTitle>
        <CardDescription>Next 90 days, for your location.</CardDescription>
        <CardAction>
          <CardLink href="/time">Calendar</CardLink>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : holidays.length === 0 ? (
          <p className="text-sm text-muted-foreground">No holidays in the next 90 days.</p>
        ) : (
          <ul className="space-y-2">
            {holidays.map((holiday) => (
              <li
                key={`${holiday.holiday_date}-${holiday.name}`}
                className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm"
              >
                <span className="font-medium">{holiday.name}</span>
                <span className="whitespace-nowrap text-muted-foreground">
                  {new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(
                    new Date(`${holiday.holiday_date}T00:00:00`),
                  )}
                  , {formatDay(holiday.holiday_date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** The five oldest things waiting on me, from the same inbox as /approvals. */
export function ApprovalsCard() {
  const { data, error, isLoading } = useApiQuery<ApprovalInbox>("/approvals");
  const items = (data?.items ?? []).slice(0, 5);
  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="size-4 text-primary" /> Waiting on you
          {data && data.total > 0 && <Badge variant="warning">{data.total}</Badge>}
        </CardTitle>
        <CardDescription>Oldest first. Each opens where it is decided.</CardDescription>
        <CardAction>
          <CardLink href="/approvals">All approvals</CardLink>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error.detail}</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            className="py-4"
            title="You're all caught up"
            description="Requests that need your decision appear here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={`${item.source}-${item.id}`}>
                <Link
                  href={item.link}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.source_label}
                      {item.subject_name ? ` · ${item.subject_name}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(item.submitted_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** My team today: in, not in yet, on leave, late. Managers and HR. */
export function TeamTodayCard() {
  const { data, error, isLoading } = useApiQuery<TeamToday>("/attendance/team/today");
  const counts = data?.counts ?? {};
  const tiles: { label: string; value: number; emphasis?: boolean }[] = [
    { label: "In", value: (counts.in ?? 0) + (counts.out ?? 0) },
    { label: "Not in yet", value: counts.not_in ?? 0, emphasis: (counts.not_in ?? 0) > 0 },
    { label: "On leave", value: counts.on_leave ?? 0 },
    {
      label: "Remote / on duty",
      value: (counts.work_from_home ?? 0) + (counts.on_duty ?? 0),
    },
    { label: "Late", value: counts.late ?? 0, emphasis: (counts.late ?? 0) > 0 },
  ];
  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-primary" /> Team today
        </CardTitle>
        <CardDescription>
          {data ? `${data.members.length} people in your view` : "From today's punches and leave."}
        </CardDescription>
        <CardAction>
          <CardLink href="/time/attendance-review">Review</CardLink>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error.detail}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-md border border-border px-3 py-2">
                <p className="text-xs text-muted-foreground">{tile.label}</p>
                <p
                  className={
                    tile.emphasis
                      ? "text-lg font-semibold tabular-nums text-destructive"
                      : "text-lg font-semibold tabular-nums"
                  }
                >
                  {tile.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const RUN_VARIANTS: Record<string, BadgeVariant> = {
  draft: "muted",
  processing: "secondary",
  pending_review: "warning",
  approved: "success",
  paid: "success",
  failed: "destructive",
  cancelled: "muted",
};

/** The latest real payroll run, or an honest "none yet". HR only. */
export function PayrollCard({ run }: { run: DashboardSummary["latest_payroll_run"] }) {
  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CircleDollarSign className="size-4 text-primary" /> Payroll
        </CardTitle>
        <CardDescription>
          {run ? `${MONTHS[run.period_month - 1]} ${run.period_year} run` : "No payroll run yet."}
        </CardDescription>
        <CardAction>
          {run ? (
            <Badge variant={RUN_VARIANTS[run.status] ?? "muted"} className="capitalize">
              {run.status.replace("_", " ")}
            </Badge>
          ) : (
            <CardLink href="/payroll">Start a run</CardLink>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        {run ? (
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">People</p>
              <p className="font-semibold tabular-nums">{run.employee_count}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net pay</p>
              <p className="font-semibold">
                <Money value={run.total_net} />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pay date</p>
              <p className="font-semibold">{run.payment_date ? formatDay(run.payment_date) : "—"}</p>
            </div>
            <div className="col-span-3">
              <CardLink href={`/payroll/runs/${run.id}`}>Open run</CardLink>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Figures appear here once a run is computed — nothing on this card is estimated.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const RETURN_LABELS: Record<DashboardSummary["filings"][number]["return_type"], string> = {
  pf_ecr: "PF (ECR)",
  esic: "ESIC",
  professional_tax: "Professional Tax",
  tds_24q: "TDS (24Q)",
};

const FILING_VARIANTS: Record<string, BadgeVariant> = {
  filed: "success",
  generated: "secondary",
  rejected: "destructive",
  blocked: "destructive",
};

/** Where last month's statutory returns stand, from the filing records. HR only. */
export function ComplianceCard({ filings }: { filings: DashboardSummary["filings"] }) {
  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-primary" /> Statutory returns
        </CardTitle>
        <CardDescription>Last month&apos;s returns, from the filing register.</CardDescription>
        <CardAction>
          <CardLink href="/payroll/filings">Filings</CardLink>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {filings.map((filing) => (
            <div
              key={filing.return_type}
              className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2.5"
            >
              <span className="min-w-0">
                <span className="block text-sm text-foreground">{RETURN_LABELS[filing.return_type]}</span>
                <span className="block text-xs text-muted-foreground">
                  {filing.period}
                  {filing.due_on ? ` · due ${formatDay(filing.due_on)}` : ""}
                </span>
              </span>
              <Badge
                variant={filing.status ? (FILING_VARIANTS[filing.status] ?? "muted") : "warning"}
                className="shrink-0"
              >
                {filing.status
                  ? filing.status.charAt(0).toUpperCase() + filing.status.slice(1)
                  : "Not generated"}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Birthdays and work anniversaries in the next 30 days — only for people who
 * opted in to celebrating them (Culture → privacy), so the list can be empty
 * for a reason the API states.
 */
export function CelebrationsCard() {
  const { data, error, isLoading } = useApiQuery<Celebrations>("/employees/celebrations?days=30");
  const items = (data?.items ?? []).slice(0, 6);
  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PartyPopper className="size-4 text-primary" /> <Tr text="Celebrations" />
        </CardTitle>
        <CardDescription>Birthdays and work anniversaries, next 30 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error.detail}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {data?.note || "Nothing to celebrate in the next 30 days."}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={`${item.employee_id}-${item.kind}`}
                className="flex items-center justify-between gap-3"
              >
                <PersonCell
                  name={item.name}
                  photoUrl={item.photo_url}
                  subtitle={
                    item.kind === "birthday"
                      ? "Birthday"
                      : `${item.years ?? ""} year${item.years === 1 ? "" : "s"} at the company`
                  }
                />
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  {item.kind === "birthday" ? <Cake className="size-3.5" /> : <PartyPopper className="size-3.5" />}
                  {formatDay(item.on_date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface QuickLink {
  label: string;
  url: string;
}

/** The workspace's own links. Admins edit them here; https or a page inside AskMira only. */
export function QuickLinksCard({ canEdit }: { canEdit: boolean }) {
  const { data, reload } = useApiQuery<{ links: QuickLink[]; is_default: boolean }>("/dashboard/quick-links");
  const [editing, setEditing] = useState(false);
  const links = data?.links ?? [];
  if (!data || (links.length === 0 && !canEdit)) return null;

  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Link2 className="size-4 text-primary" /> <Tr text="Quick links" />
          </span>
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label="Edit quick links">
              <Pencil />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2">
          {links.map((link) => (
            <li key={`${link.label}-${link.url}`}>
              <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                {link.url.startsWith("/") ? (
                  <Link href={link.url}>{link.label}</Link>
                ) : (
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                )}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
      {canEdit && (
        <QuickLinksDialog
          open={editing}
          links={links}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
    </Card>
  );
}

function QuickLinksDialog({
  open,
  links,
  onClose,
  onSaved,
}: {
  open: boolean;
  links: QuickLink[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<QuickLink[]>(links);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setRows(links);
  }, [open, links]);

  const save = async (reset: boolean) => {
    setBusy(true);
    try {
      await put("/dashboard/quick-links", { links: reset ? null : rows });
      toast.success(reset ? "Back to the default links." : "Quick links saved.");
      onSaved();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The links were not saved.");
    } finally {
      setBusy(false);
    }
  };

  const valid = rows.every((row) => row.label.trim() && row.url.trim());
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick links</DialogTitle>
          <DialogDescription>
            Shown on everyone&apos;s home page. A page here starts with /, anything else needs https://.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {rows.map((row, index) => (
            <div key={index} className="flex gap-2">
              <Input
                aria-label={`Link ${index + 1} label`}
                placeholder="Label"
                maxLength={60}
                value={row.label}
                onChange={(event) =>
                  setRows((prev) => prev.map((r, i) => (i === index ? { ...r, label: event.target.value } : r)))
                }
              />
              <Input
                aria-label={`Link ${index + 1} address`}
                placeholder="/time or https://"
                maxLength={500}
                value={row.url}
                onChange={(event) =>
                  setRows((prev) => prev.map((r, i) => (i === index ? { ...r, url: event.target.value } : r)))
                }
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remove link"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={rows.length >= 12}
            onClick={() => setRows((prev) => [...prev, { label: "", url: "" }])}
          >
            <Plus /> Add a link
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => void save(true)}>
            Reset to defaults
          </Button>
          <Button disabled={busy || !valid} onClick={() => void save(false)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Who is out today, for everyone. Why is shown only where the API allows it. */
export function WhosOutTodayCard() {
  const [today] = useState(() => toISODate(new Date()));
  const { data, error, isLoading } = useApiQuery<WhoIsOut[]>(`/leave/who-is-out?start=${today}&end=${today}`);
  const people = (data ?? []).filter((entry) => entry.status === "approved");
  const shown = people.slice(0, 6);
  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palmtree className="size-4 text-primary" /> <Tr text="Who's out today" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error.detail}</p>
        ) : people.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            <Tr text="Nobody is on approved leave today." />
          </p>
        ) : (
          <ul className="space-y-3">
            {shown.map((entry) => (
              <li key={`${entry.employee_id}-${entry.start_date}`}>
                <PersonCell
                  name={entry.employee_name}
                  photoUrl={entry.photo_url}
                  subtitle={
                    entry.is_half_day
                      ? "Half day"
                      : entry.start_date === entry.end_date
                        ? "Today"
                        : `Back after ${formatDay(entry.end_date)}`
                  }
                />
              </li>
            ))}
          </ul>
        )}
        {people.length > shown.length && (
          <p className="mt-3 text-xs text-muted-foreground">and {people.length - shown.length} more</p>
        )}
        <div className="mt-3">
          <CardLink href="/time">Team calendar</CardLink>
        </div>
      </CardContent>
    </Card>
  );
}
