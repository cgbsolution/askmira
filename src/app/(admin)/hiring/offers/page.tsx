"use client";

import { FileSignature, TimerOff } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import type { OfferStatus, OfferSummary } from "@/lib/types/hiring";
import { formatDay } from "@/lib/utils";

const day = (value: string | null) => (value ? formatDay(value, true) : "—");

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
      <SectionNav section="hiring" />
      <DataPanel
        title="Offers"
        toolbar={
          <Select value={status} onValueChange={(next) => setStatus(next as OfferStatus | "all")}>
            <SelectTrigger className="w-52" aria-label="Filter by status">
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
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: FileSignature,
          title: status === "all" ? "No offers yet" : "No offers with this status",
          description:
            "Draft an offer for a candidate who has reached the interview stage. It goes out only after approval and release.",
        }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Requisition</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead className="text-right">Annual CTC</TableHead>
                <TableHead>Joining</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((offer) => (
                <TableRow
                  key={offer.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  onClick={() => setOpenId(offer.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setOpenId(offer.id);
                    }
                  }}
                >
                  <TableCell className="font-mono text-xs">{offer.code}</TableCell>
                  <TableCell className="font-medium text-foreground">{offer.candidate_name}</TableCell>
                  <TableCell className="font-mono text-xs">{offer.requisition_code}</TableCell>
                  <TableCell>
                    {offer.designation}
                    {offer.grade && <p className="text-xs text-muted-foreground">Grade {offer.grade}</p>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={offer.ctc_annual} />
                  </TableCell>
                  <TableCell className="tabular-nums">{day(offer.joining_date)}</TableCell>
                  <TableCell className="tabular-nums">{day(offer.valid_until)}</TableCell>
                  <TableCell>
                    <StatusBadge map={OFFER_STATUS} value={offer.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataPanel>

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
