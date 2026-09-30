"use client";

import { Boxes, Plus, Search, Tags } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";

import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { DownloadButton } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import type { AssetCategory, AssetPage, AssetStatus, AssetSummary } from "@/lib/types/assets";
import { cn } from "@/lib/utils";

import { AssetDetailSheet } from "./AssetDetailSheet";
import { AssetFormDialog, type LocationOption } from "./AssetFormDialog";
import {
  AssetStatusBadge,
  dayOrDash,
  pluralCount,
  QueryPanel,
  STATUS_LABELS,
  todayISO,
} from "./shared";

const PAGE_SIZE = 25;
const ANY = "any";

/**
 * The asset register (HR): every tagged asset, who holds it, what it is worth
 * today, and the hand-over, return and status actions on each.
 */
export function AssetRegisterScreen() {
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AssetStatus | typeof ANY>(ANY);
  const [categoryId, setCategoryId] = useState(ANY);
  const [locationId, setLocationId] = useState(ANY);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(term.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [term]);

  const filters = new URLSearchParams();
  if (search) filters.set("q", search);
  if (status !== ANY) filters.set("status", status);
  if (categoryId !== ANY) filters.set("category_id", categoryId);
  if (locationId !== ANY) filters.set("location_id", locationId);
  const listParams = new URLSearchParams(filters);
  listParams.set("page", String(page));
  listParams.set("page_size", String(PAGE_SIZE));

  const list = useApiQuery<AssetPage>(`/assets?${listParams}`);
  const summary = useApiQuery<AssetSummary>("/assets/summary");
  const categories = useApiQuery<AssetCategory[]>("/assets/categories?include_inactive=true");
  const locations = useApiQuery<LocationOption[]>("/org/locations");

  const { reload: reloadList } = list;
  const { reload: reloadSummary } = summary;
  const refresh = useCallback(() => {
    reloadList();
    reloadSummary();
  }, [reloadList, reloadSummary]);

  const total = list.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(search) || [status, categoryId, locationId].some((v) => v !== ANY);
  const noCategories = categories.data !== null && categories.data.length === 0;
  const activeCategories = (categories.data ?? []).filter((category) => category.active);

  return (
    <PageShell
      title="Asset register"
      description="Every tagged asset, who holds it, and what it is worth today."
      actions={
        <>
          <DownloadButton
            path={`/assets/export.csv${filters.toString() ? `?${filters}` : ""}`}
            fallbackName={`asset-register-${todayISO()}.csv`}
            label="Export CSV"
            size="default"
          />
          <Button
            variant="accent"
            disabled={activeCategories.length === 0}
            onClick={() => setAdding(true)}
          >
            <Plus /> Add asset
          </Button>
        </>
      }
    >
      <SummaryTiles summary={summary.data} error={summary.error?.detail ?? null} />

      <QueryPanel
        query={list}
        isEmpty={(data) => data.items.length === 0}
        empty={
          noCategories
            ? {
                icon: Tags,
                title: "Set up asset categories first",
                description:
                  "Every asset belongs to a category — laptops, phones, access cards — which sets its depreciation and who collects it at exit.",
                action: (
                  <Button asChild variant="outline">
                    <Link href="/assets/categories">Go to categories</Link>
                  </Button>
                ),
              }
            : {
                icon: Boxes,
                title: filtered ? "No assets match these filters" : "The register is empty",
                description: filtered
                  ? "Try a different tag or serial number, or clear a filter."
                  : "Use Add asset to record the equipment the company owns.",
              }
        }
        toolbar={
          <>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Tag, serial number or name"
                className="pl-9"
                aria-label="Search assets"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as AssetStatus | typeof ANY);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Status" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any status</SelectItem>
                {(Object.keys(STATUS_LABELS) as AssetStatus[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={categoryId}
              onValueChange={(value) => {
                setCategoryId(value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Category" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All categories</SelectItem>
                {(categories.data ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={locationId}
              onValueChange={(value) => {
                setLocationId(value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Location" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All locations</SelectItem>
                {(locations.data ?? []).map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {list.data ? pluralCount(total, "asset") : ""}
            </span>
          </>
        }
        footer={
          total > PAGE_SIZE ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {page} of {lastPage}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= lastPage}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {(data) => (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Held by</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Book value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => {
                  const holder = row.current_assignment;
                  return (
                    <TableRow
                      key={row.id}
                      tabIndex={0}
                      className="cursor-pointer"
                      onClick={() => setOpenId(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setOpenId(row.id);
                        }
                      }}
                    >
                      <TableCell>
                        <p className="font-medium text-foreground">{row.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.asset_tag}
                          {row.serial_number && ` · S/N ${row.serial_number}`}
                        </p>
                      </TableCell>
                      <TableCell>{row.category_name}</TableCell>
                      <TableCell>
                        <AssetStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell>
                        {holder ? (
                          <>
                            <p className="text-sm text-foreground">
                              {holder.employee_name ?? "Unknown employee"}
                            </p>
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              {holder.expected_return_date
                                ? `Due ${dayOrDash(holder.expected_return_date)}`
                                : holder.employee_code}
                              {holder.is_overdue && <Badge variant="destructive">Overdue</Badge>}
                              {!holder.acknowledged_at && holder.requires_acknowledgement && (
                                <Badge variant="warning">Not acknowledged</Badge>
                              )}
                            </p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{row.location_name ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {row.book_value ? (
                          <Money value={row.book_value} />
                        ) : (
                          <span className="text-muted-foreground">No cost</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryPanel>

      <AssetFormDialog
        open={adding}
        onOpenChange={setAdding}
        asset={null}
        categories={categories.data ?? []}
        locations={locations.data ?? []}
        onSaved={(saved) => {
          refresh();
          setOpenId(saved.id);
        }}
      />
      <AssetDetailSheet
        assetId={openId}
        categories={categories.data ?? []}
        locations={locations.data ?? []}
        onClose={() => setOpenId(null)}
        onChanged={refresh}
      />
    </PageShell>
  );
}

function SummaryTiles({ summary, error }: { summary: AssetSummary | null; error: string | null }) {
  if (!summary) {
    if (error) {
      return (
        <Card tier="tier1">
          <CardContent className="text-sm text-muted-foreground">
            The register figures could not be loaded: {error}
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((key) => (
          <Skeleton key={key} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const tiles: { label: string; value: React.ReactNode; hint?: string; attention?: boolean }[] = [
    {
      label: "Assets",
      value: summary.total,
      hint: `${summary.in_repair} in repair · ${summary.lost} lost`,
    },
    {
      label: "Assigned",
      value: summary.assigned,
      hint:
        summary.unacknowledged > 0
          ? `${summary.unacknowledged} not yet acknowledged`
          : "All acknowledged",
    },
    { label: "In stock", value: summary.in_stock },
    {
      label: "Overdue returns",
      value: summary.overdue_returns,
      attention: summary.overdue_returns > 0,
    },
    {
      label: "Requests waiting",
      value: summary.pending_requests + summary.approved_awaiting_fulfilment,
      hint: `${summary.pending_requests} to decide · ${summary.approved_awaiting_fulfilment} to hand over`,
      attention: summary.pending_requests + summary.approved_awaiting_fulfilment > 0,
    },
  ];

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((tile) => (
          <Card key={tile.label} tier="tier1" className="gap-1 py-4">
            <CardContent>
              <p className="text-sm text-muted-foreground">{tile.label}</p>
              <p
                className={cn(
                  "mt-1 text-2xl font-semibold tabular-nums text-foreground",
                  tile.attention && "text-mustard-900 dark:text-mustard-100",
                )}
              >
                {tile.value}
              </p>
              {tile.hint && <p className="mt-0.5 text-xs text-muted-foreground">{tile.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Book value today <Money value={summary.book_value_total} className="text-foreground" /> of{" "}
        <Money value={summary.purchase_cost_total} className="text-foreground" /> purchase cost,
        straight line over each category&apos;s life
        {summary.assets_without_cost > 0 &&
          `; ${pluralCount(summary.assets_without_cost, "asset")} with no cost recorded are not counted`}
        .
      </p>
    </div>
  );
}
