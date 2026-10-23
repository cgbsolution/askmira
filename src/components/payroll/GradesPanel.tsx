"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Layers, Loader2, Pencil, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { RequireRole } from "@/components/common/RequireRole";
import { apiMessage, isAmount } from "@/components/payroll/labels";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch, post } from "@/lib/api";

export interface PayGrade {
  id: string;
  code: string;
  name: string;
  level: number;
  band_min: string;
  band_mid: string;
  band_max: string;
  currency: string;
  active: boolean;
  headcount: number;
}

interface Positioned {
  employee_id: string;
  employee_code: string;
  name: string;
  designation: string | null;
  grade: string | null;
  ctc_annual: string | null;
  band_min: string | null;
  band_max: string | null;
  compa_ratio: string | null;
  position: "below" | "within" | "above" | "no_grade" | "no_salary";
}

interface Positioning {
  as_of: string;
  summary: Record<Positioned["position"], number>;
  people: Positioned[];
}

const POSITION: Record<Positioned["position"], { label: string; variant: "warning" | "success" | "secondary" | "muted" }> = {
  below: { label: "Below band", variant: "warning" },
  within: { label: "In band", variant: "success" },
  above: { label: "Above band", variant: "secondary" },
  no_grade: { label: "No grade", variant: "muted" },
  no_salary: { label: "No salary", variant: "muted" },
};

const POSITIONING_COLUMNS: ColumnDef<Positioned>[] = [
  {
    accessorKey: "name",
    header: "Person",
    meta: {
      text: (person) => `${person.name} ${person.employee_code}${person.designation ? ` · ${person.designation}` : ""}`,
    },
    cell: ({ row }) => (
      <>
        <p className="font-medium">{row.original.name}</p>
        <p className="text-xs text-muted-foreground">
          {row.original.employee_code}
          {row.original.designation ? ` · ${row.original.designation}` : ""}
        </p>
      </>
    ),
  },
  {
    accessorKey: "grade",
    header: "Grade",
    cell: ({ row }) => row.original.grade ?? "—",
  },
  {
    accessorKey: "ctc_annual",
    header: "Annual CTC",
    meta: { className: "text-right" },
    cell: ({ row }) => (row.original.ctc_annual ? <Money value={row.original.ctc_annual} /> : "—"),
  },
  {
    accessorKey: "compa_ratio",
    header: "Compa-ratio",
    meta: { className: "text-right tabular-nums" },
    cell: ({ row }) => row.original.compa_ratio ?? "—",
  },
  {
    accessorKey: "position",
    header: "Position",
    meta: { text: (person) => POSITION[person.position].label },
    cell: ({ row }) => (
      <Badge variant={POSITION[row.original.position].variant}>{POSITION[row.original.position].label}</Badge>
    ),
  },
];

/** The grade master and each band's CTC range. Admins edit; HR reads. */
export function GradesPanel() {
  const { data, error, isLoading, reload } = useApiQuery<PayGrade[]>("/pay-grades?include_inactive=true");
  const [editing, setEditing] = useState<PayGrade | "new" | null>(null);
  const rows = data ?? [];

  const columns: ColumnDef<PayGrade>[] = [
    {
      id: "grade",
      header: "Grade",
      accessorFn: (grade) => `${grade.code} · ${grade.name}`,
      meta: {
        text: (grade) => `${grade.code} · ${grade.name} · Level ${grade.level}${grade.active ? "" : " · not in use"}`,
      },
      cell: ({ row }) => (
        <>
          <p className="font-medium">
            {row.original.code} · {row.original.name}
          </p>
          <p className="text-xs text-muted-foreground">
            Level {row.original.level}
            {!row.original.active && " · not in use"}
          </p>
        </>
      ),
    },
    {
      accessorKey: "band_min",
      header: "Minimum",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.band_min} />,
    },
    {
      accessorKey: "band_mid",
      header: "Midpoint",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.band_mid} />,
    },
    {
      accessorKey: "band_max",
      header: "Maximum",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.band_max} />,
    },
    {
      accessorKey: "headcount",
      header: "People",
      meta: { className: "text-right tabular-nums" },
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "w-12 text-right", text: false },
      cell: ({ row }) => (
        <RequireRole roles={["admin"]}>
          <Button size="icon" variant="ghost" aria-label={`Edit ${row.original.code}`} onClick={() => setEditing(row.original)}>
            <Pencil />
          </Button>
        </RequireRole>
      ),
    },
  ];

  return (
    <div className="grid gap-6">
      <DataTable
        title="Grades and pay bands"
        description="Once grades exist, an employee record can only carry one of them."
        actions={
          <RequireRole roles={["admin"]}>
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus /> Add a grade
            </Button>
          </RequireRole>
        }
        columns={columns}
        data={rows}
        noun="grades"
        exportName="pay-grades"
        searchPlaceholder="Search grades"
        rowClassName={(grade) => (grade.active ? undefined : "opacity-60")}
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        empty={{ icon: Layers, title: "No grades yet", description: "Add each grade with the annual CTC band it pays." }}
      />
      {rows.length > 0 && <PositioningTable />}
      {editing && (
        <GradeDialog
          grade={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function PositioningTable() {
  const { data, error, isLoading, reload } = useApiQuery<Positioning>("/pay-grades/positioning");
  return (
    <DataTable
      title="Where pay sits in the band"
      description={
        data
          ? `CTC in force today against each person's grade. ${data.summary.below} below, ${data.summary.within} within, ${data.summary.above} above; ${data.summary.no_grade} without a grade, ${data.summary.no_salary} without a salary.`
          : undefined
      }
      columns={POSITIONING_COLUMNS}
      data={data?.people ?? []}
      getRowId={(person) => person.employee_id}
      noun="people"
      exportName="pay-band-positioning"
      searchPlaceholder="Search by name, code or grade"
      isLoading={isLoading && !data}
      error={error?.detail}
      onRetry={reload}
      empty={{ icon: Layers, title: "Nobody to place yet" }}
    />
  );
}

function GradeDialog({ grade, onClose, onSaved }: { grade: PayGrade | null; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(grade?.code ?? "");
  const [name, setName] = useState(grade?.name ?? "");
  const [level, setLevel] = useState(String(grade?.level ?? 1));
  const [min, setMin] = useState(grade?.band_min ?? "");
  const [mid, setMid] = useState(grade?.band_mid ?? "");
  const [max, setMax] = useState(grade?.band_max ?? "");
  const [active, setActive] = useState(grade?.active ?? true);
  const [busy, setBusy] = useState(false);

  const amounts = [min, mid, max].every((v) => isAmount(v));
  const ordered = amounts && Number(min) <= Number(mid) && Number(mid) <= Number(max);

  const save = async () => {
    setBusy(true);
    const body = { name: name.trim(), level: Number(level) || 0, band_min: min.trim(), band_mid: mid.trim(), band_max: max.trim() };
    try {
      if (grade) await patch(`/pay-grades/${grade.id}`, { ...body, active });
      else await post("/pay-grades", { ...body, code: code.trim() });
      toast.success(grade ? "Grade saved." : "Grade added.");
      onSaved();
    } catch (caught) {
      toast.error(apiMessage(caught, "The grade could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{grade ? `Edit ${grade.code}` : "Add a grade"}</DialogTitle>
          <DialogDescription>Annual CTC in rupees. The band runs minimum ≤ midpoint ≤ maximum.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr_6rem]">
            <FormField htmlFor="grade-code" label="Code">
              <Input id="grade-code" maxLength={32} value={code} disabled={grade !== null} onChange={(e) => setCode(e.target.value)} />
            </FormField>
            <FormField htmlFor="grade-name" label="Name">
              <Input id="grade-name" maxLength={128} value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField htmlFor="grade-level" label="Level">
              <Input id="grade-level" inputMode="numeric" value={level} onChange={(e) => setLevel(e.target.value)} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField htmlFor="grade-min" label="Minimum">
              <Input id="grade-min" inputMode="decimal" className="tabular-nums" value={min} onChange={(e) => setMin(e.target.value)} />
            </FormField>
            <FormField htmlFor="grade-mid" label="Midpoint">
              <Input id="grade-mid" inputMode="decimal" className="tabular-nums" value={mid} onChange={(e) => setMid(e.target.value)} />
            </FormField>
            <FormField htmlFor="grade-max" label="Maximum">
              <Input id="grade-max" inputMode="decimal" className="tabular-nums" value={max} onChange={(e) => setMax(e.target.value)} />
            </FormField>
          </div>
          {amounts && !ordered && <p className="text-xs text-destructive">The midpoint must sit between the minimum and the maximum.</p>}
          {grade && (
            <div className="flex items-center gap-2">
              <Switch id="grade-active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="grade-active" className="font-normal">
                In use — switched off, it can no longer be given to a record
              </Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !code.trim() || !name.trim() || !ordered} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
