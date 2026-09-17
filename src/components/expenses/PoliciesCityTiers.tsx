"use client";

import { Loader2, MapPin, Pencil } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { InlineProblem, QueryBoundary, errorDetail } from "@/components/expenses/ReviewCommon";
import { CITY_TIER_LABEL } from "@/components/expenses/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { put } from "@/lib/api";
import type { CityTier, CityTierInput, CityTierRow } from "@/lib/types/expenses";

/** Every location with the city tier its claims are checked against. */
export function PoliciesCityTiers({ canAdmin }: { canAdmin: boolean }) {
  const query = useApiQuery<CityTierRow[]>("/expenses/city-tiers");
  const [editing, setEditing] = useState<CityTierRow | null>(null);

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>City tiers</CardTitle>
        <CardDescription>
          The tier a location&apos;s claims are checked against. A location without a tier has no tier-specific
          limits applied until one is set.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <QueryBoundary query={query}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="No locations yet"
                description="Locations are set up under the organisation. They appear here to be given a tier."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Location</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Note</TableHead>
                    {canAdmin && <TableHead className="pr-5" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.location_id}>
                      <TableCell className="pl-5 font-medium text-foreground">{row.location_name}</TableCell>
                      <TableCell>{row.city ?? "—"}</TableCell>
                      <TableCell>
                        {row.city_tier ? (
                          <Badge variant="secondary">{CITY_TIER_LABEL[row.city_tier]}</Badge>
                        ) : (
                          <Badge variant="warning">Not set</Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-72 whitespace-normal text-muted-foreground">
                        {row.note ?? "—"}
                      </TableCell>
                      {canAdmin && (
                        <TableCell className="pr-5 text-right">
                          <Button variant="outline" size="sm" onClick={() => setEditing(row)}>
                            <Pencil /> {row.city_tier ? "Change" : "Set tier"}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          }
        </QueryBoundary>
      </CardContent>

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
    </Card>
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
