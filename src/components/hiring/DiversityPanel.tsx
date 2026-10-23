"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ShieldCheck } from "lucide-react";
import React, { useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { stageLabel } from "@/components/hiring/AnalyticsNames";
import { humanize, percent } from "@/components/hiring/labels";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { DiversityReport } from "@/lib/types/hiring";

interface Dimension {
  dimension: string;
  values: string[];
}

type StageRow = DiversityReport["stages"][number];

// A suppressed stage shows no number at all: the API still sends its count.
const STAGE_COLUMNS: ColumnDef<StageRow>[] = [
  {
    accessorKey: "stage",
    header: "Stage",
    meta: { cellClassName: "text-foreground" },
    cell: ({ row }) => stageLabel(row.original.stage),
  },
  {
    accessorKey: "disclosed_at_stage",
    header: "Disclosed at stage",
    meta: {
      className: "text-right",
      cellClassName: "tabular-nums",
      text: (row) => (row.suppressed ? "Suppressed" : row.disclosed_at_stage),
    },
    cell: ({ row }) =>
      row.original.suppressed ? (
        <Badge variant="muted">Suppressed — too few to show</Badge>
      ) : (
        row.original.disclosed_at_stage
      ),
  },
  {
    accessorKey: "share",
    header: "Share in group",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => (row.original.suppressed ? "—" : percent(row.original.share)),
  },
  {
    accessorKey: "note",
    header: "Note",
    meta: { cellClassName: "max-w-80 whitespace-normal text-xs text-muted-foreground" },
  },
];

/**
 * How one self-disclosed group fares through the funnel. Disclosures are
 * voluntary and consent-based; a stage with too few people is suppressed and
 * shows no number at all, because a small count identifies people.
 */
export function DiversityPanel() {
  const dimensions = useApiQuery<Dimension[]>("/recruiting/analytics/diversity/dimensions");
  const [dimension, setDimension] = useState("");
  const [focus, setFocus] = useState("");
  const values = dimensions.data?.find((item) => item.dimension === dimension)?.values ?? [];
  const path =
    dimension && focus
      ? `/recruiting/analytics/diversity?dimension=${encodeURIComponent(dimension)}&focus_value=${encodeURIComponent(focus)}`
      : null;
  const report = useApiQuery<DiversityReport>(path);
  const data = path ? report.data : null;
  const list = dimensions.data ?? [];

  return (
    <DataPanel
      title="Diversity through the funnel"
      description="From voluntary, consent-based disclosures only."
      isLoading={dimensions.isLoading && !dimensions.data}
      error={dimensions.error?.detail}
      onRetry={dimensions.reload}
      isEmpty={list.length === 0}
      empty={{
        icon: ShieldCheck,
        title: "No diversity disclosures recorded",
        description:
          "Candidates disclose this only if they choose to, with consent. None have been recorded, so there is nothing to report.",
      }}
      toolbar={
        list.length > 0 ? (
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto">
            <FormField htmlFor="diversity-dimension" label="Dimension">
              <Select
                value={dimension}
                onValueChange={(next) => {
                  setDimension(next);
                  setFocus("");
                }}
              >
                <SelectTrigger id="diversity-dimension" className="w-full sm:w-52">
                  <SelectValue placeholder="Choose a dimension" />
                </SelectTrigger>
                <SelectContent>
                  {list.map((item) => (
                    <SelectItem key={item.dimension} value={item.dimension}>
                      {humanize(item.dimension)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="diversity-focus" label="Group">
              <Select value={focus} onValueChange={setFocus} disabled={!dimension}>
                <SelectTrigger id="diversity-focus" className="w-full sm:w-52">
                  <SelectValue placeholder="Choose a group" />
                </SelectTrigger>
                <SelectContent>
                  {values.map((value) => (
                    <SelectItem key={value} value={value}>
                      {humanize(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
        ) : undefined
      }
    >
      {!path ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          Choose a dimension and a group to see how that group moves through the stages.
        </p>
      ) : report.isLoading && !data ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Loading…</p>
      ) : report.error ? (
        <p role="alert" className="px-5 py-6 text-sm text-destructive">
          {report.error.detail}
        </p>
      ) : data ? (
        <div className="grid gap-3 pb-4">
          <div className="grid gap-1 px-5 pt-4 text-sm">
            <p className="tabular-nums text-foreground">
              Disclosure coverage: {percent(data.coverage.coverage_rate)}{" "}
              <span className="text-muted-foreground">
                ({data.coverage.disclosed} of {data.coverage.candidates} candidates)
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{data.coverage.note}</p>
          </div>
          <DataTable
            variant="plain"
            bordered={false}
            columns={STAGE_COLUMNS}
            data={data.stages}
            getRowId={(row) => row.stage}
          />
          <div className="grid gap-1 px-5 text-sm">
            {data.largest_fall && <p className="text-foreground">{data.largest_fall.reading}</p>}
            <p className="text-xs text-muted-foreground">{data.note}</p>
          </div>
        </div>
      ) : null}
    </DataPanel>
  );
}
