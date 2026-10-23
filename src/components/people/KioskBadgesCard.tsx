"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CreditCard, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import { formatDay } from "@/lib/utils";

interface IssuedBadge {
  id: string;
  last_four: string;
  issued_at: string | null;
  revoked_at: string | null;
}

/** Cards that punch at a shared kiosk. Only the last four characters are ever shown. */
export function KioskBadgesCard({ employeeId }: { employeeId: string }) {
  const { data, reload } = useApiQuery<IssuedBadge[]>(`/attendance/badges?employee_id=${employeeId}`);
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);

  const issue = async () => {
    setBusy(true);
    try {
      await post("/attendance/badges", { employee_id: employeeId, badge_number: number.trim() });
      toast.success("Badge issued. It punches at any kiosk from now.");
      setNumber("");
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The badge could not be issued.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await post(`/attendance/badges/${id}/revoke`);
      toast.success("Badge revoked.");
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The badge could not be revoked.");
    }
  };

  const rows = data ?? [];
  const columns: ColumnDef<IssuedBadge>[] = [
    {
      accessorKey: "last_four",
      header: "Card",
      meta: { cellClassName: "font-mono", text: (row) => `…${row.last_four}` },
      cell: ({ row }) => `…${row.original.last_four}`,
    },
    {
      accessorKey: "issued_at",
      header: "Issued",
      meta: { text: (row) => (row.issued_at ? formatDay(row.issued_at, true) : null) },
      cell: ({ row }) => (row.original.issued_at ? formatDay(row.original.issued_at, true) : "—"),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", label: "Status", text: (row) => (row.revoked_at ? "Revoked" : "Active") },
      cell: ({ row }) =>
        row.original.revoked_at ? (
          <Badge variant="muted">Revoked</Badge>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => void revoke(row.original.id)}>
            Revoke
          </Button>
        ),
    },
  ];
  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="size-4 text-primary" /> Kiosk badges
        </CardTitle>
        <CardDescription>A card that punches at a kiosk on its own. Revoke a lost card at once.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {rows.length > 0 && (
          <DataTable
            columns={columns}
            data={rows}
            noun="badges"
            exportName="kiosk-badges"
            searchPlaceholder="Search badges"
          />
        )}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <FormField htmlFor="badge-number" label="Card number" hint="Tap the card on a reader here, or type the number printed on it.">
            <Input id="badge-number" autoComplete="off" value={number} onChange={(e) => setNumber(e.target.value)} />
          </FormField>
          <Button disabled={busy || number.trim().length < 4} onClick={() => void issue()}>
            {busy && <Loader2 className="animate-spin" />} Issue badge
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
