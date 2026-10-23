"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Bot } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
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
import type { AuditAction, AuditLogEntry } from "@/lib/types/admin";
import type { Page } from "@/lib/types";

import { formatDateTime } from "./settingsShared";

const ANY = "__any__";
const PAGE_SIZE = 50;

const ACTIONS: { value: AuditAction; label: string }[] = [
  { value: "create", label: "Created" },
  { value: "update", label: "Updated" },
  { value: "delete", label: "Deleted" },
  { value: "approve", label: "Approved" },
  { value: "reject", label: "Rejected" },
  { value: "login", label: "Signed in" },
  { value: "logout", label: "Signed out" },
  { value: "login_failed", label: "Sign-in failed" },
  { value: "export", label: "Exported" },
  { value: "sensitive_read", label: "Read restricted data" },
  { value: "permission_change", label: "Permission changed" },
  { value: "ai_action", label: "AI action" },
  { value: "rule_change", label: "Statutory rule changed" },
];

const ACTION_LABEL = new Map(ACTIONS.map((action) => [action.value, action.label]));

/** Actions worth making visually distinct in a long list. */
const EMPHASISED = new Set<AuditAction>([
  "permission_change",
  "delete",
  "export",
  "sensitive_read",
  "rule_change",
  "login_failed",
]);

const COLUMNS: ColumnDef<AuditLogEntry>[] = [
  {
    accessorKey: "created_at",
    header: "When",
    meta: {
      className: "w-44",
      cellClassName: "text-xs text-muted-foreground",
      text: (row) => formatDateTime(row.created_at),
    },
    cell: ({ row }) => formatDateTime(row.original.created_at),
  },
  {
    accessorKey: "action",
    header: "Action",
    meta: {
      className: "w-48",
      text: (row) => `${ACTION_LABEL.get(row.action) ?? row.action} · ${row.entity_type}`,
    },
    cell: ({ row }) => (
      <>
        <Badge variant={EMPHASISED.has(row.original.action) ? "default" : "outline"}>
          {ACTION_LABEL.get(row.original.action) ?? row.original.action}
        </Badge>
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">{row.original.entity_type}</div>
      </>
    ),
  },
  {
    accessorKey: "summary",
    header: "What happened",
    meta: { cellClassName: "text-sm" },
    cell: ({ row }) => (
      <>
        {row.original.summary ?? <span className="text-muted-foreground">No summary recorded</span>}
        {row.original.ai_context && (
          <div className="mt-1 text-xs text-muted-foreground">
            Mira acted here — the contributing signals are on the record itself.
          </div>
        )}
      </>
    ),
  },
  {
    accessorKey: "actor_type",
    header: "By",
    meta: { className: "w-32", text: (row) => (row.actor_type === "ai_companion" ? "Mira" : row.actor_type) },
    cell: ({ row }) =>
      row.original.actor_type === "ai_companion" ? (
        <Badge variant="secondary">
          <Bot /> Mira
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">{row.original.actor_type}</span>
      ),
  },
];

/**
 * The audit trail.
 *
 * Insert-only by construction — there is no update or delete endpoint behind
 * this screen and none should be added — so this is a reader with filters, not
 * a manager. `sensitive_read` and `export` are kept distinct because "who
 * looked at payroll" and "who took a copy of payroll" are different questions.
 */
export function AuditTrailPanel() {
  const [entityType, setEntityType] = useState(ANY);
  const [action, setAction] = useState(ANY);
  const [aiOnly, setAiOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const entityTypes = useApiQuery<string[]>("/admin/audit-logs/entity-types");

  const path = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (entityType !== ANY) params.set("entity_type", entityType);
    if (action !== ANY) params.set("action", action);
    if (aiOnly) params.set("actor_type", "ai_companion");
    if (search.trim()) params.set("search", search.trim());
    return `/admin/audit-logs?${params.toString()}`;
  }, [entityType, action, aiOnly, search, page, pageSize]);

  const { data, error, isLoading, reload } = useApiQuery<Page<AuditLogEntry>>(path);

  /** Any filter change puts you back on page one; page 7 of a new filter is meaningless. */
  const onFilter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <DataTable
      title="Audit trail"
      description="Insert-only: nothing here can be edited or removed, by anyone."
      columns={COLUMNS}
      data={data?.items ?? []}
      noun="entries"
      exportName="audit-trail"
      searchPlaceholder="Search the summary"
      search={search}
      onSearchChange={onFilter(setSearch)}
      filters={
        <>
          <Select value={entityType} onValueChange={onFilter(setEntityType)}>
            <SelectTrigger className="h-9 w-48" aria-label="Filter by record type">
              <SelectValue placeholder="Any record" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any record type</SelectItem>
              {(entityTypes.data ?? []).map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={onFilter(setAction)}>
            <SelectTrigger className="h-9 w-52" aria-label="Filter by action">
              <SelectValue placeholder="Any action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any action</SelectItem>
              {ACTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={aiOnly ? "default" : "outline"}
            size="sm"
            className="h-9"
            onClick={() => onFilter(setAiOnly)(!aiOnly)}
            aria-pressed={aiOnly}
          >
            <Bot /> AI actions only
          </Button>
        </>
      }
      filtered={entityType !== ANY || action !== ANY || aiOnly}
      emptyMessage="Nothing matches those filters. Widen the record type or action, or clear the search."
      isLoading={isLoading}
      error={error?.detail}
      onRetry={reload}
      server={{
        page,
        pageSize,
        total: data?.total ?? 0,
        onPageChange: setPage,
        onPageSizeChange: (size) => {
          setPageSize(size);
          setPage(1);
        },
      }}
    />
  );
}
