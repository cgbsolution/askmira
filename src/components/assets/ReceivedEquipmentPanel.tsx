"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, PackagePlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface Receipt {
  ref: string;
  grn: string;
  received_on: string;
  item: string;
  description: string | null;
  category: string | null;
  quantity: string;
  uom: string | null;
  serial_numbers: string[];
  unit_cost: string | null;
  po: string;
  vendor: string | null;
  requested_by: string | null;
  units: number;
  added: number;
  asset_codes: string[];
}

interface Received {
  linked: boolean;
  register: "askmira" | "helpdesk";
  receipts: Receipt[];
  error?: string;
}

interface Category {
  id: string;
  name: string;
  active: boolean;
}

/**
 * Equipment ProcureFlow received in the last 90 days, beside the asset register.
 *
 * "Add to register" turns each accepted unit into an asset — in AskMiraa's
 * register, or in CGB Helpdesk's when it is linked — as a spare ready to hand
 * to the person it was bought for. A unit added once is never added again.
 * Renders nothing unless ProcureFlow is linked.
 */
export function ReceivedEquipmentPanel() {
  const { data, error, isLoading, reload } = useApiQuery<Received>("/assets/received");
  const [adding, setAdding] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Not linked, or not HR (an IT engineer on the helpdesk register): nothing to add from here.
  if ((!isLoading && data && !data.linked) || error?.status === 403) return null;
  const toHelpdesk = data?.register === "helpdesk";

  const add = async (receipt: Receipt, categoryId: string | null) => {
    setBusy(receipt.ref);
    try {
      const result = await post<{ added: string[] }>(`/assets/received/${encodeURIComponent(receipt.ref)}/add`, {
        category_id: categoryId,
      });
      toast.success(
        result.added.length
          ? `Added ${result.added.join(", ")} to the ${toHelpdesk ? "CGB Helpdesk" : ""} register.`
          : "Every unit was already in the register.",
      );
      setAdding(null);
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The units were not added.");
    } finally {
      setBusy(null);
    }
  };

  const columns: ColumnDef<Receipt>[] = [
    {
      accessorKey: "item",
      header: "Item",
      meta: { cellClassName: "font-medium text-foreground" },
      cell: ({ row }) => (
        <>
          {row.original.item}
          <div className="text-xs font-normal text-muted-foreground">
            {row.original.po} · {row.original.grn}
          </div>
        </>
      ),
    },
    {
      accessorKey: "received_on",
      header: "Received",
      cell: ({ row }) => formatDate(row.original.received_on),
    },
    {
      accessorKey: "units",
      header: "Units",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      accessorKey: "unit_cost",
      header: "Unit cost",
      meta: { className: "text-right" },
      cell: ({ row }) => (row.original.unit_cost ? <Money value={row.original.unit_cost} /> : "—"),
    },
    { accessorKey: "requested_by", header: "Requested by", cell: ({ row }) => row.original.requested_by ?? "—" },
    {
      id: "state",
      header: "In the register",
      accessorFn: (row) => `${row.added}/${row.units}`,
      cell: ({ row }) =>
        row.original.added >= row.original.units ? (
          <Badge variant="secondary" title={row.original.asset_codes.join(", ")}>
            All {row.original.units}
          </Badge>
        ) : (
          <Badge variant="outline">
            {row.original.added} of {row.original.units}
          </Badge>
        ),
    },
    {
      id: "actions",
      header: "Actions",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) =>
        row.original.added < row.original.units ? (
          <Button
            size="sm"
            disabled={busy !== null}
            onClick={() => (toHelpdesk ? void add(row.original, null) : setAdding(row.original))}
          >
            {busy === row.original.ref ? <Loader2 className="animate-spin" /> : <PackagePlus />}
            Add to register
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {data?.error && (
        <Alert variant="destructive">
          <AlertDescription>{data.error}</AlertDescription>
        </Alert>
      )}
      <DataTable
        title="Received in ProcureFlow"
        description="Goods received and accepted in the last 90 days. Add each to the register as spares, then hand them over."
        columns={columns}
        data={data?.receipts ?? []}
        getRowId={(row) => row.ref}
        noun="receipts"
        exportName={false}
        searchPlaceholder="Search receipts"
        isLoading={isLoading}
        error={error?.detail}
        onRetry={reload}
        empty={{
          icon: PackagePlus,
          title: "Nothing received in the last 90 days",
          description: "Goods posted as received in ProcureFlow appear here to add to the register.",
        }}
      />
      {!toHelpdesk && (
        <CategoryDialog
          receipt={adding}
          busy={busy !== null}
          onClose={() => setAdding(null)}
          onAdd={(receipt, categoryId) => void add(receipt, categoryId)}
        />
      )}
    </div>
  );
}

function CategoryDialog({
  receipt,
  busy,
  onClose,
  onAdd,
}: {
  receipt: Receipt | null;
  busy: boolean;
  onClose: () => void;
  onAdd: (receipt: Receipt, categoryId: string) => void;
}) {
  const categories = useApiQuery<Category[]>(receipt ? "/assets/categories" : null);
  const active = (categories.data ?? []).filter((c) => c.active);
  const guess = receipt?.category
    ? active.find((c) => c.name.toLowerCase() === receipt.category?.toLowerCase())?.id
    : undefined;
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const value = chosen ?? guess;

  return (
    <Dialog open={receipt !== null} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {receipt?.units} unit(s) to the register</DialogTitle>
          <DialogDescription>
            {receipt?.item}, from {receipt?.po}. Each unit becomes a spare with its serial number, cost and vendor.
          </DialogDescription>
        </DialogHeader>
        <FormField htmlFor="received-category" label="Category">
          <Select value={value} onValueChange={setChosen}>
            <SelectTrigger id="received-category" className="w-full">
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {active.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={busy || !value || !receipt} onClick={() => receipt && value && onAdd(receipt, value)}>
            {busy && <Loader2 className="animate-spin" />} Add to register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
