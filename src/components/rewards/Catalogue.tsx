"use client";

import { Gift, Loader2, Pencil, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, patch, post } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface CatalogueItem {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  points_cost: number;
  stock: number | null;
  in_stock: boolean;
  active: boolean;
}

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/** The items a person can spend points on; picking one redeems it at its price. */
export function CatalogueChooser({
  items,
  balance,
  onRedeemed,
}: {
  items: CatalogueItem[];
  balance: number;
  onRedeemed: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const redeem = async (item: CatalogueItem) => {
    setBusy(item.id);
    try {
      await post(`/rewards/catalogue/${item.id}/redeem`);
      toast.success(`${item.name} is on its way. HR orders it from the partner.`);
      onRedeemed();
    } catch (caught) {
      toast.error(failure(caught, "Could not redeem."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid max-h-[60vh] gap-2 overflow-y-auto">
      {items.map((item) => {
        const affordable = item.points_cost <= balance;
        return (
          <div
            key={item.id}
            className={cn("flex items-center justify-between gap-3 rounded-md border border-border p-3", !item.in_stock && "opacity-60")}
          >
            <div className="min-w-0">
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.points_cost.toLocaleString("en-IN")} points
                {item.category ? ` · ${item.category}` : ""}
                {item.stock !== null ? ` · ${item.stock} left` : ""}
              </p>
              {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
            </div>
            <Button
              size="sm"
              disabled={busy !== null || !affordable || !item.in_stock}
              onClick={() => void redeem(item)}
            >
              {busy === item.id && <Loader2 className="animate-spin" />}
              {!item.in_stock ? "Out of stock" : affordable ? "Redeem" : "Not enough points"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

/** HR's view of the catalogue: prices, stock, and switching items off. */
export function CatalogueAdmin() {
  const { data, error, isLoading, reload } = useApiQuery<CatalogueItem[]>("/rewards/catalogue?include_inactive=true");
  const [editing, setEditing] = useState<CatalogueItem | "new" | null>(null);
  const rows = data ?? [];

  return (
    <>
      <DataPanel
        title="Catalogue"
        description="What points can be spent on. With a catalogue, people choose from it rather than typing a request."
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> Add an item
          </Button>
        }
        isLoading={isLoading && !data}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{ icon: Gift, title: "No catalogue yet", description: "Until there is one, people describe what they would like." }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead />
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow key={item.id} className={item.active ? undefined : "opacity-60"}>
                <TableCell>
                  <p className="font-medium">{item.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                </TableCell>
                <TableCell className="text-right tabular-nums">{item.points_cost.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right tabular-nums">{item.stock ?? "Unlimited"}</TableCell>
                <TableCell>{!item.active && <Badge variant="muted">Off</Badge>}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" aria-label={`Edit ${item.name}`} onClick={() => setEditing(item)}>
                    <Pencil />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
      {editing && (
        <ItemDialog
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function ItemDialog({ item, onClose, onSaved }: { item: CatalogueItem | null; onClose: () => void; onSaved: () => void }) {
  const [sku, setSku] = useState(item?.sku ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [cost, setCost] = useState(item ? String(item.points_cost) : "");
  const [stock, setStock] = useState(item?.stock !== null && item?.stock !== undefined ? String(item.stock) : "");
  const [active, setActive] = useState(item?.active ?? true);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      points_cost: Number(cost),
      stock: stock.trim() ? Number(stock) : null,
    };
    try {
      if (item) await patch(`/rewards/catalogue/${item.id}`, { ...body, active, unlimited_stock: !stock.trim() });
      else await post("/rewards/catalogue", { ...body, sku: sku.trim() });
      toast.success(item ? "Item saved." : "Item added.");
      onSaved();
    } catch (caught) {
      toast.error(failure(caught, "The item could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? `Edit ${item.name}` : "Add a catalogue item"}</DialogTitle>
          <DialogDescription>Leave stock empty for unlimited items such as vouchers.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <FormField htmlFor="cat-sku" label="SKU">
              <Input id="cat-sku" maxLength={64} value={sku} disabled={item !== null} onChange={(e) => setSku(e.target.value)} />
            </FormField>
            <FormField htmlFor="cat-name" label="Name">
              <Input id="cat-name" maxLength={160} value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField htmlFor="cat-cost" label="Points">
              <Input id="cat-cost" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value.replace(/\D/g, ""))} />
            </FormField>
            <FormField htmlFor="cat-stock" label="Stock" optional>
              <Input id="cat-stock" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))} />
            </FormField>
            <FormField htmlFor="cat-category" label="Category" optional>
              <Input id="cat-category" maxLength={64} value={category} onChange={(e) => setCategory(e.target.value)} />
            </FormField>
          </div>
          <FormField htmlFor="cat-description" label="Description" optional>
            <Textarea id="cat-description" rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
          {item && (
            <div className="flex items-center gap-2">
              <Switch id="cat-active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="cat-active" className="font-normal">
                Offered in the catalogue
              </Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !sku.trim() || name.trim().length < 2 || !(Number(cost) > 0)} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
