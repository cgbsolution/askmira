"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { apiErrorMessage, InlineProblem, isMoneyInput } from "@/components/payroll-ops/shared";
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
import { Textarea } from "@/components/ui/textarea";
import { put } from "@/lib/api";
import type { DeclarationInput, TaxDeclaration } from "@/lib/types/tax";

const SECTION_PATTERN = /^[A-Z0-9]{2,16}$/;

/**
 * Add or change one declaration. A declaration is identified by its section and
 * sub-category, so those are fixed once it exists; the amount and description
 * can change while the declaration window allows it.
 */
export function DeclarationDialog({
  financialYear,
  declaration,
  open,
  onOpenChange,
  onSaved,
}: {
  financialYear: string;
  declaration: TaxDeclaration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [section, setSection] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSection(declaration?.section ?? "");
    setSubCategory(declaration?.sub_category ?? "");
    setAmount(declaration?.declared_amount ?? "");
    setDescription(declaration?.description ?? "");
    setAttempted(false);
    setServerError(null);
  }, [open, declaration]);

  const sectionError = !section.trim()
    ? "Section is required."
    : !SECTION_PATTERN.test(section.trim())
      ? "Use 2–16 letters or digits, for example 80C, 80D, 24B, 80CCD1B or LTA."
      : null;
  const amountError = !amount.trim()
    ? "Declared amount is required."
    : !isMoneyInput(amount)
      ? "Enter an amount in rupees, with at most two decimals."
      : null;

  const save = async () => {
    setAttempted(true);
    if (sectionError || amountError) return;
    setIsSaving(true);
    setServerError(null);
    const body: DeclarationInput = {
      financial_year: financialYear,
      section: section.trim(),
      sub_category: subCategory.trim(),
      declared_amount: amount.trim(),
      description: description.trim() || null,
    };
    try {
      const saved = await put<TaxDeclaration>("/tax/declarations", body);
      toast.success(`${saved.section} declaration saved`);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      setServerError(apiErrorMessage(error, "The declaration could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  const editing = declaration !== null;

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Change declaration" : "Add a declaration"}</DialogTitle>
          <DialogDescription>
            What you plan to claim for FY {financialYear}. Until proof is accepted, the projection
            uses the declared amount.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <FormField
              htmlFor="declaration-section"
              label="Section"
              error={attempted ? sectionError : null}
            >
              <Input
                id="declaration-section"
                value={section}
                disabled={editing}
                maxLength={16}
                placeholder="80C"
                autoComplete="off"
                aria-invalid={attempted && Boolean(sectionError)}
                onChange={(event) => setSection(event.target.value.toUpperCase().replace(/\s+/g, ""))}
              />
            </FormField>
            <FormField htmlFor="declaration-sub-category" label="Sub-category" optional>
              <Input
                id="declaration-sub-category"
                value={subCategory}
                disabled={editing}
                maxLength={64}
                placeholder="PPF, ELSS, life insurance…"
                autoComplete="off"
                onChange={(event) => setSubCategory(event.target.value)}
              />
            </FormField>
          </div>
          {editing && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Section and sub-category identify this declaration. To claim something else, add a
              new declaration.
            </p>
          )}

          <FormField
            htmlFor="declaration-amount"
            label="Declared amount (₹)"
            error={attempted ? amountError : null}
          >
            <Input
              id="declaration-amount"
              value={amount}
              inputMode="decimal"
              placeholder="150000"
              autoComplete="off"
              className="tabular-nums"
              aria-invalid={attempted && Boolean(amountError)}
              onChange={(event) => setAmount(event.target.value)}
            />
          </FormField>

          <FormField htmlFor="declaration-description" label="Description" optional>
            <Textarea
              id="declaration-description"
              value={description}
              maxLength={255}
              rows={2}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>

          {serverError && <InlineProblem>{serverError}</InlineProblem>}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Save declaration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
