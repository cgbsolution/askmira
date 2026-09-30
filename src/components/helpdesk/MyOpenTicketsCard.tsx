"use client";

import { ArrowRight, LifeBuoy } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { MyHelpdeskSummary } from "@/lib/types/helpdesk";
import { formatDateTime } from "@/lib/utils";

import { TicketStatusBadge } from "./shared";

/**
 * Home dashboard card: how many of the person's helpdesk tickets are open, and
 * the three most recent. Everything shown is from `/helpdesk/me/summary`; while
 * it loads the card shows skeletons, never a placeholder count.
 */
export function MyOpenTicketsCard({ className }: { className?: string }) {
  const { data, error, isLoading } = useApiQuery<MyHelpdeskSummary>("/helpdesk/me/summary");

  return (
    <Card tier="tier2" className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LifeBuoy className="size-4 text-primary" /> My tickets
        </CardTitle>
        <CardDescription>
          {data
            ? data.open_count === 0
              ? "Nothing open with HR."
              : `${data.open_count} open${data.waiting_on_you > 0 ? ` · ${data.waiting_on_you} waiting on you` : ""}`
            : error
              ? "Your tickets could not be loaded."
              : "Loading…"}
        </CardDescription>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link href="/helpdesk">
              Open <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : data && data.latest.length > 0 ? (
          <ul className="divide-y divide-border">
            {data.latest.map((ticket) => (
              <li key={ticket.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {ticket.ticket_number} · {formatDateTime(ticket.last_activity_at)}
                  </p>
                </div>
                <TicketStatusBadge status={ticket.status} forRequester />
              </li>
            ))}
          </ul>
        ) : data ? (
          <p className="text-sm text-muted-foreground">
            Need a letter, a salary answer or a new ID card? Raise a ticket from My tickets.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
