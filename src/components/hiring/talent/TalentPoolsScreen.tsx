"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FolderHeart, Loader2, Plus, Trash2, UserMinus } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
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
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, post } from "@/lib/api";
import type { TalentPool, TalentPoolDetail, TalentPoolMember } from "@/lib/types/hiring";

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

  const columns: ColumnDef<TalentPool>[] = [
    {
      accessorKey: "name",
      header: "Pool",
      meta: { text: (pool) => [pool.name, pool.description].filter(Boolean).join(" · ") },
      cell: ({ row }) => (
        <>
          <div className="font-medium text-foreground">{row.original.name}</div>
          {row.original.description && (
            <div className="text-xs text-muted-foreground">{row.original.description}</div>
          )}
        </>
      ),
    },
    {
      accessorKey: "members",
      header: "Candidates",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      accessorKey: "created_at",
      header: "Created",
      meta: { cellClassName: "text-xs text-muted-foreground", text: (pool) => formatDateTime(pool.created_at) },
      cell: ({ row }) => formatDateTime(row.original.created_at),
    },
    {
      id: "actions",
      header: "Actions",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="outline" onClick={() => setOpen(row.original)}>
            Open
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Delete ${row.original.name}`}
            onClick={() => setDeleting(row.original)}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

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
      <DataTable
        title="Pools"
        columns={columns}
        data={pools.data ?? []}
        noun="pools"
        exportName="talent-pools"
        searchPlaceholder="Search pools"
        isLoading={pools.isLoading}
        error={pools.error?.detail ?? null}
        onRetry={pools.reload}
        empty={{
          icon: FolderHeart,
          title: "No talent pools yet",
          description: "Create one, then add candidates to it from their profile.",
        }}
      />

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

  // The last pool opened stays in `data` until this one's members arrive: never
  // show them under this pool's name.
  const members = data && pool && data.pool.id === pool.id ? data.members : [];

  const columns: ColumnDef<TalentPoolMember>[] = [
    {
      accessorKey: "full_name",
      header: "Candidate",
      meta: {
        text: (member) => [member.full_name, member.email, ...member.tags, member.note].filter(Boolean).join(" · "),
      },
      cell: ({ row }) => (
        <>
          <Link href={`/hiring/candidates/${row.original.candidate_id}`} className="hover:underline">
            <PersonCell name={row.original.full_name} subtitle={row.original.email} size="sm" />
          </Link>
          {row.original.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {row.original.tags.map((tag) => (
                <Badge key={tag} variant="muted">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          {row.original.note && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{row.original.note}</p>}
        </>
      ),
    },
    {
      accessorKey: "last_requisition",
      header: "Last applied for",
      meta: {
        cellClassName: "text-sm",
        text: (member) => `${member.last_requisition} · ${CANDIDATE_STAGE[member.stage]?.[0] ?? member.stage}`,
      },
      cell: ({ row }) => (
        <>
          {row.original.last_requisition}
          <div className="mt-1">
            <StatusBadge map={CANDIDATE_STAGE} value={row.original.stage} />
          </div>
        </>
      ),
    },
    {
      accessorKey: "consent",
      header: "Consent",
      meta: {
        text: (member) => (member.consent === "granted" ? "Agreed to be kept" : "Withdrawn — do not contact"),
      },
      cell: ({ row }) =>
        row.original.consent === "granted" ? (
          <Badge variant="success">Agreed to be kept</Badge>
        ) : (
          <Badge variant="destructive">Withdrawn — do not contact</Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Remove ${row.original.full_name} from the pool`}
          disabled={busy === row.original.candidate_id}
          onClick={() => void removeMember(row.original.candidate_id)}
        >
          {busy === row.original.candidate_id ? <Loader2 className="animate-spin" /> : <UserMinus />}
        </Button>
      ),
    },
  ];

  return (
    <Sheet open={pool !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{pool?.name}</SheetTitle>
          <SheetDescription>{pool?.description ?? "Candidates kept for later, with their consent as it stands today."}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <DataTable
            columns={columns}
            data={members}
            getRowId={(member) => member.candidate_id}
            noun="candidates"
            exportName={pool ? `talent-pool-${pool.name}` : "talent-pool"}
            searchPlaceholder="Search candidates"
            isLoading={isLoading}
            error={error?.detail ?? null}
            onRetry={reload}
            empty={{ icon: FolderHeart, title: "Nobody in this pool yet", description: "Add candidates from their profile." }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
