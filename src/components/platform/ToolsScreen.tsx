"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CheckCircle2, Minus, PlugZap } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { PageShell } from "@/components/common/PageShell";
import { Badge } from "@/components/ui/badge";
import { useApiQuery } from "@/hooks/useApiQuery";
import { formatDate } from "@/lib/utils";

import type { Connection } from "./PlatformConsole";
import { PlatformToolsPanel } from "./PlatformToolsPanel";
import type { WorkspaceTool } from "./tools";
import { WorkspaceSheet } from "./WorkspaceSheet";

function cellText(tool: WorkspaceTool | undefined): string {
  if (!tool) return "";
  if (tool.connected) return tool.last_error ? "Sync failing" : "Connected";
  return tool.ready ? "Not connected" : "Key needed";
}

/** One organisation in one tool, as the grid shows it. */
function ToolCell({ tool }: { tool: WorkspaceTool | undefined }) {
  if (!tool) return <span className="text-muted-foreground">—</span>;
  if (tool.connected) {
    return (
      <div className="grid gap-0.5">
        {tool.last_error ? (
          <Badge variant="destructive" title={tool.last_error}>
            <AlertTriangle /> Sync failing
          </Badge>
        ) : (
          <Badge variant="success">
            <CheckCircle2 /> Connected
          </Badge>
        )}
        {tool.organization ? (
          <span className="max-w-40 truncate text-xs text-muted-foreground">{tool.organization}</span>
        ) : null}
        {tool.last_synced_at ? (
          <span className="text-xs text-muted-foreground">Synced {formatDate(tool.last_synced_at)}</span>
        ) : null}
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Minus className="size-3" />
      {tool.ready ? "Not connected" : "Key needed"}
    </span>
  );
}

/**
 * Platform → Connected tools: the platform key for each of our tools, then
 * every organisation against every tool. A row opens the organisation, where
 * each tool is connected, synced or disconnected.
 */
export function ToolsScreen() {
  const router = useRouter();
  const { data, error, isLoading, reload } = useApiQuery<Connection[]>("/platform/connections");
  const [viewingId, setViewingId] = useState<string | null>(null);
  // The tools, in the server's order, from the first organisation that lists them.
  const toolKeys = (data?.[0]?.tools ?? []).map((tool) => ({ key: tool.key, brand: tool.brand }));

  const columns: ColumnDef<Connection>[] = [
    {
      accessorKey: "name",
      header: "Organisation",
      cell: ({ row: { original: row } }) => (
        <div className="min-w-44">
          <p className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
            {row.name}
            {!row.is_active ? <Badge variant="destructive">Suspended</Badge> : null}
          </p>
          <p className="font-mono text-xs text-muted-foreground">{row.workspace}</p>
        </div>
      ),
    },
    ...toolKeys.map(
      ({ key, brand }): ColumnDef<Connection> => ({
        id: `tool:${key}`,
        header: brand,
        accessorFn: (row) => cellText(row.tools.find((tool) => tool.key === key)),
        cell: ({ row: { original: row } }) => <ToolCell tool={row.tools.find((tool) => tool.key === key)} />,
      }),
    ),
  ];

  const failing = (data ?? []).reduce(
    (sum, row) => sum + row.tools.filter((tool) => tool.connected && tool.last_error).length,
    0,
  );

  return (
    <PageShell
      title="Connected tools"
      eyebrow="Platform console"
      icon={PlugZap}
      description="Our other products — the platform key for each, and which organisation uses which."
    >
      <PlatformToolsPanel />
      <DataTable
        title="Organisations in each tool"
        description={
          failing
            ? `${failing} people ${failing === 1 ? "sync is" : "syncs are"} failing. Click a row to retry or reconnect.`
            : "Click a row to connect, sync or disconnect that organisation's tools."
        }
        columns={columns}
        data={data ?? []}
        getRowId={(row) => row.id}
        noun="organisations"
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        selectable={false}
        exportName="organisation-tools"
        searchPlaceholder="Search organisations"
        onRowClick={(row) => setViewingId(row.id)}
        rowClassName={(row) => (row.is_active ? undefined : "opacity-60")}
        empty={{ icon: PlugZap, title: "No organisations yet" }}
      />
      <WorkspaceSheet
        workspaceId={viewingId}
        onClose={() => {
          setViewingId(null);
          reload();
        }}
        onEdit={(detail) => router.push(`/platform/organisations?open=${detail.id}`)}
      />
    </PageShell>
  );
}
