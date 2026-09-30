"use client";

import { Check, ClipboardCheck, X } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { ChangeRequestDiff } from "@/components/people/profile/ChangeRequestDiff";
import { DecisionDialog } from "@/components/people/profile/ChangeRequestsPanel";
import { CHANGE_STATUS } from "@/components/people/profile/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { ChangeRequest, ProfileChangeStatus } from "@/lib/types/people";
import { formatDate } from "@/lib/utils";

const ALL = "__all__";

/**
 * People → Profile changes (HR).
 *
 * Sensitive changes employees asked for: legal name, date of birth, PAN and
 * the other identifiers, the salary account, addresses and nominees. Approving
 * applies the change to the record there and then; a request whose record has
 * moved since it was raised is refused rather than overwriting the newer value.
 */
export function ChangeRequestsScreen() {
  const [status, setStatus] = useState<string>("pending");
  const query = status === ALL ? "" : `?status=${status}`;
  const { data, error, isLoading, reload } = useApiQuery<ChangeRequest[]>(
    `/employees/change-requests${query}`,
  );
  const [deciding, setDeciding] = useState<{ request: ChangeRequest; kind: "approve" | "reject" } | null>(null);
  const rows = data ?? [];

  return (
    <PageShell
      title="Profile changes"
      description="Changes employees asked for to their identifiers, bank account, address, nominees and legal name."
    >
      <DataPanel
        title={status === "pending" ? "Waiting for a decision" : "Requests"}
        toolbar={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Status" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CHANGE_STATUS) as ProfileChangeStatus[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {CHANGE_STATUS[key].label}
                </SelectItem>
              ))}
              <SelectItem value={ALL}>All requests</SelectItem>
            </SelectContent>
          </Select>
        }
        isLoading={isLoading}
        error={error?.detail}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: ClipboardCheck,
          title: status === "pending" ? "Nothing waiting" : "No requests",
          description:
            status === "pending"
              ? "When an employee asks to change a sensitive detail, it appears here."
              : undefined,
        }}
      >
        <ul className="grid gap-3">
          {rows.map((request) => {
            const meta = CHANGE_STATUS[request.status];
            return (
              <li key={request.id} className="grid gap-3 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      <Link className="hover:underline" href={`/people/${request.employee_id}`}>
                        {request.employee_name}
                      </Link>{" "}
                      <span className="font-mono text-xs text-muted-foreground">{request.employee_code}</span>
                    </p>
                    <p className="text-sm first-letter:uppercase">{request.section_label}</p>
                    <p className="text-xs text-muted-foreground">
                      Asked {formatDate(request.requested_at)} · {request.reason}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    {request.can_decide && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setDeciding({ request, kind: "reject" })}>
                          <X /> Reject
                        </Button>
                        <Button size="sm" onClick={() => setDeciding({ request, kind: "approve" })}>
                          <Check /> Approve
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <ChangeRequestDiff request={request} />
                {request.decided_at && request.status !== "withdrawn" && (
                  <p className="text-xs text-muted-foreground">
                    {meta.label} by {request.decided_by_name ?? "HR"} on {formatDate(request.decided_at)}
                    {request.decision_note ? ` — ${request.decision_note}` : ""}
                  </p>
                )}
                {request.status === "pending" && !request.can_decide && (
                  <p className="text-xs text-muted-foreground">
                    This is a change to your own record; another HR person decides it.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </DataPanel>
      <DecisionDialog
        request={deciding?.request ?? null}
        kind={deciding?.kind ?? "approve"}
        onOpenChange={(open) => !open && setDeciding(null)}
        onDecided={reload}
      />
    </PageShell>
  );
}
