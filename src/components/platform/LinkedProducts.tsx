"use client";

import { Link2, Link2Off, Loader2, RefreshCw } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, post } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface LinkedProduct {
  key: "interview" | "expense";
  name: string;
  /** The AskMira section it takes over. */
  replaces: string;
  configured: boolean;
  status: "active" | "disabled" | null;
  external_ref: string | null;
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

const REPLACES: Record<string, string> = { hiring: "Hiring", expenses: "Expenses" };

/**
 * Platform → Workspaces → View: which of our separate products this company
 * uses. Linking one makes it replace the matching AskMira module for the
 * company and pushes its people there; the nightly sync keeps them in step.
 */
export function LinkedProducts({ workspaceId, active }: { workspaceId: string; active: boolean }) {
  const path = `/platform/workspaces/${workspaceId}/products`;
  const { data, error, isLoading, reload } = useApiQuery<LinkedProduct[]>(path);
  const [busy, setBusy] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<LinkedProduct | null>(null);

  const act = async (key: string, run: () => Promise<LinkedProduct>, done: string) => {
    setBusy(key);
    try {
      const result = await run();
      if (result.last_error) toast.warning(`${done}, but the people sync failed: ${result.last_error}`);
      else toast.success(done);
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "That did not work. Try again.");
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <Skeleton className="h-28 w-full" />;
  if (error) return <ErrorState message={error.detail} onRetry={reload} className="py-6" />;

  return (
    <div className="grid gap-3">
      {(data ?? []).map((product) => {
        const linked = product.status === "active";
        const sync = product.last_sync;
        return (
          <div key={product.key} className="grid gap-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {product.name}
                  {linked ? (
                    <Badge variant="secondary">Linked</Badge>
                  ) : !product.configured ? (
                    <Badge variant="outline">Not connected — connect it under Product connections</Badge>
                  ) : (
                    <Badge variant="outline">Not linked</Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Replaces {REPLACES[product.replaces] ?? product.replaces} in AskMira for this
                  company.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {linked ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() =>
                        void act(
                          product.key,
                          () => post<LinkedProduct>(`${path}/${product.key}/sync`),
                          "People synced",
                        )
                      }
                    >
                      {busy === product.key ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                      Sync now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => setUnlinking(product)}
                    >
                      <Link2Off /> Unlink
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    disabled={busy !== null || !product.configured || !active}
                    onClick={() =>
                      void act(
                        product.key,
                        () => post<LinkedProduct>(`${path}/${product.key}`),
                        `${product.name} linked`,
                      )
                    }
                  >
                    {busy === product.key ? <Loader2 className="animate-spin" /> : <Link2 />}
                    Link
                  </Button>
                )}
              </div>
            </div>

            {linked && sync && (
              <p className="text-xs text-muted-foreground">
                Last sync{product.last_synced_at ? ` ${formatDate(product.last_synced_at)}` : ""}:{" "}
                {sync.sent} sent · {sync.created} added · {sync.updated} updated ·{" "}
                {sync.deactivated} switched off
                {sync.skipped.length ? ` · ${sync.skipped.length} skipped` : ""}
              </p>
            )}
            {linked && sync && sync.skipped.length > 0 && (
              <ul className="grid gap-0.5 text-xs text-muted-foreground">
                {sync.skipped.slice(0, 5).map((skip) => (
                  <li key={skip.email} className="truncate">
                    <span className="font-mono">{skip.email}</span> — {skip.reason}
                  </li>
                ))}
              </ul>
            )}
            {linked && product.last_error && (
              <p className="text-xs text-destructive">{product.last_error}</p>
            )}
          </div>
        );
      })}

      <Dialog open={unlinking !== null} onOpenChange={(open) => !open && setUnlinking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlink {unlinking?.name}?</DialogTitle>
            <DialogDescription>
              {REPLACES[unlinking?.replaces ?? ""] ?? "The module"} comes back in AskMira for this
              company. {unlinking?.name} keeps its data, but nobody can open it from AskMira and
              people stop being synced to it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlinking(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={() => {
                const target = unlinking;
                if (!target) return;
                setUnlinking(null);
                void act(
                  target.key,
                  () => del<LinkedProduct>(`${path}/${target.key}`),
                  `${target.name} unlinked`,
                );
              }}
            >
              Unlink
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
