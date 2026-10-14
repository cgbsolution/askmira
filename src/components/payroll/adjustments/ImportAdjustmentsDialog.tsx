"use client";

import { FileUp, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { apiMessage } from "@/components/payroll/labels";
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
import { Input } from "@/components/ui/input";
import { post } from "@/lib/api";
import type { AdjustmentImportResult } from "@/lib/types/payroll-inputs";

/** One-time adjustments from a CSV, all or nothing. */
export function ImportAdjustmentsDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return setErrors(["Choose a CSV file."]);
    setIsSaving(true);
    setErrors([]);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await post<AdjustmentImportResult>("/payroll/adjustments/import", form);
      if (result.errors.length) {
        setErrors(result.errors);
        return;
      }
      toast.success(`${result.created} adjustment(s) keyed in, awaiting approval.`);
      setOpen(false);
      setFile(null);
      onImported();
    } catch (caught) {
      setErrors([apiMessage(caught, "Could not import the file.")]);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp /> Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Import one-time adjustments</DialogTitle>
            <DialogDescription>
              Columns: employee_code, category, name, amount, period (like 2026-10), reason; and
              optionally taxable (yes/no) and reference. Every row is checked first — a file with
              any problem creates nothing.
            </DialogDescription>
          </DialogHeader>
          <FormField htmlFor="adj-import-file" label="CSV file" required>
            <Input
              id="adj-import-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </FormField>
          {errors.length > 0 && (
            <ul role="alert" className="max-h-48 list-disc overflow-y-auto pl-5 text-sm text-destructive">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
