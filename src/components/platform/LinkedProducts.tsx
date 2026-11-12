"use client";

import { Link2, Loader2, Plus, RefreshCw, Search, Unplug } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, post } from "@/lib/api";
import { formatDate } from "@/lib/utils";

import { type ProductOrganization, provision, VIA_LABEL, type WorkspaceTool } from "./tools";

/**
 * Platform → Organisation → View: the organisation in each of our tools.
 *
 * Connect creates its organisation and admin in the tool (or, when the admin
 * already has one there, asks which way to go); Link existing attaches one the
 * tool already has. Either way the workspace gets a key of its own and its
 * people are synced; its admin sees the connection under Settings → Connectors.
 */
export function LinkedProducts({ workspaceId, active }: { workspaceId: string; active: boolean }) {
  const path = `/platform/workspaces/${workspaceId}/products`;
  const { data, error, isLoading, reload } = useApiQuery<WorkspaceTool[]>(path);
  const [busy, setBusy] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<WorkspaceTool | null>(null);
  /** The tool asking "link the one they have, or make a new one?" */
  const [choosing, setChoosing] = useState<{
    tool: WorkspaceTool;
    message: string;
    organizations: ProductOrganization[];
  } | null>(null);
  const [searching, setSearching] = useState<WorkspaceTool | null>(null);

  const failed = (caught: unknown) =>
    toast.error(caught instanceof ApiError ? caught.detail : "That did not work. Try again.");

  const connect = async (
    tool: WorkspaceTool,
    body: { organization_ref?: string; create_new?: boolean } = {},
  ) => {
    setBusy(tool.key);
    try {
      const result = await provision(workspaceId, tool.key, body);
      if (result.outcome === "existing") {
        setChoosing({ tool, message: result.message, organizations: result.organizations });
        return;
      }
      setChoosing(null);
      setSearching(null);
      const what = result.created
        ? `${tool.brand}: new organisation “${result.tool.organization}” created`
        : `${tool.brand}: connected to “${result.tool.organization}”`;
      if (result.tool.last_error) toast.warning(`${what}, but the people sync failed: ${result.tool.last_error}`);
      else toast.success(what, { description: result.admin_note });
      reload();
    } catch (caught) {
      failed(caught);
    } finally {
      setBusy(null);
    }
  };

  const sync = async (tool: WorkspaceTool) => {
    setBusy(tool.key);
    try {
      const result = await post<WorkspaceTool>(`${path}/${tool.key}/sync`);
      if (result.last_error) toast.warning(`The people sync failed: ${result.last_error}`);
      else toast.success(`${tool.brand}: people synced`);
      reload();
    } catch (caught) {
      failed(caught);
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <Skeleton className="h-28 w-full" />;
  if (error) return <ErrorState message={error.detail} onRetry={reload} className="py-6" />;

  return (
    <div className="grid gap-3">
      {(data ?? []).map((tool) => {
        const last = tool.last_sync;
        return (
          <div key={tool.key} className="grid gap-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {tool.brand}
                  <span className="text-xs font-normal text-muted-foreground">{tool.what}</span>
                  {tool.connected ? (
                    <Badge variant="success">Connected</Badge>
                  ) : (
                    <Badge variant="outline">Not connected</Badge>
                  )}
                </p>
                {tool.connected ? (
                  <p className="text-xs text-muted-foreground">
                    {tool.organization ? (
                      <>
                        Organisation there: <span className="font-medium text-foreground">{tool.organization}</span> ·{" "}
                      </>
                    ) : null}
                    {tool.via ? VIA_LABEL[tool.via] : null}
                  </p>
                ) : !tool.ready ? (
                  <p className="text-xs text-muted-foreground">
                    Set the {tool.brand} key under Connected tools first, or let the organisation&apos;s admin connect it
                    from Settings → Connectors.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {tool.connected ? (
                  <>
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void sync(tool)}>
                      {busy === tool.key ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                      Sync people
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => setDisconnecting(tool)}
                    >
                      <Unplug /> Disconnect
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      disabled={busy !== null || !tool.ready || !active}
                      onClick={() => void connect(tool)}
                    >
                      {busy === tool.key ? <Loader2 className="animate-spin" /> : <Plus />}
                      Create &amp; connect
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null || !tool.ready || !active}
                      onClick={() => setSearching(tool)}
                    >
                      <Link2 /> Link existing
                    </Button>
                  </>
                )}
              </div>
            </div>

            {tool.connected && last ? (
              <p className="text-xs text-muted-foreground">
                Last sync{tool.last_synced_at ? ` ${formatDate(tool.last_synced_at)}` : ""}: {last.sent} sent ·{" "}
                {last.created} added · {last.updated} updated · {last.deactivated} switched off
                {last.skipped.length ? ` · ${last.skipped.length} skipped` : ""}
              </p>
            ) : null}
            {tool.connected && last && last.skipped.length > 0 ? (
              <ul className="grid gap-0.5 text-xs text-muted-foreground">
                {last.skipped.slice(0, 5).map((skip) => (
                  <li key={skip.email} className="truncate">
                    <span className="font-mono">{skip.email}</span> — {skip.reason}
                  </li>
                ))}
              </ul>
            ) : null}
            {tool.connected && tool.last_error ? <p className="text-xs text-destructive">{tool.last_error}</p> : null}
          </div>
        );
      })}

      <ChooseDialog
        choice={choosing}
        busy={busy !== null}
        onClose={() => setChoosing(null)}
        onLink={(tool, ref) => void connect(tool, { organization_ref: ref })}
        onCreate={(tool) => void connect(tool, { create_new: true })}
      />
      <LinkExistingDialog
        workspaceId={workspaceId}
        tool={searching}
        busy={busy !== null}
        onClose={() => setSearching(null)}
        onLink={(tool, ref) => void connect(tool, { organization_ref: ref })}
      />

      <Dialog open={disconnecting !== null} onOpenChange={(open) => !open && setDisconnecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {disconnecting?.brand}?</DialogTitle>
            <DialogDescription>
              {disconnecting?.brand} forgets this organisation&apos;s key, and people stop being synced and can no
              longer open it from AskMiraa. Its organisation and data stay in {disconnecting?.brand}; you can link
              it again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={() => {
                const target = disconnecting;
                if (!target) return;
                setDisconnecting(null);
                setBusy(target.key);
                del<WorkspaceTool>(`${path}/${target.key}`)
                  .then(() => {
                    toast.success(`${target.brand} disconnected`);
                    reload();
                  })
                  .catch(failed)
                  .finally(() => setBusy(null));
              }}
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrganizationRow({
  organization,
  disabled,
  onLink,
}: {
  organization: ProductOrganization;
  disabled: boolean;
  onLink: () => void;
}) {
  const taken = organization.connected_to !== null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{organization.name}</p>
        {organization.admins.length ? (
          <p className="truncate text-xs text-muted-foreground">Admins: {organization.admins.join(", ")}</p>
        ) : null}
        {taken ? (
          <p className="text-xs text-muted-foreground">Already connected to another AskMiraa organisation.</p>
        ) : null}
      </div>
      <Button size="sm" variant="outline" disabled={disabled || taken} onClick={onLink}>
        <Link2 /> Link this one
      </Button>
    </li>
  );
}

function ChooseDialog({
  choice,
  busy,
  onClose,
  onLink,
  onCreate,
}: {
  choice: { tool: WorkspaceTool; message: string; organizations: ProductOrganization[] } | null;
  busy: boolean;
  onClose: () => void;
  onLink: (tool: WorkspaceTool, ref: string) => void;
  onCreate: (tool: WorkspaceTool) => void;
}) {
  return (
    <Dialog open={choice !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Already in {choice?.tool.brand}</DialogTitle>
          <DialogDescription>
            {choice?.message} Link the organisation they already have, so its data carries on, or create a new one.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {(choice?.organizations ?? []).map((organization) => (
            <OrganizationRow
              key={organization.ref}
              organization={organization}
              disabled={busy}
              onLink={() => choice && onLink(choice.tool, organization.ref)}
            />
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => choice && onCreate(choice.tool)}>
            {busy ? <Loader2 className="animate-spin" /> : <Plus />} Create a new one anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkExistingDialog({
  workspaceId,
  tool,
  busy,
  onClose,
  onLink,
}: {
  workspaceId: string;
  tool: WorkspaceTool | null;
  busy: boolean;
  onClose: () => void;
  onLink: (tool: WorkspaceTool, ref: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductOrganization[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (tool === null) {
      setQuery("");
      setResults(null);
      setProblem(null);
    }
  }, [tool]);

  // Suggests as you type: a short pause, then the tool is asked.
  useEffect(() => {
    if (tool === null) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setProblem(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      post<ProductOrganization[]>(`/platform/workspaces/${workspaceId}/products/${tool.key}/organizations`, { q })
        .then((found) => {
          if (cancelled) return;
          setResults(found);
          setProblem(null);
        })
        .catch((caught) => {
          if (cancelled) return;
          setResults(null);
          setProblem(caught instanceof ApiError ? caught.detail : "Could not search. Try again.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, tool, workspaceId]);

  return (
    <Dialog open={tool !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link an existing {tool?.brand} organisation</DialogTitle>
          <DialogDescription>
            For a company that already uses {tool?.brand}. Search by its name or an admin&apos;s email; its people
            and data stay as they are, and AskMiraa&apos;s people are matched to them by email.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={`Search ${tool?.brand ?? ""} organisations`}
            className="pl-8"
            placeholder="Organisation name or admin email"
            value={query}
            maxLength={120}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : problem ? (
          <p className="text-sm text-destructive">{problem}</p>
        ) : results === null ? (
          <p className="text-sm text-muted-foreground">Type at least two letters.</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground">No organisation in {tool?.brand} matches.</p>
        ) : (
          <ul className="grid max-h-72 gap-2 overflow-y-auto">
            {results.map((organization) => (
              <OrganizationRow
                key={organization.ref}
                organization={organization}
                disabled={busy}
                onLink={() => tool && onLink(tool, organization.ref)}
              />
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
