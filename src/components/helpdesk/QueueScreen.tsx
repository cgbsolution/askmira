"use client";

import { Inbox, Search } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { HR } from "@/lib/access";
import type {
  AgentOption,
  HelpdeskCategory,
  QueueSummary,
  TicketPriority,
  TicketSummary,
} from "@/lib/types/helpdesk";
import { cn, formatDateTime, formatDay } from "@/lib/utils";

import { AgentTicketSheet } from "./AgentTicketSheet";
import { RaiseTicketDialog } from "./RaiseTicketDialog";
import {
  ConfidentialBadge,
  PRIORITIES,
  PRIORITY_LABEL,
  PriorityBadge,
  STATUS_LABEL,
  SlaBadge,
  TicketStatusBadge,
  formatHours,
  relativeTime,
} from "./shared";

const ANY = "any";

const STATUS_FILTERS: [string, string][] = [
  ["active", "Open (all active)"],
  ["open", STATUS_LABEL.open],
  ["in_progress", STATUS_LABEL.in_progress],
  ["waiting_on_employee", STATUS_LABEL.waiting_on_employee],
  ["resolved", STATUS_LABEL.resolved],
  ["done", "Closed or cancelled"],
  [ANY, "Any status"],
];

/**
 * The helpdesk queue: every ticket the caller may work, most urgent first,
 * with the SLA figures above it. Tier 1 — a missed deadline here is a
 * promise to an employee broken.
 *
 * Which tickets come back is the server's decision: HR sees the shared queue,
 * a category owner sees their categories, and confidential tickets reach only
 * their owner and admins. Nobody's own tickets appear here.
 */
export function QueueScreen({ title, description }: { title: string; description: string }) {
  const { hasRole } = useAuth();
  const isHr = hasRole(...HR);

  const [status, setStatus] = useState("active");
  const [categoryId, setCategoryId] = useState(ANY);
  const [assignee, setAssignee] = useState(ANY);
  const [priority, setPriority] = useState<TicketPriority | typeof ANY>(ANY);
  const [overdue, setOverdue] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== ANY) params.set("status", status);
    if (categoryId !== ANY) params.set("category_id", categoryId);
    if (assignee !== ANY) params.set("assignee", assignee);
    if (priority !== ANY) params.set("priority", priority);
    if (overdue) params.set("overdue", "true");
    if (search) params.set("search", search);
    const query = params.toString();
    return `/helpdesk/queue${query ? `?${query}` : ""}`;
  }, [status, categoryId, assignee, priority, overdue, search]);

  const queue = useApiQuery<TicketSummary[]>(path);
  const summary = useApiQuery<QueueSummary>("/helpdesk/queue/summary");
  const agents = useApiQuery<AgentOption[]>("/helpdesk/agents");
  const categories = useApiQuery<HelpdeskCategory[]>(
    isHr ? "/helpdesk/categories?include_inactive=true" : "/helpdesk/categories",
  );

  const refresh = () => {
    queue.reload();
    summary.reload();
  };

  const filtered =
    status !== "active" ||
    categoryId !== ANY ||
    assignee !== ANY ||
    priority !== ANY ||
    overdue ||
    search !== "";

  const activeCategories = (categories.data ?? []).filter((category) => category.active);

  return (
    <PageShell
      title={title}
      description={description}
      actions={
        isHr && activeCategories.length > 0 ? (
          <RaiseTicketDialog categories={activeCategories} onCreated={refresh} onBehalf />
        ) : undefined
      }
    >
      <SummaryRow summary={summary.data} />

      <DataPanel
        title="Tickets"
        description="Active tickets first, earliest deadline first."
        isLoading={queue.isLoading && !queue.data}
        error={queue.error?.detail}
        onRetry={queue.reload}
        isEmpty={(queue.data ?? []).length === 0}
        empty={{
          icon: Inbox,
          title: filtered ? "No tickets match these filters" : "The queue is clear",
          description: filtered
            ? "Change or clear the filters to see more."
            : "No open tickets are waiting on you. New ones appear here as employees raise them.",
        }}
        toolbar={
          <>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Ticket, subject or employee"
                aria-label="Search tickets"
                className="h-8 pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger size="sm" className="w-44" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger size="sm" className="w-48" aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any category</SelectItem>
                {(categories.data ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                    {!category.active && " (inactive)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger size="sm" className="w-44" aria-label="Assignee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Anyone</SelectItem>
                <SelectItem value="me">Assigned to me</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {(agents.data ?? []).map((agent) => (
                  <SelectItem key={agent.user_id} value={agent.user_id}>
                    {agent.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as TicketPriority | typeof ANY)}
            >
              <SelectTrigger size="sm" className="w-36" aria-label="Priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any priority</SelectItem>
                {PRIORITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {PRIORITY_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch id="queue-overdue" checked={overdue} onCheckedChange={setOverdue} />
              <Label htmlFor="queue-overdue" className="text-sm font-normal">
                Overdue only
              </Label>
            </div>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {queue.data ? `${queue.data.length} ticket${queue.data.length === 1 ? "" : "s"}` : ""}
            </span>
          </>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(queue.data ?? []).map((row) => (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => setOpenId(row.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setOpenId(row.id);
                    }
                  }}
                >
                  <TableCell className="max-w-72">
                    <p className="truncate font-medium text-foreground">{row.subject}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                      {row.ticket_number}
                      {row.is_confidential && <ConfidentialBadge />}
                    </p>
                  </TableCell>
                  <TableCell>
                    <PersonCell size="sm" name={row.employee_name} subtitle={row.employee_code} />
                  </TableCell>
                  <TableCell>{row.category_name}</TableCell>
                  <TableCell>
                    <PriorityBadge priority={row.priority} />
                  </TableCell>
                  <TableCell>
                    <TicketStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <SlaBadge state={row.sla_state} />
                    {["on_track", "due_soon", "overdue"].includes(row.sla_state) && (
                      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                        Due {relativeTime(row.due_at)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.assignee_name ?? <span className="text-muted-foreground">Unassigned</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDateTime(row.last_activity_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataPanel>

      <AgentTicketSheet
        ticketId={openId}
        onOpenChange={(open) => !open && setOpenId(null)}
        onChanged={refresh}
      />
    </PageShell>
  );
}

/** The queue's figures. Each average says how many tickets it is an average of. */
function SummaryRow({ summary }: { summary: QueueSummary | null }) {
  const since = summary ? `since ${formatDay(summary.period_start)}` : "";
  const sample = (count: number) => `${count} ticket${count === 1 ? "" : "s"} ${since}`;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Figure label="Open" value={summary?.open} hint={summary ? `${summary.unassigned} unassigned` : undefined} />
      <Figure
        label="Overdue"
        value={summary?.overdue}
        tone={summary && summary.overdue > 0 ? "destructive" : undefined}
        hint={summary ? `${summary.due_soon} due soon` : undefined}
      />
      <Figure
        label="Resolved this month"
        value={summary?.resolved_this_month}
        hint={summary ? since : undefined}
      />
      <Figure
        label="Satisfaction"
        value={
          summary ? (summary.avg_satisfaction === null ? "—" : `${summary.avg_satisfaction} / 5`) : undefined
        }
        hint={summary ? sample(summary.satisfaction_sample) : undefined}
      />
      <Figure
        label="Avg first response"
        value={summary ? formatHours(summary.avg_first_response_hours) : undefined}
        hint={summary ? sample(summary.first_response_sample) : undefined}
      />
      <Figure
        label="Avg resolution time"
        value={summary ? formatHours(summary.avg_resolution_hours) : undefined}
        hint={summary ? sample(summary.resolution_sample) : undefined}
      />
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string | undefined;
  hint?: string;
  tone?: "destructive";
}) {
  return (
    <Card
      tier="tier1"
      className={cn("gap-1 px-4 py-3", tone === "destructive" && "border-destructive/30")}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold text-foreground tabular-nums",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value ?? "—"}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
