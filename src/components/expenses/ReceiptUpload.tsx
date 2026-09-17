"use client";

import { Download, FileText, Loader2, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadFile, post } from "@/lib/api";
import type { ExpenseMeta, Receipt } from "@/lib/types/expenses";

import { errorDetail, formatBytes } from "./shared";

function acceptsType(file: File, types: string[]): boolean {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  return types.some((raw) => {
    const type = raw.trim().toLowerCase();
    if (!type) return false;
    if (type.includes("/")) {
      return type.endsWith("/*") ? mime.startsWith(type.slice(0, -1)) : mime === type;
    }
    return name.endsWith(type.startsWith(".") ? type : `.${type}`);
  });
}

/**
 * Why a file cannot be a receipt, checked before it is sent.
 *
 * The server checks size and type again from the content itself; this only
 * saves the person an upload that would be refused.
 */
export function receiptProblem(file: File, meta: ExpenseMeta): string | null {
  if (meta.receipt_max_bytes > 0 && file.size > meta.receipt_max_bytes) {
    return `This file is ${formatBytes(file.size)}. A receipt can be at most ${formatBytes(meta.receipt_max_bytes)}.`;
  }
  if (meta.receipt_types.length > 0 && !acceptsType(file, meta.receipt_types)) {
    return `This file type is not accepted. Allowed: ${meta.receipt_types.join(", ")}.`;
  }
  return null;
}

/** Upload one receipt. Throws the ApiError (413, 415, 400) with the server's detail. */
export function uploadReceipt(file: File): Promise<Receipt> {
  const form = new FormData();
  form.append("file", file);
  return post<Receipt>("/expenses/receipts", form);
}

/** File input for a receipt, with the limits stated and checked. */
export function ReceiptPicker({
  id,
  meta,
  file,
  error,
  disabled,
  onChange,
}: {
  id: string;
  meta: ExpenseMeta;
  file: File | null;
  error: string | null;
  disabled?: boolean;
  onChange: (file: File | null, problem: string | null) => void;
}) {
  // Remounting the input is the only way to clear a file input's selection.
  const [inputKey, setInputKey] = useState(0);

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        Receipt <span className="text-muted-foreground">(image or PDF of the bill)</span>
      </Label>
      {file ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{file.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {formatBytes(file.size)}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove receipt"
            disabled={disabled}
            onClick={() => {
              onChange(null, null);
              setInputKey((current) => current + 1);
            }}
          >
            <X />
          </Button>
        </div>
      ) : (
        <Input
          key={inputKey}
          id={id}
          type="file"
          disabled={disabled}
          accept={meta.receipt_types.join(",") || undefined}
          onChange={(event) => {
            const chosen = event.target.files?.[0] ?? null;
            onChange(chosen, chosen ? receiptProblem(chosen, meta) : null);
          }}
        />
      )}
      <p className="text-xs text-muted-foreground">
        {meta.receipt_max_bytes > 0 && `Up to ${formatBytes(meta.receipt_max_bytes)}`}
        {meta.receipt_types.length > 0 && ` · ${meta.receipt_types.join(", ")}`}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** Download a stored receipt through the API (never a direct link). */
export function ReceiptDownloadButton({ receiptId }: { receiptId: string }) {
  const [isBusy, setIsBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isBusy}
      onClick={() => {
        setIsBusy(true);
        downloadFile(`/expenses/receipts/${receiptId}`, "receipt")
          .catch((caught) => toast.error(errorDetail(caught, "Could not download the receipt.")))
          .finally(() => setIsBusy(false));
      }}
    >
      {isBusy ? <Loader2 className="animate-spin" /> : <Download />}
      Download receipt
    </Button>
  );
}
