"use client";

import { CheckCircle2, Loader2, Plug, RefreshCw, Unplug } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, post } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export interface Connector {
  key: "interview" | "expense";
  name: string;
  brand: string;
  description: string;
  /** Whether Connect can be used on this AskMira server. */
  available: boolean;
  /** Why not: where the product is unknown, or no key to store its key safely with. */
  unavailable_reason: "address" | "server_key" | null;
  connected: boolean;
  /** "connectors": connected here. "platform": linked by the platform the older way. */
  via: "connectors" | "platform" | null;
  /** The organisation in the product this workspace is connected to. */
  organization: string | null;
  last_synced_at: string | null;
  last_sync: {
    sent: number;
    created: number;
    updated: number;
    deactivated: number;
    skipped: { email: string; reason: string }[];
  } | null;
  last_error: string | null;
}

/**
 * Settings → Connectors. The workspace's admin connects AnytimeHire and
 * ExpenseGenie: Connect opens the product, an admin of the organisation there
 * signs in and presses Allow, and the product issues a key for this workspace
 * alone. People are sent across at once and every night after.
 */
export function ConnectorsScreen() {
  const { data, error, isLoading, reload } = useApiQuery<Connector[]>("/connectors");
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Connector | null>(null);

  const connect = async (connector: Connector) => {
    setBusy(connector.key);
    try {
      const { authorize_url } = await post<{ authorize_url: string }>(
        `/connectors/${connector.key}/start`,
      );
      window.location.assign(authorize_url);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not start connecting.");
      setBusy(null);
    }
  };

  const sync = async (connector: Connector) => {
    setBusy(connector.key);
    try {
      const result = await post<Connector>(`/connectors/${connector.key}/sync`);
      if (result.last_error) toast.warning(`People sync failed: ${result.last_error}`);
      else toast.success("People synced");
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not sync.");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    const target = removing;
    if (!target) return;
    try {
      await del(`/connectors/${target.key}`);
      toast.success(`${target.brand} disconnected`);
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not disconnect.");
    }
  };

  return (
    <PageShell
      title="Connectors"
      description="Connect the other products your company uses. Each connection belongs to this workspace alone and reaches only your organisation there."
      icon={Plug}
    >
      {isLoading && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <ErrorState message={error.detail} onRetry={reload} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(data ?? []).map((connector) => (
            <ConnectorCard
              key={connector.key}
              connector={connector}
              busy={busy === connector.key}
              disabled={busy !== null}
              onConnect={() => void connect(connector)}
              onSync={() => void sync(connector)}
              onDisconnect={() => setRemoving(connector)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Disconnect ${removing?.brand ?? ""}?`}
        description={`${removing?.brand ?? "The product"} forgets this workspace's key. Nobody can open it from AskMira, people stop being synced, and its records leave Expenses, Hiring and Ask Mira. Nothing is deleted on either side; you can connect again.`}
        confirmLabel="Disconnect"
        destructive
        onConfirm={disconnect}
      />
    </PageShell>
  );
}

function ConnectorCard({
  connector,
  busy,
  disabled,
  onConnect,
  onSync,
  onDisconnect,
}: {
  connector: Connector;
  busy: boolean;
  disabled: boolean;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const sync = connector.last_sync;
  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {connector.brand}
          {connector.connected ? (
            <Badge variant="secondary">
              <CheckCircle2 /> Connected
            </Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </CardTitle>
        <CardDescription>{connector.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {connector.connected ? (
          <div className="grid gap-1 text-sm">
            {connector.organization ? (
              <p>
                Organisation in {connector.brand}: <span className="font-medium">{connector.organization}</span>
              </p>
            ) : null}
            {connector.via === "platform" ? (
              <p className="text-xs text-muted-foreground">
                Linked by your AskMira provider. Disconnect and connect again to give this workspace a key of its own.
              </p>
            ) : null}
            {sync ? (
              <p className="text-xs text-muted-foreground">
                Last people sync{connector.last_synced_at ? ` ${formatDate(connector.last_synced_at)}` : ""}:{" "}
                {sync.sent} sent · {sync.created} added · {sync.updated} updated · {sync.deactivated} switched off
                {sync.skipped.length ? ` · ${sync.skipped.length} skipped` : ""}
              </p>
            ) : null}
            {sync && sync.skipped.length > 0 ? (
              <ul className="grid gap-0.5 text-xs text-muted-foreground">
                {sync.skipped.slice(0, 5).map((skip) => (
                  <li key={skip.email} className="truncate">
                    <span className="font-mono">{skip.email}</span> — {skip.reason}
                  </li>
                ))}
              </ul>
            ) : null}
            {connector.last_error ? <p className="text-xs text-destructive">{connector.last_error}</p> : null}
          </div>
        ) : connector.available ? (
          <p className="text-sm text-muted-foreground">
            Press Connect, sign in to {connector.brand} as an admin of your organisation there, and press Allow.
          </p>
        ) : connector.unavailable_reason === "server_key" ? (
          <p className="text-sm text-muted-foreground">
            This AskMira server cannot store connection keys safely yet: its encryption key (SECRET_ENCRYPTION_KEY) is
            not set. Ask your AskMira provider to set it.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            This AskMira server does not know where {connector.brand} is yet. Ask your AskMira provider to add it.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {connector.connected ? (
            <>
              <Button variant="outline" size="sm" disabled={disabled} onClick={onSync}>
                {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync people now
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/launch/${connector.key}`} target="_blank" rel="noopener">
                  Open {connector.brand}
                </Link>
              </Button>
              <Button variant="outline" size="sm" disabled={disabled} onClick={onDisconnect}>
                <Unplug /> Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={disabled || !connector.available} onClick={onConnect}>
              {busy ? <Loader2 className="animate-spin" /> : <Plug />} Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
