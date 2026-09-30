"use client";

import { ListPlus, Loader2, Lock, Pencil, Plus, Power, Tags, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del, patch, post } from "@/lib/api";
import type { ManagedUser } from "@/lib/types/admin";
import type {
  HelpdeskCategory,
  StandardCategoriesResult,
  StandardCategory,
} from "@/lib/types/helpdesk";

import { CategoryDialog } from "./CategoryDialog";
import { REQUEST_KIND_LABEL, errorDetail } from "./shared";

/**
 * Helpdesk categories (tenant and HR admins): what employees can ask about,
 * who handles each and its SLA. Nothing is added until an admin adds it —
 * the standard set included.
 */
export function CategoriesScreen() {
  const categories = useApiQuery<HelpdeskCategory[]>("/helpdesk/categories?include_inactive=true");
  const users = useApiQuery<ManagedUser[]>("/admin/users");
  // What the standard action adds, from the server, so the admin reads it before clicking.
  const standard = useApiQuery<StandardCategory[]>("/helpdesk/categories/standard");
  const [editing, setEditing] = useState<HelpdeskCategory | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmStandard, setConfirmStandard] = useState(false);
  const [deleting, setDeleting] = useState<HelpdeskCategory | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = categories.data ?? [];

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const addStandard = async () => {
    try {
      const result = await post<StandardCategoriesResult>("/helpdesk/categories/standard");
      if (result.created.length === 0) {
        toast.info("All the standard categories are already here.");
      } else {
        toast.success(
          `Added ${result.created.length} categor${result.created.length === 1 ? "y" : "ies"}`,
          {
            description: result.skipped.length
              ? `Already present, left as they were: ${result.skipped.join(", ")}.`
              : "Set an owner on each one, or leave them with HR's shared queue.",
          },
        );
      }
      categories.reload();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not add the standard categories."));
      throw caught;
    }
  };

  const toggleActive = async (category: HelpdeskCategory) => {
    setBusyId(category.id);
    try {
      await patch<HelpdeskCategory>(`/helpdesk/categories/${category.id}`, {
        active: !category.active,
      });
      toast.success(category.active ? `${category.name} switched off` : `${category.name} switched on`);
      categories.reload();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not change the category."));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await del(`/helpdesk/categories/${deleting.id}`);
      toast.success(`${deleting.name} deleted`);
      categories.reload();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not delete the category."));
      throw caught;
    }
  };

  const actions = (
    <>
      <Button variant="outline" onClick={() => setConfirmStandard(true)}>
        <ListPlus /> Add the standard categories
      </Button>
      <Button onClick={openNew}>
        <Plus /> New category
      </Button>
    </>
  );

  return (
    <PageShell
      title="Helpdesk categories"
      description="What employees can raise tickets about, who handles each kind and how fast."
      actions={actions}
    >
      <DataPanel
        title="Categories"
        description="Employees see active categories, in this order, when they raise a ticket."
        isLoading={categories.isLoading && !categories.data}
        error={categories.error?.detail}
        onRetry={categories.reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: Tags,
          title: "No categories yet",
          description:
            "Until there is at least one, employees cannot raise a ticket. Start from the standard Indian-HR set, or add your own.",
        }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Handled by</TableHead>
                <TableHead className="text-right">SLA</TableHead>
                <TableHead className="text-right">Tickets</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="max-w-96">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-foreground">{category.name}</span>
                      {category.is_confidential && (
                        <Badge variant="secondary">
                          <Lock /> Confidential
                        </Badge>
                      )}
                    </div>
                    {category.description && (
                      <p className="truncate text-xs text-muted-foreground">{category.description}</p>
                    )}
                  </TableCell>
                  <TableCell>{REQUEST_KIND_LABEL[category.request_kind]}</TableCell>
                  <TableCell>
                    {category.owner_name ?? (
                      <span className="text-muted-foreground">HR (shared queue)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{category.sla_hours} h</TableCell>
                  <TableCell className="text-right tabular-nums">{category.ticket_count ?? "—"}</TableCell>
                  <TableCell>
                    {category.active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="muted">Switched off</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${category.name}`}
                        onClick={() => {
                          setEditing(category);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={category.active ? `Switch off ${category.name}` : `Switch on ${category.name}`}
                        disabled={busyId === category.id}
                        onClick={() => void toggleActive(category)}
                      >
                        {busyId === category.id ? <Loader2 className="animate-spin" /> : <Power />}
                      </Button>
                      {category.ticket_count === 0 && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${category.name}`}
                          onClick={() => setDeleting(category)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataPanel>

      <CategoryDialog
        open={dialogOpen}
        category={editing}
        users={users.data ?? []}
        onOpenChange={setDialogOpen}
        onSaved={categories.reload}
      />

      <ConfirmDialog
        open={confirmStandard}
        onOpenChange={setConfirmStandard}
        title="Add the standard categories?"
        description="These are added with suggested SLAs and no owner, so tickets go to HR's shared queue until you set one. Any name you already have is left as it is."
        confirmLabel="Add them"
        onConfirm={addStandard}
      >
        <ul className="space-y-1 text-sm text-foreground">
          {(standard.data ?? []).map((item) => (
            <li key={item.name} className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-1.5">
                {item.name}
                {item.is_confidential && <Lock className="size-3.5 text-muted-foreground" />}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {item.sla_hours} h SLA
              </span>
            </li>
          ))}
        </ul>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete ${deleting.name}?` : "Delete category?"}
        description="Nobody has raised a ticket in it, so it can be removed. To keep it for later, switch it off instead."
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
      />
    </PageShell>
  );
}
