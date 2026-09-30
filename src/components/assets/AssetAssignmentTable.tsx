"use client";

import {
  IdCard,
  Laptop,
  Monitor,
  Package,
  PackagePlus,
  RefreshCw,
  Smartphone,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import React, { useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { TablePager, usePaged } from "@/components/common/TablePager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { AssetAssignment } from "@/lib/types/assets";

import { ReturnDialog } from "./AssetActionDialogs";
import { HandOverDialog } from "./HandOverDialog";
import { CONDITION_LABELS, dayOrDash, stampDay } from "./shared";

/** A recognisable icon for a category, from its name; a box for anything else. */
function iconFor(category: string): LucideIcon {
  const name = category.toLowerCase();
  if (/laptop|notebook|computer/.test(name)) return Laptop;
  if (/phone|mobile|tablet/.test(name)) return Smartphone;
  if (/card|badge|access|id/.test(name)) return IdCard;
  if (/monitor|screen|display/.test(name)) return Monitor;
  return Package;
}

function statusOf(row: AssetAssignment): { label: string; variant: React.ComponentProps<typeof Badge>["variant"] } {
  if (!row.is_open) {
    return row.outcome === "returned"
      ? { label: "Returned", variant: "secondary" }
      : row.outcome === "lost"
        ? { label: "Lost", variant: "destructive" }
        : { label: "Written off", variant: "muted" };
  }
  if (row.is_overdue) return { label: "Overdue", variant: "destructive" };
  if (row.requires_acknowledgement && !row.acknowledged_at) {
    return { label: "Not acknowledged", variant: "warning" };
  }
  return { label: "With employee", variant: "success" };
}

/**
 * One person's assets, the way HR hands them out: every hand-over with its
 * type, dates, status and remark, the hand-over button, and Return on the
 * ones still held. The same data as the register, seen from the person.
 */
export function AssetAssignmentTable({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  const { data, error, isLoading, reload } = useApiQuery<AssetAssignment[]>(
    `/assets/employees/${employeeId}`,
  );
  const [handingOver, setHandingOver] = useState(false);
  const [returning, setReturning] = useState<AssetAssignment | null>(null);

  // Held first, newest first within each.
  const rows = [...(data ?? [])].sort(
    (a, b) => Number(b.is_open) - Number(a.is_open) || b.assigned_at.localeCompare(a.assigned_at),
  );
  const paged = usePaged(rows);

  return (
    <>
      <DataPanel
        title="Assets"
        description={`Everything handed to ${employeeName}, what they still hold first.`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon-sm" aria-label="Refresh" onClick={reload}>
              <RefreshCw />
            </Button>
            <Button size="sm" onClick={() => setHandingOver(true)}>
              <PackagePlus /> Hand over an asset
            </Button>
          </div>
        }
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: Package,
          title: "No assets handed over",
          description: `Nothing has been handed to ${employeeName} yet. Use "Hand over an asset" to give them one from stock.`,
        }}
        footer={rows.length > 0 ? <TablePager paged={paged} /> : undefined}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 pl-6">Sr. no.</TableHead>
              <TableHead className="w-14">Asset</TableHead>
              <TableHead>Asset type</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead>Assign date</TableHead>
              <TableHead>Valid till</TableHead>
              <TableHead>Asset status</TableHead>
              <TableHead>Remark</TableHead>
              <TableHead className="pr-6 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.rows.map((row, index) => {
              const Icon = iconFor(row.category_name);
              const status = statusOf(row);
              const remark = row.is_open
                ? [CONDITION_LABELS[row.condition_out], row.assignment_notes].filter(Boolean).join(" · ")
                : [row.condition_in ? `Returned ${CONDITION_LABELS[row.condition_in].toLowerCase()}` : null, row.return_notes]
                    .filter(Boolean)
                    .join(" · ");
              return (
                <TableRow key={row.id}>
                  <TableCell className="pl-6 tabular-nums text-muted-foreground">
                    {paged.offset + index + 1}
                  </TableCell>
                  <TableCell>
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-primary">
                      <Icon className="size-4" />
                    </span>
                  </TableCell>
                  <TableCell>{row.category_name}</TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{row.asset_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.asset_tag}
                      {row.serial_number ? ` · S/N ${row.serial_number}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{stampDay(row.assigned_at)}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {row.is_open ? dayOrDash(row.expected_return_date) : stampDay(row.closed_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="max-w-56 whitespace-normal text-sm text-muted-foreground">
                    {remark || "—"}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    {row.is_open && (
                      <Button variant="outline" size="sm" onClick={() => setReturning(row)}>
                        <Undo2 /> Return
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataPanel>

      <HandOverDialog
        employeeId={employeeId}
        employeeName={employeeName}
        open={handingOver}
        onOpenChange={setHandingOver}
        onDone={reload}
      />
      {returning && (
        <ReturnDialog
          assignment={returning}
          open={returning !== null}
          onOpenChange={(open) => !open && setReturning(null)}
          onDone={() => {
            setReturning(null);
            reload();
          }}
        />
      )}
    </>
  );
}
