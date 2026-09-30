"use client";

import { ArrowRight, Headset, LifeBuoy, UserX } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ADMIN, HR } from "@/lib/access";
import type {
  HelpdeskCategory,
  MyHelpdeskSummary,
  TicketStatus,
  TicketSummary,
} from "@/lib/types/helpdesk";
import { formatDateTime } from "@/lib/utils";

import { MyTicketSheet } from "./MyTicketSheet";
import { RaiseTicketDialog } from "./RaiseTicketDialog";
import { ConfidentialBadge, TicketStatusBadge } from "./shared";

type Tab = "active" | "resolved" | "done" | "all";

const TAB_STATUSES: Record<Tab, TicketStatus[] | null> = {
  active: ["open", "in_progress", "waiting_on_employee"],
  resolved: ["resolved"],
  done: ["closed", "cancelled"],
  all: null,
};

const TAB_EMPTY: Record<Tab, string> = {
  active: "Nothing open. Raise a ticket whenever you need something from HR.",
  resolved: "No tickets are waiting for you to confirm or rate.",
  done: "No closed or cancelled tickets yet.",
  all: "You have not raised a ticket yet.",
};

/**
 * My tickets: everything the person has asked HR for, and the conversation on
 * each. Tier 2 — this is somebody asking for help, not a ledger.
 */
export function MyTicketsScreen() {
  const { user, hasRole, isLoading: authLoading } = useAuth();
  const hasEmployee = Boolean(user?.employee_id);
  const isHr = hasRole(...HR);

  const tickets = useApiQuery<TicketSummary[]>(hasEmployee ? "/helpdesk/tickets/mine" : null);
  const categories = useApiQuery<HelpdeskCategory[]>("/helpdesk/categories");
  const summary = useApiQuery<MyHelpdeskSummary>("/helpdesk/me/summary");
  const [tab, setTab] = useState<Tab>("active");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = tickets.data ?? [];
  const inTab = (value: Tab) => {
    const statuses = TAB_STATUSES[value];
    return statuses ? rows.filter((row) => statuses.includes(row.status)) : rows;
  };

  const body = () => {
    if (authLoading) return <LoadingCard />;
    if (!hasEmployee) {
      return (
        <Card tier="tier2">
          <EmptyState
            tier="tier2"
            icon={UserX}
            title="Your sign-in is not linked to an employee record"
            description="Helpdesk tickets belong to an employee. Ask HR to link your account to your employee record."
          />
        </Card>
      );
    }
    if (categories.data && categories.data.length === 0) {
      return (
        <Card tier="tier2">
          <EmptyState
            tier="tier2"
            icon={LifeBuoy}
            title="The helpdesk is not set up yet"
            description={
              hasRole(...ADMIN)
                ? "Add categories — what employees can ask about and who handles it — and the Raise a ticket button switches on."
                : "HR has not added any helpdesk categories yet. Until then, reach HR the usual way."
            }
            action={
              hasRole(...ADMIN) ? (
                <Button asChild>
                  <Link href="/helpdesk/categories">Set up categories</Link>
                </Button>
              ) : undefined
            }
          />
        </Card>
      );
    }
    if (tickets.error && !tickets.data) {
      return (
        <Card tier="tier2">
          <ErrorState message={tickets.error.detail} onRetry={tickets.reload} />
        </Card>
      );
    }
    if (!tickets.data) return <LoadingCard />;

    return (
      <Tabs value={tab} onValueChange={(next) => setTab(next as Tab)}>
        <div className="no-scrollbar overflow-x-auto">
          <TabsList>
            <TabsTrigger value="active">
              Open
              <Count value={inTab("active").length} />
            </TabsTrigger>
            <TabsTrigger value="resolved">
              Resolved
              <Count value={inTab("resolved").length} />
            </TabsTrigger>
            <TabsTrigger value="done">Closed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </div>
        {(Object.keys(TAB_STATUSES) as Tab[]).map((value) => (
          <TabsContent key={value} value={value} className="mt-4">
            <TicketList rows={inTab(value)} empty={TAB_EMPTY[value]} onOpen={setOpenId} />
          </TabsContent>
        ))}
      </Tabs>
    );
  };

  return (
    <PageShell
      tier="tier2"
      title="My tickets"
      description="Ask HR for a letter, a salary answer, an ID card or anything else, and follow the conversation in one place."
      actions={
        hasEmployee && categories.data && categories.data.length > 0 ? (
          <RaiseTicketDialog
            categories={categories.data}
            onCreated={(created) => {
              tickets.reload();
              summary.reload();
              setTab("active");
              setOpenId(created.id);
            }}
          />
        ) : undefined
      }
    >
      {summary.data?.is_agent && !isHr && (
        <Alert>
          <Headset />
          <AlertTitle>You handle helpdesk tickets</AlertTitle>
          <AlertDescription>
            <p>Tickets in the categories you own are waiting in your queue.</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/helpdesk/assigned">
                Open my ticket queue <ArrowRight />
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {summary.data && summary.data.waiting_on_you > 0 && (
        <Alert>
          <LifeBuoy />
          <AlertTitle>
            {summary.data.waiting_on_you === 1
              ? "HR is waiting on your answer on one ticket"
              : `HR is waiting on your answer on ${summary.data.waiting_on_you} tickets`}
          </AlertTitle>
          <AlertDescription>Open it below and reply so they can carry on.</AlertDescription>
        </Alert>
      )}
      {body()}
      <MyTicketSheet
        ticketId={openId}
        onOpenChange={(open) => !open && setOpenId(null)}
        onChanged={() => {
          tickets.reload();
          summary.reload();
        }}
      />
    </PageShell>
  );
}

function Count({ value }: { value: number }) {
  if (value === 0) return null;
  return (
    <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[11px] font-semibold tabular-nums text-accent-foreground">
      {value}
    </span>
  );
}

function TicketList({
  rows,
  empty,
  onOpen,
}: {
  rows: TicketSummary[];
  empty: string;
  onOpen: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <Card tier="tier2">
        <EmptyState tier="tier2" icon={LifeBuoy} title="No tickets here" description={empty} />
      </Card>
    );
  }
  return (
    <Card tier="tier2" className="py-2">
      <CardContent className="overflow-x-auto px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Handled by</TableHead>
              <TableHead>Last update</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => onOpen(row.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(row.id);
                  }
                }}
              >
                <TableCell className="max-w-80">
                  <p className="truncate font-medium text-foreground">{row.subject}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{row.ticket_number}</p>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>{row.category_name}</span>
                    {row.is_confidential && <ConfidentialBadge />}
                  </div>
                </TableCell>
                <TableCell>
                  <TicketStatusBadge status={row.status} forRequester />
                </TableCell>
                <TableCell>
                  {row.assignee_name ?? <span className="text-muted-foreground">Not yet assigned</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {formatDateTime(row.last_activity_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LoadingCard() {
  return (
    <Card tier="tier2">
      <CardContent className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
