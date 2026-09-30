"use client";

import { CalendarDays, Loader2, MessageSquare } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { LeaveDocumentButton } from "@/components/time/LeaveDocumentButton";
import {
  approvalSummary,
  halfDayLabel,
  LeaveStatusBadge,
} from "@/components/time/LeaveStatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError, get, post } from "@/lib/api";
import type { LeaveRequest, LeaveRequestStatus, Page } from "@/lib/types";
import { formatDateRange, initials, pluralDays } from "@/lib/utils";

type Scope = "mine" | "all";

const PAGE_SIZE = 20;

/**
 * Leave requests: your own, or — for managers and HR — everybody you can see.
 *
 * Which rows come back is the server's decision (self, reporting line, or
 * everybody for HR); the scope switch only narrows it to your own.
 */
export function RequestsTable({
  employeeId,
  canSeeOthers,
  version,
  onChanged,
}: {
  employeeId: string | null;
  canSeeOthers: boolean;
  version: number;
  onChanged: () => void;
}) {
  const [scope, setScope] = useState<Scope>(employeeId ? "mine" : "all");
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | "any">("any");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelling, setCancelling] = useState<LeaveRequest | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (scope === "mine" && employeeId) params.set("employee_id", employeeId);
    if (statusFilter !== "any") params.set("status", statusFilter);
    try {
      const result = await get<Page<LeaveRequest>>(`/leave/requests?${params}`);
      setRows(result.items);
      setTotal(result.total);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not load leave requests.");
      setRows([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [scope, statusFilter, employeeId, page]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const confirmCancel = async () => {
    if (!cancelling) return;
    setIsCancelling(true);
    try {
      await post<LeaveRequest>(`/leave/requests/${cancelling.id}/cancel`);
      toast.success("Request cancelled");
      setCancelling(null);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not cancel the request.");
    } finally {
      setIsCancelling(false);
    }
  };

  const showPerson = scope === "all";

  return (
    <Card tier="tier1" className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        {canSeeOthers && employeeId && (
          <Select
            value={scope}
            onValueChange={(value) => {
              setScope(value as Scope);
              setPage(1);
            }}
          >
            <SelectTrigger size="sm" className="w-44" aria-label="Whose requests">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mine">My requests</SelectItem>
              <SelectItem value="all">Everyone I can see</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as LeaveRequestStatus | "any");
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-36" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Declined</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">
          {isLoading ? "Loading…" : `${total} ${total === 1 ? "request" : "requests"}`}
        </span>
      </div>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No leave requests"
            description={
              scope === "mine"
                ? "Requests you make show up here with where each one stands."
                : "Nobody you can see has requested leave with these filters."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {showPerson && <TableHead>Employee</TableHead>}
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Approval</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  {showPerson && (
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-7">
                          {row.employee_photo_url && (
                            <AvatarImage src={row.employee_photo_url} alt="" />
                          )}
                          <AvatarFallback className="text-[10px]">
                            {initials(row.employee_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-foreground">{row.employee_name}</span>
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground">{row.leave_type_name}</span>
                      {row.reason && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <MessageSquare
                              className="size-3.5 text-muted-foreground"
                              aria-label="Has a note"
                            />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">{row.reason}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateRange(row.start_date, row.end_date)}
                    {row.is_half_day && ` · ${halfDayLabel(row.half_day_session)}`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {pluralDays(row.total_days)}
                  </TableCell>
                  <TableCell>
                    <LeaveStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    <span>{approvalSummary(row)}</span>
                    {row.decision_note && (
                      <span className="block truncate text-xs italic">“{row.decision_note}”</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {row.has_document && <LeaveDocumentButton requestId={row.id} compact />}
                      {row.can_cancel && (
                        <Button variant="ghost" size="sm" onClick={() => setCancelling(row)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {!isLoading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <span className="text-sm text-muted-foreground">
            Page {page} of {lastPage}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= lastPage}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={cancelling !== null} onOpenChange={(open) => !open && setCancelling(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this request?</DialogTitle>
            <DialogDescription>
              {cancelling &&
                `${cancelling.leave_type_name}, ${formatDateRange(
                  cancelling.start_date,
                  cancelling.end_date,
                )}. ${
                  cancelling.status === "approved"
                    ? `The ${pluralDays(cancelling.total_days)} go back into the balance, and the approver is told.`
                    : "The approver is told it was withdrawn."
                }`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmCancel()}
              disabled={isCancelling}
            >
              {isCancelling && <Loader2 className="animate-spin" />}
              Cancel request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
