"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Calculator, Copy, MoreHorizontal, Pencil, Plus, Power, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import { apiMessage } from "@/components/payroll/labels";
import { StructureEditor, type StructureEditorMode } from "@/components/payroll/structures/StructureEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del, get, patch } from "@/lib/api";
import type { SalaryComponent, SalaryTemplate, SalaryTemplateDraft, SalaryTemplateSummary } from "@/lib/types/payroll";

/**
 * Payroll → Salary structures: the CTC templates the Salary master splits a
 * person's CTC with. New, edit, copy, switch off, and delete one nobody uses.
 */
export function StructuresPanel({ components }: { components: SalaryComponent[] }) {
  const structures = useApiQuery<SalaryTemplateSummary[]>("/salary-templates");
  const [editor, setEditor] = useState<StructureEditorMode | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SalaryTemplateSummary | null>(null);

  const openNew = async () => {
    setOpening("new");
    try {
      setEditor({ kind: "new", draft: await get<SalaryTemplateDraft>("/salary-templates/new") });
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not start a new structure."));
    } finally {
      setOpening(null);
    }
  };

  const open = async (row: SalaryTemplateSummary, kind: "edit" | "copy") => {
    setOpening(row.id);
    try {
      const template = await get<SalaryTemplate>(`/salary-templates/${row.id}`);
      setEditor({ kind, template });
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not open the structure."));
    } finally {
      setOpening(null);
    }
  };

  const switchActive = async (row: SalaryTemplateSummary) => {
    try {
      await patch(`/salary-templates/${row.id}`, { active: !row.active });
      toast.success(row.active ? `${row.name} switched off.` : `${row.name} switched on.`);
      structures.reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not change the structure."));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await del(`/salary-templates/${deleting.id}`);
      toast.success(`${deleting.name} deleted.`);
      structures.reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not delete the structure."));
      throw caught;
    }
  };

  const columns: ColumnDef<SalaryTemplateSummary>[] = [
    {
      accessorKey: "name",
      header: "Structure",
      meta: { text: (row) => `${row.name} ${row.description ?? ""}` },
      cell: ({ row }) => (
        <div className="grid min-w-48 gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
            {row.original.name}
            {!row.original.active && <Badge variant="muted">Off</Badge>}
            {!row.original.is_template && <Badge variant="outline">Earlier kind</Badge>}
          </span>
          {row.original.description && (
            <span className="text-xs text-muted-foreground">{row.original.description}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "summary",
      header: "How the CTC is split",
      meta: { cellClassName: "max-w-xl text-sm text-muted-foreground" },
      cell: ({ row }) => <span className="line-clamp-2">{row.original.summary}</span>,
    },
    {
      id: "employer",
      header: "Employer PF / ESIC",
      accessorFn: (row) => (row.employer_in_ctc.length ? row.employer_in_ctc.join(", ") : "On top of CTC"),
      cell: ({ row }) =>
        row.original.employer_in_ctc.length ? (
          <div className="flex flex-wrap gap-1">
            {row.original.employer_in_ctc.map((name) => (
              <Badge key={name} variant="outline">
                {name.includes("PF") ? "PF inside CTC" : "ESIC inside CTC"}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">On top of CTC</span>
        ),
    },
    {
      accessorKey: "used_by",
      header: "Used by",
      meta: { cellClassName: "tabular-nums text-sm", text: (row) => `${row.used_by}` },
      cell: ({ row }) => `${row.original.used_by} ${row.original.used_by === 1 ? "person" : "people"}`,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { label: "Actions", cellClassName: "w-12 text-right" },
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${row.original.name}`}
              disabled={opening === row.original.id}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => void open(row.original, "edit")}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void open(row.original, "copy")}>
              <Copy /> Make a copy
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void switchActive(row.original)}>
              <Power /> {row.original.active ? "Switch off" : "Switch on"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(row.original)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <DataTable
        title="Salary structures"
        description="CTC templates: the share of the CTC each wage type gets. Pick one on the Salary master to fill a salary from the CTC."
        tier="tier1"
        columns={columns}
        data={structures.data ?? []}
        getRowId={(row) => row.id}
        noun="structures"
        exportName="salary-structures"
        searchPlaceholder="Search structures"
        selectable={false}
        isLoading={structures.isLoading && !structures.data}
        error={structures.error?.detail}
        onRetry={structures.reload}
        onRowClick={(row) => void open(row, "edit")}
        actions={
          <Button onClick={() => void openNew()} disabled={opening === "new"}>
            <Plus /> New structure
          </Button>
        }
        empty={{
          icon: Calculator,
          title: "No salary structures yet",
          description: "Create one: Basic, HRA and the rest as shares of the CTC, with one taking the balance.",
        }}
      />

      <StructureEditor
        mode={editor}
        components={components}
        onClose={() => setEditor(null)}
        onSaved={() => structures.reload()}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(value) => !value && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "this structure"}?`}
        description="Only a structure no salary or offer uses can be deleted. One in use can be switched off instead."
        confirmLabel="Delete structure"
        destructive
        onConfirm={remove}
      />
    </>
  );
}
