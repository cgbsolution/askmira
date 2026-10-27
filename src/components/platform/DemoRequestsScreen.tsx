"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Inbox, Loader2, Mail, Phone } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, patch } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

type DemoStatus = "new" | "contacted" | "qualified" | "closed";

interface DemoRequest {
  id: string;
  created_at: string;
  full_name: string;
  work_email: string;
  company: string;
  phone: string | null;
  company_size: string;
  role: string | null;
  interests: string[];
  message: string | null;
  topic: string;
  source_path: string | null;
  status: DemoStatus;
  notes: string | null;
  handled_by_name: string | null;
  handled_at: string | null;
}

const STATUS_LABEL: Record<DemoStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  closed: "Closed",
};

const STATUS_VARIANT = {
  new: "warning",
  contacted: "secondary",
  qualified: "success",
  closed: "muted",
} as const;

const TOPIC_LABEL: Record<string, string> = {
  demo: "Demo",
  pricing: "Pricing",
  partnership: "Partnership",
  other: "Other",
};

const INTEREST_LABEL: Record<string, string> = {
  payroll: "Payroll",
  attendance: "Attendance",
  core_hr: "Core HR",
  hiring: "Hiring",
  performance: "Performance",
  engagement: "Engagement",
  ai: "Ask Mira",
};

const NOTES_LIMIT = 4000;

/**
 * Requests sent from the marketing website's "Book a demo" form. Only the
 * platform's super admin sees them; status changes and notes are audited.
 */
export function DemoRequestsScreen() {
  const [statusFilter, setStatusFilter] = useState<"all" | DemoStatus>("all");
  const path = statusFilter === "all" ? "/platform/demo-requests" : `/platform/demo-requests?status_filter=${statusFilter}`;
  const { data, error, isLoading, reload, setData } = useApiQuery<DemoRequest[]>(path);
  const [open, setOpen] = useState<DemoRequest | null>(null);

  const columns = useMemo<ColumnDef<DemoRequest>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: "Received",
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.created_at)}</span>,
      },
      {
        accessorKey: "full_name",
        header: "Person",
        cell: ({ row }) => <PersonCell name={row.original.full_name} subtitle={row.original.work_email} size="sm" />,
      },
      {
        accessorKey: "company",
        header: "Company",
        cell: ({ row }) => (
          <>
            <p className="font-medium text-foreground">{row.original.company}</p>
            <p className="text-xs text-muted-foreground">{row.original.company_size} employees</p>
          </>
        ),
      },
      {
        accessorKey: "topic",
        header: "Asked for",
        cell: ({ row }) => TOPIC_LABEL[row.original.topic] ?? row.original.topic,
      },
      {
        id: "interests",
        header: "Interested in",
        meta: { text: false },
        cell: ({ row }) =>
          row.original.interests.length ? (
            <div className="flex max-w-64 flex-wrap gap-1">
              {row.original.interests.map((i) => (
                <Badge key={i} variant="outline">
                  {INTEREST_LABEL[i] ?? i}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge>,
      },
    ],
    [],
  );

  const newCount = data?.filter((r) => r.status === "new").length ?? 0;

  return (
    <PageShell
      title="Demo requests"
      eyebrow="Platform"
      icon={Inbox}
      description="People who asked for a demo, pricing or a conversation on the AskMira website. Follow up, then record what happened."
    >
      <DataTable
        title="Requests from the website"
        description={
          statusFilter === "all" && newCount > 0
            ? `${newCount} new ${newCount === 1 ? "request is" : "requests are"} waiting for a reply.`
            : "Newest first. Click a row to open it."
        }
        columns={columns}
        data={data ?? []}
        getRowId={(row) => row.id}
        noun="requests"
        isLoading={isLoading}
        error={error?.message ?? null}
        onRetry={reload}
        selectable={false}
        exportName="demo-requests"
        searchPlaceholder="Search name, email or company"
        onRowClick={setOpen}
        filtered={statusFilter !== "all"}
        filters={
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | DemoStatus)}>
            <SelectTrigger className="w-40" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(STATUS_LABEL) as DemoStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        empty={{
          icon: Inbox,
          title: statusFilter === "all" ? "No demo requests yet" : `No ${STATUS_LABEL[statusFilter].toLowerCase()} requests`,
          description: "Requests sent from the website's demo form appear here.",
        }}
      />
      <RequestSheet
        request={open}
        onClose={() => setOpen(null)}
        onSaved={(saved) => {
          setData((rows) => (rows ? rows.map((r) => (r.id === saved.id ? saved : r)) : rows));
          setOpen(null);
          if (statusFilter !== "all") reload();
        }}
      />
    </PageShell>
  );
}

function RequestSheet({
  request,
  onClose,
  onSaved,
}: {
  request: DemoRequest | null;
  onClose: () => void;
  onSaved: (saved: DemoRequest) => void;
}) {
  const [status, setStatus] = useState<DemoStatus>("new");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Load the form whenever a request opens; forget it when the sheet closes, so
  // reopening the same request after discarding shows what is saved.
  if (!request && loadedId !== null) setLoadedId(null);
  if (request && request.id !== loadedId) {
    setLoadedId(request.id);
    setStatus(request.status);
    setNotes(request.notes ?? "");
  }

  const dirty = request !== null && (status !== request.status || notes.trim() !== (request.notes ?? "").trim());

  function requestClose() {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  async function save() {
    if (!request || saving || !dirty) return;
    setSaving(true);
    try {
      const saved = await patch<DemoRequest>(`/platform/demo-requests/${request.id}`, {
        status,
        notes: notes.trim() || null,
      });
      toast.success(`${saved.company}: saved`);
      onSaved(saved);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Sheet open={request !== null} onOpenChange={(next) => (next ? undefined : requestClose())}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {request && (
            <>
              <SheetHeader>
                <SheetTitle>{request.company}</SheetTitle>
                <SheetDescription>
                  {request.full_name}
                  {request.role ? ` · ${request.role}` : ""} · {request.company_size} employees
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4">
                <div className="grid gap-2 text-sm">
                  <a className="flex items-center gap-2 text-primary hover:underline" href={`mailto:${request.work_email}`}>
                    <Mail className="size-4" /> {request.work_email}
                  </a>
                  {request.phone && (
                    <a className="flex items-center gap-2 text-primary hover:underline" href={`tel:${request.phone.replace(/\s+/g, "")}`}>
                      <Phone className="size-4" /> {request.phone}
                    </a>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Received</dt>
                    <dd className="font-medium">{formatDateTime(request.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Asked for</dt>
                    <dd className="font-medium">{TOPIC_LABEL[request.topic] ?? request.topic}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Sent from</dt>
                    <dd className="font-medium">{request.source_path ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Last handled</dt>
                    <dd className="font-medium">
                      {request.handled_by_name ? `${request.handled_by_name}, ${formatDateTime(request.handled_at)}` : "—"}
                    </dd>
                  </div>
                </dl>
                {request.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {request.interests.map((i) => (
                      <Badge key={i} variant="outline">
                        {INTEREST_LABEL[i] ?? i}
                      </Badge>
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Their message</p>
                  <p className="mt-1 rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                    {request.message ?? "No message."}
                  </p>
                </div>
                <FormField htmlFor="demo-status" label="Status">
                  <Select value={status} onValueChange={(v) => setStatus(v as DemoStatus)}>
                    <SelectTrigger id="demo-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABEL) as DemoStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField
                  htmlFor="demo-notes"
                  label="Notes"
                  optional
                  hint={`Only the platform team sees these. ${notes.length.toLocaleString("en-IN")} / ${NOTES_LIMIT.toLocaleString("en-IN")}`}
                >
                  <Textarea
                    id="demo-notes"
                    rows={5}
                    maxLength={NOTES_LIMIT}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Call booked, what they run today, next step…"
                  />
                </FormField>
              </div>
              <SheetFooter className="flex-row justify-end gap-2">
                <Button variant="outline" onClick={requestClose} disabled={saving}>
                  Close
                </Button>
                <Button onClick={save} disabled={!dirty || saving}>
                  {saving && <Loader2 className="animate-spin" />}
                  Save
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard your changes?"
        description="The status and notes you changed have not been saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}
