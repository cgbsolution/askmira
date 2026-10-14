"use client";

import { ArrowRight, CircleSlash, Inbox } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { ApprovalInbox } from "@/lib/types/approvals";
import { cn, formatDate, formatDateTime, parseISODate } from "@/lib/utils";

import { DelegationCard } from "./DelegationCard";

const ALL = "__all__";

/**
 * Approvals — everything waiting on the signed-in person, across modules.
 *
 * Read-only by design: each row links to the page where it is decided, because
 * that module's own endpoint is the authority on the decision and its own page
 * shows the context the decision needs. An approve button here would be a
 * second, context-free way to approve a loan. A source that could not be read
 * says so rather than showing a reassuring zero.
 */
export function ApprovalsScreen() {
  const { data, error, isLoading, reload } = useApiQuery<ApprovalInbox>("/approvals");
  const [source, setSource] = useState(ALL);

  const items = useMemo(
    () => (data?.items ?? []).filter((item) => source === ALL || item.source === source),
    [data, source],
  );
  const sources = (data?.sources ?? []).filter((row) => row.count > 0 || !row.available);
  const unavailable = (data?.sources ?? []).filter((row) => !row.available);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <PageShell
      title="Approvals"
      description="Everything waiting on you, oldest first. Each is decided on its own page, with its full context."
    >
      {unavailable.length > 0 && (
        <Alert variant="warning">
          <CircleSlash />
          <AlertTitle>Some queues could not be read</AlertTitle>
          <AlertDescription>
            {unavailable.map((row) => row.label).join(", ")} — so the count below may be short.
            Check those pages directly.
          </AlertDescription>
        </Alert>
      )}

      <DelegationCard />

      <DataPanel
        title="Waiting on you"
        description={data ? `${data.total} item${data.total === 1 ? "" : "s"}.` : undefined}
        toolbar={
          sources.length > 1 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by queue">
              <Button
                size="sm"
                variant={source === ALL ? "default" : "outline"}
                aria-pressed={source === ALL}
                onClick={() => setSource(ALL)}
              >
                All <Badge variant="secondary">{data?.total ?? 0}</Badge>
              </Button>
              {sources
                .filter((row) => row.available)
                .map((row) => (
                  <Button
                    key={row.key}
                    size="sm"
                    variant={source === row.key ? "default" : "outline"}
                    aria-pressed={source === row.key}
                    onClick={() => setSource(row.key)}
                  >
                    {row.label} <Badge variant="secondary">{row.count}</Badge>
                  </Button>
                ))}
            </div>
          ) : undefined
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={items.length === 0}
        empty={{
          icon: Inbox,
          title: "Nothing is waiting on you",
          description: "New requests that need your decision appear here.",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Queue</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Decide</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const overdue = item.due_on !== null && parseISODate(item.due_on) < today;
              return (
                <TableRow key={`${item.source}-${item.id}`}>
                  <TableCell>
                    <div className="font-medium text-foreground">{item.title}</div>
                    {(item.subject_name || item.detail) && (
                      <div className="text-xs text-muted-foreground">
                        {[item.subject_name, item.detail].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.source_label}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(item.submitted_at)}
                  </TableCell>
                  <TableCell className={cn("text-sm", overdue && "font-medium text-destructive")}>
                    {item.due_on ? formatDate(item.due_on) : "—"}
                    {overdue && <div className="text-xs">Overdue</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={item.link}>
                        Open <ArrowRight />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataPanel>
    </PageShell>
  );
}
