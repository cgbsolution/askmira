"use client";

import { FolderHeart, Loader2, Plus, Trash2, UserMinus } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { CANDIDATE_STAGE, StatusBadge, formatDateTime } from "@/components/hiring/labels";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, post } from "@/lib/api";
import type { TalentPool, TalentPoolDetail } from "@/lib/types/hiring";

/**
 * Talent pools: candidates kept for roles that are not open yet.
 *
 * A pool admits only candidates who agreed to be kept (talent-pool consent),
 * and shows anybody who has since withdrawn as withdrawn — not to be
 * contacted — rather than dropping them silently.
 */
export function TalentPoolsScreen() {
  const pools = useApiQuery<TalentPool[]>("/hiring/talent-pools");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<TalentPool | null>(null);
  const [deleting, setDeleting] = useState<TalentPool | null>(null);

  const remove = async () => {
    if (!deleting) return;
    try {
      await del(`/hiring/talent-pools/${deleting.id}`);
      toast.success("Pool deleted. Its candidates are unaffected.");
      pools.reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The pool could not be deleted.");
      throw caught;
    }
  };

  return (
    <PageShell
      title="Talent pools"
      description="Candidates worth a call when the right role opens. Only those who agreed to be kept can be added."
      actions={
        <Button variant="accent" onClick={() => setCreating(true)}>
          <Plus /> New pool
        </Button>
      }
    >
      <DataPanel
        title="Pools"
        isLoading={pools.isLoading}
        error={pools.error?.detail ?? null}
        onRetry={pools.reload}
        isEmpty={(pools.data ?? []).length === 0}
        empty={{
          icon: FolderHeart,
          title: "No talent pools yet",
          description: "Create one, then add candidates to it from their profile.",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pool</TableHead>
              <TableHead className="text-right">Candidates</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(pools.data ?? []).map((pool) => (
              <TableRow key={pool.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{pool.name}</div>
                  {pool.description && <div className="text-xs text-muted-foreground">{pool.description}</div>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{pool.members}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(pool.created_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => setOpen(pool)}>
                      Open
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Delete ${pool.name}`} onClick={() => setDeleting(pool)}>
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      <CreatePoolDialog open={creating} onOpenChange={setCreating} onCreated={pools.reload} />
      <PoolSheet pool={open} onOpenChange={(next) => !next && setOpen(null)} onChanged={pools.reload} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ""}?`}
        description="The list goes. The candidates, their records and their consent are not touched."
        confirmLabel="Delete pool"
        destructive
        onConfirm={remove}
      />
    </PageShell>
  );
}

function CreatePoolDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    try {
      await post("/hiring/talent-pools", { name: name.trim(), description: description.trim() || undefined });
      toast.success("Pool created.");
      setName("");
      setDescription("");
      onOpenChange(false);
      onCreated();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The pool could not be created.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New talent pool</DialogTitle>
          <DialogDescription>Name it for the roles it is for, not the people in it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="pool-name" label="Name">
            <Input id="pool-name" maxLength={120} placeholder="Backend engineers, Pune" value={name} onChange={(event) => setName(event.target.value)} />
          </FormField>
          <FormField htmlFor="pool-description" label="Description" optional>
            <Textarea id="pool-description" rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isSaving || !name.trim()} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PoolSheet({
  pool,
  onOpenChange,
  onChanged,
}: {
  pool: TalentPool | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const { data, error, isLoading, reload } = useApiQuery<TalentPoolDetail>(pool ? `/hiring/talent-pools/${pool.id}` : null);
  const [busy, setBusy] = useState<string | null>(null);

  const removeMember = async (candidateId: string) => {
    if (!pool) return;
    setBusy(candidateId);
    try {
      await del(`/hiring/talent-pools/${pool.id}/members/${candidateId}`);
      reload();
      onChanged();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "They could not be removed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={pool !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{pool?.name}</SheetTitle>
          <SheetDescription>{pool?.description ?? "Candidates kept for later, with their consent as it stands today."}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <DataPanel
            isLoading={isLoading}
            error={error?.detail ?? null}
            onRetry={reload}
            isEmpty={(data?.members ?? []).length === 0}
            empty={{ icon: FolderHeart, title: "Nobody in this pool yet", description: "Add candidates from their profile." }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Last applied for</TableHead>
                  <TableHead>Consent</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.members ?? []).map((member) => (
                  <TableRow key={member.candidate_id}>
                    <TableCell>
                      <Link href={`/hiring/candidates/${member.candidate_id}`} className="hover:underline">
                        <PersonCell name={member.full_name} subtitle={member.email} size="sm" />
                      </Link>
                      {member.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {member.tags.map((tag) => (
                            <Badge key={tag} variant="muted">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {member.note && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{member.note}</p>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {member.last_requisition}
                      <div className="mt-1">
                        <StatusBadge map={CANDIDATE_STAGE} value={member.stage} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.consent === "granted" ? (
                        <Badge variant="success">Agreed to be kept</Badge>
                      ) : (
                        <Badge variant="destructive">Withdrawn — do not contact</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove ${member.full_name} from the pool`}
                        disabled={busy === member.candidate_id}
                        onClick={() => void removeMember(member.candidate_id)}
                      >
                        {busy === member.candidate_id ? <Loader2 className="animate-spin" /> : <UserMinus />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataPanel>
        </div>
      </SheetContent>
    </Sheet>
  );
}
