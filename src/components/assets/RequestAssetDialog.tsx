"use client";

import { Loader2, PackagePlus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { apiErrorMessage, InlineProblem } from "@/components/payroll-ops/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type { AssetCategory, AssetRequest } from "@/lib/types/assets";

import { todayISO } from "./shared";

/** Ask for an asset. Your line manager (or HR) decides; HR hands it over. */
export function RequestAssetDialog({
  categories,
  onCreated,
}: {
  categories: AssetCategory[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [reason, setReason] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const reset = () => {
    setCategoryId("");
    setReason("");
    setNeededBy("");
    setTouched(false);
    setError(null);
  };

  const submit = async () => {
    setTouched(true);
    if (!categoryId || !reason.trim()) return;
    setIsBusy(true);
    setError(null);
    try {
      await post<AssetRequest>("/assets/requests", {
        category_id: categoryId,
        reason: reason.trim(),
        needed_by: neededBy || null,
      });
      toast.success("Request sent", { description: "Your manager or HR will decide on it." });
      setOpen(false);
      reset();
      onCreated();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The request could not be sent."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isBusy) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="accent" disabled={categories.length === 0}>
          <PackagePlus /> Request an asset
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request an asset</DialogTitle>
          <DialogDescription>
            Say what you need and why. Your line manager or HR approves it, and HR hands over the
            asset.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField
            htmlFor="asset-request-category"
            label="What do you need?"
            error={touched && !categoryId ? "Choose a kind of asset." : null}
          >
            <Select value={categoryId} disabled={isBusy} onValueChange={setCategoryId}>
              <SelectTrigger
                id="asset-request-category"
                className="w-full"
                aria-invalid={touched && !categoryId}
              >
                <SelectValue placeholder="Choose a kind of asset" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            htmlFor="asset-request-reason"
            label="Why"
            error={touched && !reason.trim() ? "Say what it is for." : null}
          >
            <Textarea
              id="asset-request-reason"
              rows={3}
              maxLength={2000}
              value={reason}
              disabled={isBusy}
              aria-invalid={touched && !reason.trim()}
              placeholder="e.g. Joining the data team; my current laptop cannot run the tools"
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="asset-request-needed-by" label="Needed by" optional>
            <DatePicker
              id="asset-request-needed-by"
              value={neededBy}
              min={todayISO()}
              disabled={isBusy}
              onChange={setNeededBy}
            />
          </FormField>
          {error && <InlineProblem>{error}</InlineProblem>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={() => void submit()}>
            {isBusy && <Loader2 className="animate-spin" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
