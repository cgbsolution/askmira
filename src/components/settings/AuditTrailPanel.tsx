"use client";

import { Bot, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  const entityTypes = useApiQuery<string[]>("/admin/audit-logs/entity-types");

  const path = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (entityType !== ANY) params.set("entity_type", entityType);
    if (action !== ANY) params.set("action", action);
    if (aiOnly) params.set("actor_type", "ai_companion");
    if (search.trim()) params.set("search", search.trim());
    return `/admin/audit-logs?${params.toString()}`;
  }, [entityType, action, aiOnly, search, page]);

  const { data, error, isLoading, reload } = useApiQuery<Page<AuditLogEntry>>(path);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Any filter change puts you back on page one; page 7 of a new filter is meaningless. */
  const onFilter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <DataPanel
      title="Audit trail"
      description={
        total > 0
          ? `${total.toLocaleString("en-IN")} entries. Insert-only: nothing here can be edited or removed, by anyone.`
          : "Insert-only: nothing here can be edited or removed, by anyone."
      }
      toolbar={
        <>
          <Input
            value={search}
            onChange={(event) => onFilter(setSearch)(event.target.value)}
            placeholder="Search the summary"
            aria-label="Search the audit trail"
            className="max-w-xs"
          />
          <Select value={entityType} onValueChange={onFilter(setEntityType)}>
            <SelectTrigger className="w-48" aria-label="Filter by record type">
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
            <SelectTrigger className="w-52" aria-label="Filter by action">
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
            onClick={() => onFilter(setAiOnly)(!aiOnly)}
            aria-pressed={aiOnly}
          >
            <Bot /> AI actions only
          </Button>
        </>
      }
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{
        icon: ScrollText,
        title: "Nothing matches those filters",
        description: "Widen the record type or action, or clear the search.",
      }}
      footer={
        total > PAGE_SIZE ? (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
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
        ) : undefined
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">When</TableHead>
            <TableHead className="w-48">Action</TableHead>
            <TableHead>What happened</TableHead>
            <TableHead className="w-32">By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="text-xs text-muted-foreground">
                {formatDateTime(row.created_at)}
              </TableCell>
              <TableCell>
                <Badge variant={EMPHASISED.has(row.action) ? "default" : "outline"}>
                  {ACTION_LABEL.get(row.action) ?? row.action}
                </Badge>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {row.entity_type}
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {row.summary ?? <span className="text-muted-foreground">No summary recorded</span>}
                {row.ai_context && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Mira acted here — the contributing signals are on the record itself.
                  </div>
                )}
              </TableCell>
              <TableCell>
                {row.actor_type === "ai_companion" ? (
                  <Badge variant="secondary">
                    <Bot /> Mira
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">{row.actor_type}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataPanel>
  );
}
