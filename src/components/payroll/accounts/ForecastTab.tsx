"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Eye, LineChart, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Money } from "@/components/common/Money";
import { DataTable } from "@/components/common/data-table/DataTable";
import { CompanionChart } from "@/components/companion/CompanionExtras";
import { apiMessage } from "@/components/payroll/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { AccountForecast } from "@/lib/types/accounts";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return `${MONTHS[month - 1] ?? "?"} ${year}`;
}

function span(forecast: AccountForecast): string {
  const [year, month] = forecast.start_month.split("-").map(Number);
  const last = year * 12 + month - 1 + forecast.months - 1;
  const end = `${Math.floor(last / 12)}-${String((last % 12) + 1).padStart(2, "0")}`;
  return `${monthLabel(forecast.start_month)} to ${monthLabel(end)}`;
}

function SignedMoney({ value }: { value: string }) {
  const negative = value.startsWith("-");
  return (
    <span className={cn("tabular-nums", negative && "text-destructive")}>
      {negative ? "-" : ""}
      <Money value={negative ? value.slice(1) : value} />
    </span>
  );
}

/**
 * The prospective side of Account P&L: what each won order is expected to bill
 * and cost, month by month, booked from Ask Miraa (an order win) or by hand.
 * Kept apart from the P&L tab on purpose: that one shows only what happened.
 */
export function ForecastTab() {
  const forecasts = useApiQuery<AccountForecast[]>("/accounts/forecasts");
  const [viewing, setViewing] = useState<AccountForecast | null>(null);
  const [withdrawing, setWithdrawing] = useState<AccountForecast | null>(null);

  const columns: ColumnDef<AccountForecast>[] = [
    { accessorKey: "account_name", header: "Account", meta: { cellClassName: "font-medium" } },
    {
      accessorKey: "reference",
      header: "Order",
      meta: { text: (f) => `${f.reference} (${f.source === "order_win" ? "Ask Miraa order win" : "by hand"})` },
      cell: ({ row }) => (
        <div className="grid gap-1">
          <span>{row.original.reference}</span>
          {row.original.source === "order_win" ? (
            <Badge variant="secondary" className="w-fit">
              Ask Miraa order win
            </Badge>
          ) : null}
        </div>
      ),
    },
    { id: "period", header: "Months", accessorFn: (f) => span(f) },
    {
      accessorKey: "billing",
      header: "Billing",
      meta: { className: "text-right" },
      cell: ({ row }) => <SignedMoney value={row.original.billing} />,
    },
    {
      accessorKey: "cost",
      header: "Cost",
      meta: { className: "text-right" },
      cell: ({ row }) => <SignedMoney value={row.original.cost} />,
    },
    {
      accessorKey: "margin",
      header: "Margin",
      meta: { className: "text-right" },
      cell: ({ row }) => (
        <div className="grid justify-items-end gap-0.5 tabular-nums">
          <SignedMoney value={row.original.margin} />
          {row.original.margin_pct ? (
            <span className="text-xs text-muted-foreground">{row.original.margin_pct}%</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { text: false, className: "text-right" },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`See ${row.original.reference} month by month`}
            onClick={() => setViewing(row.original)}
          >
            <Eye />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Withdraw ${row.original.reference}`}
            onClick={() => setWithdrawing(row.original)}
          >
            <Undo2 />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        tier="tier1"
        title="Prospective P&L"
        description="What each won order is expected to bill and cost, month by month, before any of it has happened. Booked from an order win in Ask Miraa; withdraw one if the order falls through."
        columns={columns}
        data={forecasts.data ?? []}
        noun="forecasts"
        isLoading={forecasts.isLoading}
        error={forecasts.error?.detail ?? null}
        onRetry={forecasts.reload}
        selectable={false}
        empty={{
          icon: LineChart,
          title: "No prospective P&L yet",
          description:
            "When a customer signs, tell Ask Miraa the PO and the team: it checks the figures, opens the positions and books the forecast here.",
        }}
      />
      <Sheet open={viewing !== null} onOpenChange={(next) => !next && setViewing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {viewing ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  {viewing.account_name}: {viewing.reference}
                </SheetTitle>
                <SheetDescription>
                  {span(viewing)} · billing <Money value={viewing.billing} /> · cost <Money value={viewing.cost} /> ·
                  margin <Money value={viewing.margin} /> ({viewing.margin_pct ?? "—"}%)
                  {viewing.order_value ? (
                    <>
                      {" "}
                      · PO value <Money value={viewing.order_value} />
                    </>
                  ) : null}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 px-4 pb-6">
                <CompanionChart
                  card={{
                    type: "chart",
                    title: "By month",
                    caption: "Expected, not yet billed",
                    chart: "bar",
                    unit: "inr",
                    x: viewing.by_month.map((m) => monthLabel(m.month)),
                    series: [
                      { name: "Billing", values: viewing.by_month.map((m) => m.billing) },
                      { name: "Cost", values: viewing.by_month.map((m) => m.cost) },
                      { name: "Margin", values: viewing.by_month.map((m) => m.margin) },
                    ],
                  }}
                />
                <DataTable
                  variant="plain"
                  columns={[
                    { id: "month", header: "Month", accessorFn: (m) => monthLabel(m.month) },
                    {
                      accessorKey: "billing",
                      header: "Billing",
                      meta: { className: "text-right" },
                      cell: ({ row }) => <SignedMoney value={row.original.billing} />,
                    },
                    {
                      accessorKey: "people_cost",
                      header: "People cost",
                      meta: { className: "text-right" },
                      cell: ({ row }) => <SignedMoney value={row.original.people_cost} />,
                    },
                    {
                      accessorKey: "recruitment",
                      header: "Recruitment",
                      meta: { className: "text-right" },
                      cell: ({ row }) => <SignedMoney value={row.original.recruitment} />,
                    },
                    {
                      accessorKey: "margin",
                      header: "Margin",
                      meta: { className: "text-right" },
                      cell: ({ row }) => <SignedMoney value={row.original.margin} />,
                    },
                  ]}
                  data={viewing.by_month}
                  noun="months"
                  selectable={false}
                  paginate={false}
                />
                <DataTable
                  variant="plain"
                  columns={[
                    { accessorKey: "label", header: "Line" },
                    {
                      accessorKey: "kind",
                      header: "Kind",
                      cell: ({ row }) =>
                        ({ billing: "Billing", people_cost: "People cost", recruitment: "Recruitment" })[
                          row.original.kind
                        ] ?? "Other cost",
                    },
                    {
                      accessorKey: "total",
                      header: "Over the order",
                      meta: { className: "text-right" },
                      cell: ({ row }) => <SignedMoney value={row.original.total} />,
                    },
                  ]}
                  data={viewing.lines}
                  noun="lines"
                  selectable={false}
                  paginate={false}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={withdrawing !== null}
        onOpenChange={(next) => !next && setWithdrawing(null)}
        title={`Withdraw ${withdrawing?.reference ?? "this forecast"}?`}
        description="It leaves the prospective P&L and is kept, marked withdrawn, in the audit trail. Positions in AnytimeHire are not touched."
        confirmLabel="Withdraw"
        destructive
        onConfirm={async () => {
          if (!withdrawing) return;
          try {
            await post(`/accounts/forecasts/${withdrawing.id}/withdraw`, {});
            toast.success("Forecast withdrawn.");
            setWithdrawing(null);
            forecasts.reload();
          } catch (caught) {
            toast.error(apiMessage(caught, "Could not withdraw it."));
          }
        }}
      />
    </>
  );
}
