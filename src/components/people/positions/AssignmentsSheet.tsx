"use client";

import { History } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { Position, PositionAssignment } from "@/lib/types/people";
import { formatDate, toISODate } from "@/lib/utils";

import { apiMessage } from "../labels";

const KIND_LABEL: Record<PositionAssignment["assignment_type"], string> = {
  primary: "Primary",
  acting: "Acting",
  additional_charge: "Additional charge",
};

/** Everyone who has held a seat, oldest last, with the open assignments endable. */
export function AssignmentsSheet({
  position,
  canEnd,
  onOpenChange,
  onChanged,
}: {
  position: Position | null;
  canEnd: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const { data, error, isLoading, reload } = useApiQuery<PositionAssignment[]>(
    position ? `/positions/${position.id}/assignments` : null,
  );
  const [ending, setEnding] = useState<PositionAssignment | null>(null);

  const end = async () => {
    if (!ending) return;
    try {
      await post(`/positions/assignments/${ending.id}/end`, { on: toISODate(new Date()) });
      toast.success(`${ending.employee_name}'s assignment ended today.`);
      reload();
      onChanged();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not end the assignment."));
      throw caught;
    }
  };

  const rows = [...(data ?? [])].sort((a, b) => b.from_date.localeCompare(a.from_date));

  return (
    <Sheet open={position !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{position?.title}</SheetTitle>
          <SheetDescription>
            Everyone who has held <span className="font-mono">{position?.code}</span>, newest first.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} className="h-14 w-full" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error.detail} onRetry={reload} />
          ) : rows.length === 0 ? (
            <EmptyState icon={History} title="Nobody has held this seat yet" />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{row.employee_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(row.from_date)} – {row.to_date ? formatDate(row.to_date) : "now"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline">{KIND_LABEL[row.assignment_type]}</Badge>
                      {!row.counts_toward_headcount && (
                        <Badge variant="muted">Not counted in headcount</Badge>
                      )}
                    </div>
                    {row.note && <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>}
                  </div>
                  {canEnd && !row.to_date && (
                    <Button variant="outline" size="sm" onClick={() => setEnding(row)}>
                      End
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <ConfirmDialog
          open={ending !== null}
          onOpenChange={(open) => !open && setEnding(null)}
          title={`End ${ending?.employee_name ?? ""}'s assignment?`}
          description="It ends today. If this was the primary holder, the seat becomes vacant and starts ageing on the vacancies report."
          confirmLabel="End assignment"
          onConfirm={end}
        />
      </SheetContent>
    </Sheet>
  );
}
