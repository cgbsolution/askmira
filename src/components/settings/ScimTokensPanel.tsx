"use client";

import { Copy, Loader2, Plus, Radio } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { ScimToken, ScimTokenCreated } from "@/lib/types/sso";

import { errorDetail, formatDateTime } from "./settingsShared";

/**
 * Directory sync tokens.
 *
 * A token is shown once, at creation, and only a hint is stored afterwards —
 * so the dialog that issues one is the only chance to copy it, and says so.
 * Revoking is immediate and cannot be undone; the directory simply starts
 * failing, which is the intended outcome when a token has leaked.
 */
export function ScimTokensPanel({ canManage }: { canManage: boolean }) {
  const { data, error, isLoading, reload } = useApiQuery<ScimToken[]>("/sso/scim-tokens");
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [issued, setIssued] = useState<ScimTokenCreated | null>(null);
  const [revoking, setRevoking] = useState<ScimToken | null>(null);

  const create = async () => {
    setIsBusy(true);
    try {
      const created = await post<ScimTokenCreated>("/sso/scim-tokens", { name: name.trim() });
      setIssued(created);
      setNaming(false);
      setName("");
      reload();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not create the token."));
    } finally {
      setIsBusy(false);
    }
  };

  const revoke = async () => {
    if (!revoking) return;
    try {
      await post(`/sso/scim-tokens/${revoking.id}/revoke`);
      toast.success("Token revoked. Directory sync using it will now fail.");
      reload();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not revoke the token."));
      throw caught;
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied. Paste it into your identity provider now.");
    } catch {
      toast.error("Could not copy. Select the token and copy it by hand.");
    }
  };

  const rows = data ?? [];

  return (
    <>
      <DataPanel
        title="Directory sync tokens"
        description="Your identity provider uses one of these to create, update and deactivate logins over SCIM."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setNaming(true)}>
              <Plus /> New token
            </Button>
          ) : undefined
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: Radio,
          title: "No directory tokens",
          description: "Logins are managed here rather than synced from a directory.",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last used</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className={row.active ? undefined : "opacity-60"}>
                <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                <TableCell>
                  <code className="font-mono text-xs text-muted-foreground">…{row.hint}</code>
                  <Badge variant={row.active ? "secondary" : "outline"} className="ml-2">
                    {row.active ? "Active" : "Revoked"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDateTime(row.created_at)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.last_used_at ? (
                    formatDateTime(row.last_used_at)
                  ) : (
                    <span>Never — your IdP has not called yet</span>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    {row.active && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setRevoking(row)}
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      <Dialog open={naming} onOpenChange={(next) => !isBusy && setNaming(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New directory token</DialogTitle>
            <DialogDescription>
              Name it after the system that will use it, so revoking the right one later is
              obvious.
            </DialogDescription>
          </DialogHeader>
          <FormField htmlFor="scim-token-name" label="Name">
            <Input
              id="scim-token-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Azure AD provisioning"
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNaming(false)} disabled={isBusy}>
              Cancel
            </Button>
            <Button onClick={create} disabled={isBusy || name.trim().length === 0}>
              {isBusy && <Loader2 className="animate-spin" />} Create token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={issued !== null} onOpenChange={(next) => !next && setIssued(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Token for {issued?.name}</DialogTitle>
            <DialogDescription>
              This is the only time it is shown. Only a hash is stored, so it cannot be recovered
              — if you lose it, revoke it and create another.
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <AlertTitle>Bearer token</AlertTitle>
            <AlertDescription>
              <code className="mt-1 block break-all rounded bg-muted px-3 py-2 font-mono text-xs text-foreground">
                {issued?.token}
              </code>
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => issued && copy(issued.token)}>
              <Copy /> Copy token
            </Button>
            <Button onClick={() => setIssued(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={`Revoke ${revoking?.name ?? ""}?`}
        description="Directory sync using this token starts failing immediately. This cannot be undone — issue a new token instead."
        confirmLabel="Revoke token"
        destructive
        onConfirm={revoke}
      />
    </>
  );
}
