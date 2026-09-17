"use client";

import { FileText, X } from "lucide-react";
import React, { useState } from "react";

import { Money } from "@/components/common/Money";
import {
  QueryPanel,
  useEntityName,
  useReloadOn,
} from "@/components/payroll-ops/disbursements/common";
import {
  displayPeriod,
  FilingStatusBadge,
  formatTimestamp,
  RETURN_LABEL,
  STATUS_LABEL,
} from "@/components/payroll-ops/filings/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type {
  FilingRecord,
  FilingStatus,
  LegalEntity,
  ReturnType,
} from "@/lib/types/payroll-ops";

/** Every generated, blocked, filed and rejected return, newest first. */
export function FilingsList({
  entities,
  version,
  onOpen,
}: {
  entities: LegalEntity[];
  version: number;
  onOpen: (recordId: string) => void;
}) {
  const [returnType, setReturnType] = useState<ReturnType | "any">("any");
  const [status, setStatus] = useState<FilingStatus | "any">("any");
  const [period, setPeriod] = useState("");

  const params = new URLSearchParams();
  if (returnType !== "any") params.set("return_type", returnType);
  if (status !== "any") params.set("status", status);
  if (period) params.set("period", period);
  const qs = params.toString();
  const query = useApiQuery<FilingRecord[]>(`/filings${qs ? `?${qs}` : ""}`);
  useReloadOn(version, query.reload);
  const entityName = useEntityName(entities);

  const filtered = returnType !== "any" || status !== "any" || period !== "";

  return (
    <QueryPanel
      query={query}
      loadingRows={5}
      isEmpty={(rows) => rows.length === 0}
      empty={{
        icon: FileText,
        title: filtered ? "No returns match these filters" : "No returns generated yet",
        description: filtered
          ? "Clear the filters to see every return."
          : "Generate a return above. Blocked attempts are kept here with their findings, so nothing is lost between fixing and retrying.",
      }}
      toolbar={
        <>
          <Select
            value={returnType}
            onValueChange={(value) => setReturnType(value as ReturnType | "any")}
          >
            <SelectTrigger size="sm" className="w-52" aria-label="Return">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">All returns</SelectItem>
              {(Object.keys(RETURN_LABEL) as ReturnType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {RETURN_LABEL[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => setStatus(value as FilingStatus | "any")}>
            <SelectTrigger size="sm" className="w-52" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any status</SelectItem>
              {(Object.keys(STATUS_LABEL) as FilingStatus[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="month"
            aria-label="Period"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="h-8 w-44"
          />
          {filtered && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setReturnType("any");
                setStatus("any");
                setPeriod("");
              }}
            >
              <X /> Clear filters
            </Button>
          )}
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">
            {query.data
              ? `${query.data.length} ${query.data.length === 1 ? "record" : "records"}`
              : ""}
          </span>
        </>
      }
    >
      {(rows) => (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Return</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="hidden md:table-cell">Entity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Records</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="hidden lg:table-cell">Generated</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-foreground">
                  {RETURN_LABEL[row.return_type]}
                  {row.jurisdiction && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {row.jurisdiction}
                    </span>
                  )}
                </TableCell>
                <TableCell>{displayPeriod(row.period)}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {entityName(row.legal_entity_id)}
                </TableCell>
                <TableCell>
                  <FilingStatusBadge status={row.status} />
                  {row.status === "blocked" && (
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {row.validation_exceptions.length}{" "}
                      {row.validation_exceptions.length === 1 ? "finding" : "findings"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.record_count}</TableCell>
                <TableCell className="text-right">
                  <Money value={row.total_amount} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {formatTimestamp(row.generated_at ?? row.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => onOpen(row.id)}>
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </QueryPanel>
  );
}
