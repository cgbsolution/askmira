"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FileSignature, TimerOff } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { OFFER_STATUS, StatusBadge } from "@/components/hiring/labels";
import { OfferFormDialog } from "@/components/hiring/OfferFormDialog";
import { OfferSheet } from "@/components/hiring/OfferSheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import type { OfferStatus, OfferSummary } from "@/lib/types/hiring";
import { formatDay } from "@/lib/utils";

const day = (value: string | null) => (value ? formatDay(value, true) : "—");

const COLUMNS: ColumnDef<OfferSummary>[] = [
  { accessorKey: "code", header: "Code", meta: { cellClassName: "font-mono text-xs" } },
  { accessorKey: "candidate_name", header: "Candidate", meta: { cellClassName: "font-medium text-foreground" } },
  { accessorKey: "requisition_code", header: "Requisition", meta: { cellClassName: "font-mono text-xs" } },
  {
    accessorKey: "designation",
    header: "Designation",
    meta: { text: (offer) => (offer.grade ? `${offer.designation} · Grade ${offer.grade}` : offer.designation) },
    cell: ({ row }) => (
      <>
        {row.original.designation}
        {row.original.grade && <p className="text-xs text-muted-foreground">Grade {row.original.grade}</p>}
      </>
    ),
  },
  {
    accessorKey: "ctc_annual",
    header: "Annual CTC",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.ctc_annual} />,
  },
  {
    accessorKey: "joining_date",
    header: "Joining",
    meta: { cellClassName: "tabular-nums", text: (offer) => day(offer.joining_date) },
    cell: ({ row }) => day(row.original.joining_date),
  },
  {
    accessorKey: "valid_until",
    header: "Valid until",
    meta: { cellClassName: "tabular-nums", text: (offer) => day(offer.valid_until) },
    cell: ({ row }) => day(row.original.valid_until),
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { text: (offer) => OFFER_STATUS[offer.status][0] },
    cell: ({ row }) => <StatusBadge map={OFFER_STATUS} value={row.original.status} />,
  },
];

/** Offers (hiring, Tier 1): draft, approve, release, record the outcome, convert. */
export default function OffersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <OffersView />
    </Suspense>
  );
}

function OffersView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get("offer");
  const [status, setStatus] = useState<OfferStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(requested);
  const [lapseOpen, setLapseOpen] = useState(false);

  const query = `/offers${status === "all" ? "" : `?offer_status=${status}`}`;
  const { data, error, isLoading, reload } = useApiQuery<OfferSummary[]>(query);
  const rows = data ?? [];

  const closeSheet = () => {
    setOpenId(null);
    if (requested) router.replace(pathname);
  };

  const lapse = async () => {
    try {
      const result = await post<{ lapsed: number; codes: string[] }>("/offers/lapse");
      if (result.lapsed > 0) {
        toast.success(`${result.lapsed} offer(s) lapsed`, { description: result.codes.join(", ") });
      } else {
        toast.success("No released offers were past their validity date");
      }
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Overdue offers could not be lapsed.");
      throw caught;
    }
  };

  return (
    <PageShell
      title="Offers"
      description="Draft, approve, release and close offers. Every approver sees the budget deviation first."
      actions={
        <>
          <Button variant="outline" onClick={() => setLapseOpen(true)}>
            <TimerOff /> Lapse overdue offers
          </Button>
          <OfferFormDialog
            onCreated={(id) => {
              reload();
              setOpenId(id);
            }}
          />
        </>
      }
    >
      <DataTable
        title="Offers"
        columns={COLUMNS}
        data={rows}
        noun="offers"
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        filtered={status !== "all"}
        empty={{
          icon: FileSignature,
          title: "No offers yet",
          description:
            "Draft an offer for a candidate who has reached the interview stage. It goes out only after approval and release.",
        }}
        emptyMessage={status === "all" ? undefined : "No offers with this status."}
        searchPlaceholder="Code, candidate or requisition"
        onRowClick={(offer) => setOpenId(offer.id)}
        filters={
          <Select value={status} onValueChange={(next) => setStatus(next as OfferStatus | "all")}>
            <SelectTrigger className="h-9 w-52" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(OFFER_STATUS) as OfferStatus[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {OFFER_STATUS[key][0]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <ConfirmDialog
        open={lapseOpen}
        onOpenChange={setLapseOpen}
        title="Lapse overdue offers?"
        description="Every released offer past its valid-until date with no response is marked lapsed."
        confirmLabel="Lapse overdue offers"
        onConfirm={lapse}
      />
      <OfferSheet offerId={openId} onClose={closeSheet} onChanged={reload} />
    </PageShell>
  );
}
