"use client";

import { LayoutGrid, Loader2, Pin, PinOff } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, post } from "@/lib/api";
import type { DashboardWidget, ReportResult, SavedReport } from "@/lib/types/reports";

import { ReportChart } from "../ReportChart";
import { ReportResultTable } from "../ReportResultTable";

/**
 * Saved reports pinned to this person's dashboard.
 *
 * Each runs as whoever is looking at it, exactly as it would from the reports
 * page — pinning a report shares nothing with anybody.
 */
export function PinnedReports() {
  const widgets = useApiQuery<DashboardWidget[]>("/reports/dashboard");
  const reports = useApiQuery<SavedReport[]>("/reports");
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const pinned = new Set((widgets.data ?? []).map((w) => w.report_id));
  const pinnable = (reports.data ?? []).filter((r) => !pinned.has(r.id));

  const pin = async () => {
    if (!choice) return;
    setBusy("pin");
    try {
      widgets.setData(await post<DashboardWidget[]>("/reports/dashboard", { report_id: choice }));
      setChoice("");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not pin the report.");
    } finally {
      setBusy(null);
    }
  };

  const unpin = async (widget: DashboardWidget) => {
    setBusy(widget.id);
    try {
      widgets.setData(await del<DashboardWidget[]>(`/reports/dashboard/${widget.id}`));
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not unpin the report.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <DataPanel
      tier="tier1"
      title="Pinned reports"
      description="Your saved reports, run as you each time this page opens."
      isLoading={widgets.isLoading}
      error={widgets.error?.detail ?? null}
      onRetry={widgets.reload}
      actions={
        pinnable.length > 0 ? (
          <div className="flex items-center gap-2">
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger className="w-56" aria-label="Report to pin">
                <SelectValue placeholder="Choose a saved report" />
              </SelectTrigger>
              <SelectContent>
                {pinnable.map((report) => (
                  <SelectItem key={report.id} value={report.id}>
                    {report.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={pin} disabled={!choice || busy !== null}>
              {busy === "pin" ? <Loader2 className="animate-spin" /> : <Pin />} Pin
            </Button>
          </div>
        ) : undefined
      }
      isEmpty={(widgets.data ?? []).length === 0}
      empty={{
        icon: LayoutGrid,
        title: "Nothing pinned yet",
        description:
          (reports.data ?? []).length === 0
            ? "Save a report on the Reports page, then pin it here."
            : "Choose one of your saved reports above to keep it on this page.",
      }}
    >
      <div className="grid gap-4 p-5 xl:grid-cols-2">
        {(widgets.data ?? []).map((widget) => (
          <WidgetCard key={widget.id} widget={widget} busy={busy === widget.id} onUnpin={() => unpin(widget)} />
        ))}
      </div>
    </DataPanel>
  );
}

function WidgetCard({ widget, busy, onUnpin }: { widget: DashboardWidget; busy: boolean; onUnpin: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<ReportResult>(`/reports/${widget.report_id}/run`);

  return (
    <Card tier="tier1" className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">{widget.name}</CardTitle>
        {widget.description && <CardDescription>{widget.description}</CardDescription>}
        <CardAction>
          <Button size="sm" variant="ghost" aria-label={`Unpin ${widget.name}`} disabled={busy} onClick={onUnpin}>
            {busy ? <Loader2 className="animate-spin" /> : <PinOff />}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : error ? (
          <ErrorState message={error.detail} onRetry={reload} />
        ) : data ? (
          widget.chart_type === "table" ? (
            <div className="max-h-72 overflow-auto">
              <ReportResultTable result={data} />
            </div>
          ) : (
            <ReportChart result={data} chartType={widget.chart_type} />
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
