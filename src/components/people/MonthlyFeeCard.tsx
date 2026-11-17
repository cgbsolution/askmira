"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { RequireRole } from "@/components/common/RequireRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import { formatDay } from "@/lib/utils";

interface Fee {
  id: string;
  amount: string;
  effective_from: string;
  reason: string | null;
}

const FEE_COLUMNS: ColumnDef<Fee>[] = [
  {
    accessorKey: "effective_from",
    header: "From",
    meta: { text: (f) => formatDay(f.effective_from, true) },
    cell: ({ row }) => formatDay(row.original.effective_from, true),
  },
  {
    accessorKey: "amount",
    header: "A month",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.amount} />,
  },
  {
    id: "reason",
    header: "Reason",
    accessorFn: (f) => f.reason ?? "",
  },
];

/**
 * For consultants paid a fixed monthly fee: the fee from each date. A raise is
 * a new row. Each day of a period worked is paid at the fee in force that day,
 * divided by the days in its month, so a full month pays the fee exactly.
 */
export function MonthlyFeeCard({ employeeId }: { employeeId: string }) {
  const { data, reload } = useApiQuery<Fee[]>(`/consultant-fees/${employeeId}`);
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = data ?? [];

  const add = async () => {
    setBusy(true);
    try {
      await post("/consultant-fees", { employee_id: employeeId, amount, effective_from: from });
      toast.success("Monthly fee added.");
      setAmount("");
      setFrom("");
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The fee could not be added.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="size-4 text-primary" /> Monthly fee
        </CardTitle>
        <CardDescription>
          Paid as a fixed monthly fee. A part month is prorated by calendar days; their hours are recorded for the
          customer&apos;s timesheet, not paid.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {rows.length > 0 && (
          <DataTable
            columns={FEE_COLUMNS}
            data={rows}
            noun="fees"
            exportName="monthly-fees"
            searchPlaceholder="Search fees"
          />
        )}
        <RequireRole roles={["admin"]}>
          <div className="grid gap-3 sm:grid-cols-[12rem_12rem_auto] sm:items-end">
            <FormField htmlFor="fee-amount" label="Monthly fee (₹)">
              <Input id="fee-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </FormField>
            <FormField htmlFor="fee-from" label="From">
              <DatePicker id="fee-from" value={from} onChange={setFrom} />
            </FormField>
            <Button disabled={busy || !(Number(amount) > 0) || !from} onClick={() => void add()}>
              {busy && <Loader2 className="animate-spin" />} Add fee
            </Button>
          </div>
        </RequireRole>
      </CardContent>
    </Card>
  );
}
