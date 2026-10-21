"use client";

import { CheckCircle2, KeyRound, Loader2, Plug, PlugZap, Unplug } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
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
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, post } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface ProductConnection {
  key: "interview" | "expense";
  name: string;
  brand: string;
  connected: boolean;
  /** "console": made here with a key. "environment": the server's settings. */
  source: "console" | "environment" | null;
  api_url: string | null;
  app_url: string | null;
  connected_at: string | null;
  verified_at: string | null;
}

/** Where, in each product, its super admin generates the key. */
const WHERE: Record<string, string> = {
  interview: "Sign in to AnytimeHire as its super admin and open Settings → AskMira connection.",
  expense: "Sign in to the ExpenseGenie dashboard as its super admin and open Settings → AskMira connection.",
};

/**
 * Platform → Product connections: this server's connection to each of our
 * products, made by pasting a key the product generates — no server settings to
 * edit. Once a product is connected, any workspace can be linked to it.
 */
export function ProductConnections({ onChange }: { onChange?: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<ProductConnection[]>(
    "/platform/product-connections",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<ProductConnection | null>(null);
  const [key, setKey] = useState("");
  const [removing, setRemoving] = useState<ProductConnection | null>(null);

  const act = async (target: string, run: () => Promise<unknown>, done: string) => {
    setBusy(target);
    try {
      await run();
      toast.success(done);
      reload();
      onChange?.();
      return true;
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "That did not work. Try again.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    const target = connecting;
    if (!target || !key.trim()) return;
    const ok = await act(
      target.key,
      () => post(`/platform/product-connections/${target.key}`, { key: key.trim() }),
      `${target.brand} connected`,
    );
    if (ok) {
      setConnecting(null);
      setKey("");
    }
  };

  return (
    <DataPanel
      title="Product connections"
      description="Connect this server to AnytimeHire and ExpenseGenie with a key each one generates. Then link workspaces to them from a workspace's page."
      isLoading={isLoading}
      error={error?.detail}
      onRetry={reload}
      loadingRows={2}
    >
      <div className="grid gap-3 p-4">
        {(data ?? []).map((product) => (
          <div
            key={product.key}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="grid min-w-0 gap-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {product.brand}
                {product.source === "console" ? (
                  <Badge variant="secondary">
                    <CheckCircle2 /> Connected
                  </Badge>
                ) : product.source === "environment" ? (
                  <Badge variant="secondary">Connected by server settings</Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
              </p>
              {product.api_url ? (
                <p className="truncate font-mono text-xs text-muted-foreground">{product.api_url}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{WHERE[product.key]}</p>
              )}
              {product.verified_at ? (
                <p className="text-xs text-muted-foreground">
                  Last checked {formatDate(product.verified_at)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {product.connected ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() =>
                    void act(
                      product.key,
                      () => post(`/platform/product-connections/${product.key}/verify`),
                      `${product.brand} answered`,
                    )
                  }
                >
                  {busy === product.key ? <Loader2 className="animate-spin" /> : <PlugZap />}
                  Check
                </Button>
              ) : null}
              <Button
                size="sm"
                variant={product.connected ? "outline" : "default"}
                disabled={busy !== null}
                onClick={() => setConnecting(product)}
              >
                {product.connected ? <KeyRound /> : <Plug />}
                {product.connected ? "Use a new key" : "Connect"}
              </Button>
              {product.source === "console" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => setRemoving(product)}
                >
                  <Unplug /> Disconnect
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={connecting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConnecting(null);
            setKey("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {connecting?.brand}</DialogTitle>
            <DialogDescription>
              {WHERE[connecting?.key ?? ""]} Press “Generate connection key”, copy it, and paste it
              here within 30 minutes. AskMira checks it with {connecting?.brand} before saving it.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Connection key" htmlFor="connection-key" required>
            <Textarea
              id="connection-key"
              rows={4}
              className="font-mono text-xs"
              placeholder="amk1.…"
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnecting(null)}>
              Cancel
            </Button>
            <Button disabled={busy !== null || !key.trim()} onClick={() => void connect()}>
              {busy ? <Loader2 className="animate-spin" /> : <Plug />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {removing?.brand}?</DialogTitle>
            <DialogDescription>
              AskMira stops calling {removing?.brand}: linked workspaces can&apos;t open it, sync
              people to it, or read from it in Ask Mira until you connect again. Nothing is deleted
              on either side.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const target = removing;
                if (!target) return;
                setRemoving(null);
                void act(
                  target.key,
                  () => del(`/platform/product-connections/${target.key}`),
                  `${target.brand} disconnected`,
                );
              }}
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DataPanel>
  );
}
