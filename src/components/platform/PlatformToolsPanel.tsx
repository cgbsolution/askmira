"use client";

import {
  CheckCircle2,
  ClipboardPaste,
  Copy,
  KeyRound,
  Loader2,
  PlugZap,
  Trash2,
  XCircle,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, post, put } from "@/lib/api";
import { formatDate } from "@/lib/utils";

import type { PlatformTool } from "./tools";

/**
 * Platform → Tools. Once per product, the platform's key: the same value is set
 * on the product as ASKMIRA_PLATFORM_SECRET. With it, a new organisation can be
 * created in the product (with its admin) from here, or one it already has
 * attached; each workspace then gets a key of its own.
 */
export function PlatformToolsPanel() {
  const { data, error, isLoading, reload } =
    useApiQuery<PlatformTool[]>("/platform/tools");
  const [busy, setBusy] = useState<string | null>(null);
  const [pasting, setPasting] = useState<PlatformTool | null>(null);
  const [removing, setRemoving] = useState<PlatformTool | null>(null);
  const [generated, setGenerated] = useState<PlatformTool | null>(null);

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    try {
      await work();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError
          ? caught.detail
          : "That did not work. Try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  const generate = (tool: PlatformTool) =>
    run(tool.key, async () => {
      const result = await put<PlatformTool>(
        `/platform/tools/${tool.key}/key`,
        {},
      );
      setGenerated(result);
      reload();
    });

  const check = (tool: PlatformTool) =>
    run(tool.key, async () => {
      const result = await post<PlatformTool>(
        `/platform/tools/${tool.key}/check`,
      );
      if (result.last_check_ok)
        toast.success(
          result.last_check_message ?? `${tool.brand} accepted the key.`,
        );
      else
        toast.error(
          result.last_check_message ?? `${tool.brand} did not accept the key.`,
        );
      reload();
    });

  return (
    <>
      <DataPanel
        title="Connected tools"
        description="Set each tool's platform key once. Then, when you create an organisation, tick the tools it uses: AskMiraa creates the organisation and its admin there and connects it."
        isLoading={isLoading}
        error={error?.detail}
        onRetry={reload}
        loadingRows={3}
      >
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {(data ?? []).map((tool) => (
            <div
              key={tool.key}
              className="grid content-start gap-2 rounded-lg border p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{tool.brand}</p>
                <span className="text-xs text-muted-foreground">
                  {tool.what}
                </span>
                {tool.key_set ? (
                  tool.last_check_ok === false ? (
                    <Badge variant="warning">
                      <XCircle /> Key not accepted
                    </Badge>
                  ) : (
                    <Badge variant="success">
                      <CheckCircle2 />{" "}
                      {tool.key_source === "env"
                        ? "Key from server settings"
                        : "Key set"}
                    </Badge>
                  )
                ) : (
                  <Badge variant="outline">No key</Badge>
                )}
              </div>
              {tool.app_url ? (
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {tool.app_url}
                </p>
              ) : (
                <p className="text-xs text-destructive">
                  This server does not know where {tool.brand} is.
                </p>
              )}
              {tool.last_checked_at ? (
                <p className="text-xs text-muted-foreground">
                  Checked {formatDate(tool.last_checked_at)}:{" "}
                  {tool.last_check_message}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void generate(tool)}
                >
                  {busy === tool.key ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <KeyRound />
                  )}
                  {tool.key_source === "platform" ? "New key" : "Generate key"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => setPasting(tool)}
                >
                  <ClipboardPaste /> Paste key
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null || !tool.key_set || !tool.app_url}
                  onClick={() => void check(tool)}
                >
                  <PlugZap /> Check
                </Button>
                {tool.key_source === "platform" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => setRemoving(tool)}
                  >
                    <Trash2 /> Remove
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </DataPanel>

      <GeneratedKeyDialog tool={generated} onClose={() => setGenerated(null)} />
      <PasteKeyDialog
        tool={pasting}
        onClose={() => setPasting(null)}
        onSaved={() => {
          setPasting(null);
          reload();
        }}
      />
      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove the {removing?.brand} key?</DialogTitle>
            <DialogDescription>
              New organisations can no longer be set up in {removing?.brand}{" "}
              from here. Organisations already connected keep working: each has
              a key of its own.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={() => {
                const target = removing;
                if (!target) return;
                setRemoving(null);
                void run(target.key, async () => {
                  await del(`/platform/tools/${target.key}/key`);
                  toast.success(`${target.brand} key removed.`);
                  reload();
                });
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GeneratedKeyDialog({
  tool,
  onClose,
}: {
  tool: PlatformTool | null;
  onClose: () => void;
}) {
  const copy = async () => {
    if (!tool?.generated) return;
    try {
      await navigator.clipboard.writeText(tool.generated);
      toast.success("Copied.");
    } catch {
      toast.error("Could not copy; select the text instead.");
    }
  };
  return (
    <Dialog open={tool !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New key for {tool?.brand}</DialogTitle>
          <DialogDescription>
            Shown only now. Set it on {tool?.brand}&apos;s server as{" "}
            <span className="font-mono">ASKMIRA_PLATFORM_SECRET</span>, restart
            it, then press Check.
          </DialogDescription>
        </DialogHeader>
        <Alert>
          <KeyRound />
          <AlertTitle>ASKMIRA_PLATFORM_SECRET</AlertTitle>
          <AlertDescription>
            <p className="break-all font-mono text-xs">{tool?.generated}</p>
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button variant="outline" onClick={() => void copy()}>
            <Copy /> Copy
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasteKeyDialog({
  tool,
  onClose,
  onSaved,
}: {
  tool: PlatformTool | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const trimmed = value.trim();
  const problem =
    trimmed === ""
      ? null
      : /\s/.test(trimmed)
        ? "A key has no spaces."
        : trimmed.length < 32
          ? "A key is at least 32 characters."
          : null;

  const save = async () => {
    if (!tool || !trimmed || problem) return;
    setSaving(true);
    try {
      await put(`/platform/tools/${tool.key}/key`, { secret: trimmed });
      toast.success(`${tool.brand} key saved. Press Check to try it.`);
      setValue("");
      onSaved();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError ? caught.detail : "Could not save the key.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={tool !== null}
      onOpenChange={(open) => {
        if (!open) {
          setValue("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Paste the {tool?.brand} key</DialogTitle>
          <DialogDescription>
            The value {tool?.brand}&apos;s server has as{" "}
            <span className="font-mono">ASKMIRA_PLATFORM_SECRET</span>.
          </DialogDescription>
        </DialogHeader>
        <FormField
          label="Key"
          htmlFor="platform-tool-key"
          error={problem ?? undefined}
        >
          <Input
            id="platform-tool-key"
            type="password"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
            }}
          />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={saving || !trimmed || problem !== null}
            onClick={() => void save()}
          >
            {saving ? <Loader2 className="animate-spin" /> : null} Save key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
