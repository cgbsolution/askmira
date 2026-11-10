"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronRight, Plug } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { PageShell } from "@/components/common/PageShell";
import { DigioCard } from "@/components/settings/integrations/DigioCard";
import { ZohoBooksCard } from "@/components/settings/integrations/ZohoBooksCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/useApiQuery";
import { cn } from "@/lib/utils";

export interface CatalogueRow {
  key: string;
  integration: string;
  category: string;
  data: string;
  status: "available" | "configurable";
  direction: string;
  frequency: string;
  auth: string;
  limitations: string;
  state: "connected" | "ready" | "needs_setup" | "platform_setup";
  detail: string;
  href: string;
}

const STATUS: Record<
  CatalogueRow["status"],
  { label: string; variant: "success" | "outline" }
> = {
  available: { label: "Available today", variant: "success" },
  configurable: { label: "Configurable", variant: "outline" },
};

const STATE: Record<
  CatalogueRow["state"],
  { label: string; variant: "success" | "outline" | "warning" | "muted" }
> = {
  connected: { label: "In use", variant: "success" },
  ready: { label: "Ready", variant: "outline" },
  needs_setup: { label: "Set up needed", variant: "warning" },
  platform_setup: { label: "Platform set-up needed", variant: "muted" },
};

function Details({ row }: { row: CatalogueRow }) {
  // Data exchanged is its own column from tablet width up; on a phone it is here.
  const items: [string, string, string?][] = [
    ["Data exchanged", row.data, "md:hidden"],
    ["Direction", row.direction],
    ["How often", row.frequency],
    ["Sign-in", row.auth],
    ["Limitations", row.limitations],
  ];
  return (
    <dl className="sticky left-0 grid w-[calc(100vw-5rem)] gap-3 py-1 text-sm sm:grid-cols-2 md:static md:w-auto">
      {items.map(([label, value, only]) => (
        <div key={label} className={cn("grid gap-0.5", only)}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </dt>
          <dd className="text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Settings → Integrations: every outside system AskMiraa exchanges data with —
 * what it carries, which way, how often, how it signs in, its limits — and
 * where this workspace stands with each, read from the workspace's own
 * records. Below it, the connections a workspace makes here itself.
 */
export function IntegrationsHubScreen() {
  const { data, error, isLoading, reload } = useApiQuery<CatalogueRow[]>(
    "/integrations/catalogue",
  );
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const columns: ColumnDef<CatalogueRow>[] = [
    {
      id: "integration",
      header: "Integration",
      accessorFn: (row) => `${row.integration} ${row.category}`,
      meta: {
        cellClassName: "whitespace-normal",
        text: (row) => `${row.integration} (${row.category})`,
      },
      cell: ({ row }) => (
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-muted-foreground" aria-hidden>
            {open.has(row.original.key) ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-foreground">
              {row.original.integration}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.original.category}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "data",
      header: "Data exchanged",
      accessorKey: "data",
      meta: {
        className: "hidden md:table-cell",
        cellClassName: "max-w-64 whitespace-normal text-sm",
      },
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => STATUS[row.status].label,
      meta: { text: (row) => STATUS[row.status].label },
      cell: ({ row }) => (
        <Badge variant={STATUS[row.original.status].variant}>
          {STATUS[row.original.status].label}
        </Badge>
      ),
    },
    {
      id: "state",
      header: "This workspace",
      accessorFn: (row) => STATE[row.state].label,
      meta: {
        cellClassName: "max-w-80 whitespace-normal",
        text: (row) => `${STATE[row.state].label} · ${row.detail}`,
      },
      cell: ({ row }) => (
        <div className="grid gap-1">
          <Badge variant={STATE[row.original.state].variant} className="w-fit">
            {STATE[row.original.state].label}
          </Badge>
          <p className="text-xs text-muted-foreground">{row.original.detail}</p>
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <Button asChild size="sm" variant="outline">
          <Link href={row.original.href}>Open</Link>
        </Button>
      ),
    },
  ];

  const counts = (data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.state] = (acc[row.state] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <PageShell
      title="Integrations"
      description="Every outside system AskMiraa exchanges data with, how it works, and where this workspace stands with each."
      icon={Plug}
    >
      <div className="grid gap-6">
        <DataTable
          title="Integration catalogue"
          description={
            data
              ? `${counts.connected ?? 0} in use · ${counts.ready ?? 0} ready · ${
                  (counts.needs_setup ?? 0) + (counts.platform_setup ?? 0)
                } to set up. Click a row for direction, frequency, sign-in and limitations.`
              : undefined
          }
          columns={columns}
          data={data ?? []}
          getRowId={(row) => row.key}
          noun="integrations"
          exportName="integration-catalogue"
          searchPlaceholder="Search integrations"
          isLoading={isLoading}
          error={error?.detail}
          onRetry={reload}
          paginate={false}
          onRowClick={(row) => toggle(row.key)}
          renderExpanded={(row) =>
            open.has(row.key) ? <Details row={row} /> : null
          }
          rowClassName={() => "align-top"}
          empty={{ icon: Plug, title: "No integrations" }}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <DigioCard onChanged={reload} />
          <ZohoBooksCard onChanged={reload} />
        </div>
      </div>
    </PageShell>
  );
}
