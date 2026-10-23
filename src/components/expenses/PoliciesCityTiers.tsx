"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, Lock, MapPin, Pencil } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { InlineProblem, errorDetail } from "@/components/expenses/ReviewCommon";
import { CITY_TIER_LABEL } from "@/components/expenses/shared";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { put } from "@/lib/api";
import type { CityTier, CityTierInput, CityTierRow } from "@/lib/types/expenses";

/** Every location with the city tier its claims are checked against. */
export function PoliciesCityTiers({ canAdmin }: { canAdmin: boolean }) {
  const query = useApiQuery<CityTierRow[]>("/expenses/city-tiers");
  const [editing, setEditing] = useState<CityTierRow | null>(null);
  // A 403 reads as "no access", not as a failed load that a retry could fix.
  const forbidden = query.error?.status === 403;

  const columns: ColumnDef<CityTierRow>[] = [
    {
      accessorKey: "location_name",
      header: "Location",
      meta: { cellClassName: "font-medium text-foreground" },
    },
    {
      accessorKey: "city",
      header: "City",
      cell: ({ row }) => row.original.city ?? "—",
    },
    {
      id: "tier",
      header: "Tier",
      accessorFn: (row) => (row.city_tier ? CITY_TIER_LABEL[row.city_tier] : "Not set"),
      cell: ({ row }) =>
        row.original.city_tier ? (
          <Badge variant="secondary">{CITY_TIER_LABEL[row.original.city_tier]}</Badge>
        ) : (
          <Badge variant="warning">Not set</Badge>
        ),
    },
    {
      accessorKey: "note",
      header: "Note",
      meta: { cellClassName: "max-w-72 whitespace-normal text-muted-foreground" },
      cell: ({ row }) => row.original.note ?? "—",
    },
    ...(canAdmin
      ? [
          {
            id: "actions",
            header: "",
            enableHiding: false,
            meta: { className: "text-right", text: false },
            cell: ({ row }) => (
              <Button variant="outline" size="sm" onClick={() => setEditing(row.original)}>
                <Pencil /> {row.original.city_tier ? "Change" : "Set tier"}
              </Button>
            ),
          } satisfies ColumnDef<CityTierRow>,
        ]
      : []),
  ];

  return (
    <>
      <DataTable
        title="City tiers"
        description="The tier a location's claims are checked against. A location without a tier has no tier-specific limits applied until one is set."
        columns={columns}
        data={forbidden ? [] : (query.data ?? [])}
        getRowId={(row) => row.location_id}
        noun="locations"
        exportName="city-tiers"
        searchPlaceholder="Search locations"
        loadingRows={3}
        isLoading={query.isLoading && query.data === null}
        error={forbidden ? null : (query.error?.detail ?? null)}
        onRetry={query.reload}
        empty={
          forbidden
            ? { icon: Lock, title: "You don't have access to this", description: query.error?.detail }
            : {
                icon: MapPin,
                title: "No locations yet",
                description: "Locations are set up under the organisation. They appear here to be given a tier.",
              }
        }
      />

      {canAdmin && (
        <TierDialog
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            query.reload();
          }}
        />
      )}
    </>
  );
}

function TierDialog({
  row,
  onClose,
  onSaved,
}: {
  row: CityTierRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tier, setTier] = useState<CityTier | "">("");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    setTier(row.city_tier ?? "");
    setNote(row.note ?? "");
    setProblem(null);
  }, [row]);

  const save = async () => {
    if (!row || !tier) return;
    setIsSaving(true);
    setProblem(null);
    try {
      const body: CityTierInput = { location_id: row.location_id, city_tier: tier, note: note.trim() || null };
      await put<CityTierRow>("/expenses/city-tiers", body);
      toast.success(`${row.location_name} set to ${CITY_TIER_LABEL[tier]}`);
      onSaved();
    } catch (error) {
      setProblem(errorDetail(error, "Could not save the tier."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>City tier for {row?.location_name}</DialogTitle>
          <DialogDescription>Claims captured from now on use this tier.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="tier-select">Tier</Label>
            <Select value={tier} onValueChange={(value) => setTier(value as CityTier)}>
              <SelectTrigger id="tier-select" className="w-full">
                <SelectValue placeholder="Choose a tier" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CITY_TIER_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tier-note">
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="tier-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {problem && <InlineProblem>{problem}</InlineProblem>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!tier || isSaving} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save tier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
