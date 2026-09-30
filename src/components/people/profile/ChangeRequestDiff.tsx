"use client";

import React from "react";

import { FIELD_LABEL, NOMINEE_PURPOSE, RELATIONSHIP } from "@/components/people/profile/labels";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { stateName } from "@/lib/states";
import type { ChangeRequest } from "@/lib/types/people";
import { formatDay } from "@/lib/utils";

type Json = Record<string, unknown>;

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (isDate(value)) return formatDay(value, true);
  if (typeof value === "object" && !Array.isArray(value)) {
    const address = value as Json;
    if ("line1" in address) {
      return [
        address.line1,
        address.line2,
        address.city,
        address.district,
        `${stateName(String(address.state_code ?? ""))} ${address.pincode ?? ""}`.trim(),
      ]
        .filter(Boolean)
        .join(", ");
    }
    return JSON.stringify(value);
  }
  return String(value);
}

/** One line for a list entry: a nominee, a contact, a qualification. */
function entryLine(entry: Json): string {
  const parts: string[] = [];
  if (entry.name) parts.push(String(entry.name));
  if (entry.relationship) parts.push(RELATIONSHIP[entry.relationship as keyof typeof RELATIONSHIP] ?? String(entry.relationship));
  if (entry.purpose) {
    parts.push(
      `${NOMINEE_PURPOSE[entry.purpose as keyof typeof NOMINEE_PURPOSE] ?? String(entry.purpose)} ${entry.share_percent ?? ""}%`,
    );
  }
  if (entry.qualification) parts.push(String(entry.qualification));
  if (entry.institution) parts.push(String(entry.institution));
  if (entry.employer) parts.push(String(entry.employer));
  return parts.join(" · ") || "Entry";
}

/**
 * What a change request asks for against what the record said when it was
 * raised. Identifiers arrive already masked for anyone outside HR.
 */
export function ChangeRequestDiff({ request }: { request: ChangeRequest }) {
  const proposed = request.proposed as Json;
  const current = request.current_snapshot as Json;

  if (Array.isArray(proposed.entries)) {
    const before = (current.entries as Json[] | undefined) ?? [];
    const after = proposed.entries as Json[];
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">On record ({before.length})</p>
          <ul className="mt-1 grid gap-1 text-sm">
            {before.length === 0 && <li className="text-muted-foreground">Nothing recorded</li>}
            {before.map((entry, index) => (
              <li key={index}>{entryLine(entry)}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Requested ({after.length})</p>
          <ul className="mt-1 grid gap-1 text-sm font-medium">
            {after.length === 0 && <li className="text-muted-foreground">Remove all</li>}
            {after.map((entry, index) => (
              <li key={index}>{entryLine(entry)}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const keys = Object.keys(proposed).filter((key) => key !== "name_similarity");
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Field</TableHead>
          <TableHead>On record</TableHead>
          <TableHead>Requested</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((key) => {
          const changed = show(current[key]) !== show(proposed[key]);
          return (
            <TableRow key={key}>
              <TableCell className="text-muted-foreground">{FIELD_LABEL[key] ?? key}</TableCell>
              <TableCell className="max-w-64 whitespace-normal">{show(current[key])}</TableCell>
              <TableCell className={changed ? "max-w-64 whitespace-normal font-medium" : "max-w-64 whitespace-normal"}>
                {show(proposed[key])}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
