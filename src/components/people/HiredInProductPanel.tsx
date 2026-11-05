"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { UserPlus } from "lucide-react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/useApiQuery";
import { formatDate } from "@/lib/utils";

export interface LinkedHire {
  ref: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  job: string | null;
  department: string | null;
  department_id: string | null;
  location: string | null;
  location_id: string | null;
  applied_at: string | null;
}

interface LinkedHires {
  linked: boolean;
  brand: string;
  hires: LinkedHire[];
  error?: string;
}

/**
 * Onboarding → Add employees → Hired in AnytimeHire.
 *
 * Candidates marked Hired in the linked interview tool who are not in the
 * directory yet. "Add as joiner" opens the one-person form with what
 * AnytimeHire knows filled in; HR checks it, adds the joining date and saves.
 */
export function HiredInProductPanel({ onPick }: { onPick: (hire: LinkedHire) => void }) {
  const { data, error, isLoading, reload } = useApiQuery<LinkedHires>("/onboarding/linked-hires");

  const columns: ColumnDef<LinkedHire>[] = [
    {
      accessorKey: "name",
      header: "Candidate",
      meta: { cellClassName: "font-medium text-foreground" },
      cell: ({ row }) => (
        <>
          {row.original.name}
          <div className="text-xs font-normal text-muted-foreground">{row.original.email}</div>
        </>
      ),
    },
    { accessorKey: "job", header: "Hired for", cell: ({ row }) => row.original.job ?? "—" },
    {
      accessorKey: "department",
      header: "Department",
      cell: ({ row }) =>
        row.original.department ? (
          <>
            {row.original.department}
            {!row.original.department_id && (
              <div className="text-xs text-muted-foreground">Not a department here yet</div>
            )}
          </>
        ) : (
          "—"
        ),
    },
    { accessorKey: "location", header: "Location", cell: ({ row }) => row.original.location ?? "—" },
    {
      accessorKey: "applied_at",
      header: "Applied",
      cell: ({ row }) => (row.original.applied_at ? formatDate(row.original.applied_at) : "—"),
    },
    {
      id: "actions",
      header: "Actions",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <Button size="sm" onClick={() => onPick(row.original)}>
          <UserPlus /> Add as joiner
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {data?.error && (
        <Alert variant="destructive">
          <AlertDescription>{data.error}</AlertDescription>
        </Alert>
      )}
      <DataTable
        title={`Hired in ${data?.brand ?? "AnytimeHire"}`}
        description="Candidates marked Hired there who are not in the directory yet. Add each as a joiner: their details are filled in, you add the joining date."
        columns={columns}
        data={data?.hires ?? []}
        getRowId={(row) => row.ref || row.email}
        noun="hires"
        exportName={false}
        searchPlaceholder="Search hires"
        isLoading={isLoading}
        error={error?.detail}
        onRetry={reload}
        empty={{
          icon: UserPlus,
          title: "Nobody waiting to join",
          description: "When a candidate is marked Hired in AnytimeHire, they appear here to add as a joiner.",
        }}
      />
    </div>
  );
}
