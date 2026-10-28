"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { apiErrorMessage, InlineProblem, isMoneyInput, isZero } from "@/components/payroll-ops/shared";
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
import { post } from "@/lib/api";
import type { TaxDeclaration, TaxProof } from "@/lib/types/tax";
import { formatMoney } from "@/lib/utils";

import { UPLOAD_ACCEPT, UPLOAD_HINT, uploadProblem } from "./common";
import { FileInput } from "@/components/ui/file-input";

/** Upload one proof document against a declaration. */
export function ProofUploadDialog({
  declaration,
  onOpenChange,
  onUploaded,
}: {
  declaration: TaxDeclaration | null;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}) {
  const open = declaration !== null;
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setFile(null);
    setAttempted(false);
    setServerError(null);
  }, [open]);

  const amountError = !amount.trim()
    ? "Proof amount is required."
    : !isMoneyInput(amount)
      ? "Enter an amount in rupees, with at most two decimals."
      : isZero(amount)
        ? "The proof amount must be more than zero."
        : null;
  const fileError = uploadProblem(file);

  const upload = async () => {
    setAttempted(true);
    if (!declaration || amountError || fileError || !file) return;
    setIsUploading(true);
    setServerError(null);
    const form = new FormData();
    form.append("declaration_id", declaration.id);
    form.append("proof_amount", amount.trim());
    form.append("file", file);
    try {
      await post<TaxProof>("/tax/proofs", form, { timeout: 120_000 });
      toast.success("Proof uploaded", { description: "It is now awaiting verification." });
      onOpenChange(false);
      onUploaded();
    } catch (error) {
      setServerError(apiErrorMessage(error, "The proof could not be uploaded."));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isUploading && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload proof</DialogTitle>
          <DialogDescription>
            {declaration &&
              `${declaration.section}${declaration.sub_category ? ` · ${declaration.sub_category}` : ""} — declared ${formatMoney(declaration.declared_amount)}.`}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void upload();
          }}
        >
          <FormField
            htmlFor="proof-amount"
            label="Amount this proof supports (₹)"
            error={attempted ? amountError : null}
          >
            <Input
              id="proof-amount"
              value={amount}
              inputMode="decimal"
              autoComplete="off"
              className="tabular-nums"
              aria-invalid={attempted && Boolean(amountError)}
              onChange={(event) => setAmount(event.target.value)}
            />
          </FormField>

          <FormField
            htmlFor="proof-file"
            label="Document"
            hint={UPLOAD_HINT}
            error={attempted ? fileError : null}
          >
            <FileInput
              id="proof-file"
              accept={UPLOAD_ACCEPT}
              aria-invalid={attempted && Boolean(fileError)}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </FormField>

          {serverError && <InlineProblem>{serverError}</InlineProblem>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isUploading}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUploading}>
              {isUploading && <Loader2 className="animate-spin" />}
              Upload proof
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
