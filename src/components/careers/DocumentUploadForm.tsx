"use client";

import { Loader2, Upload } from "lucide-react";
import React, { useRef, useState } from "react";

import { FormField } from "@/components/common/FormField";
import { humanize } from "@/components/hiring/labels";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, post } from "@/lib/api";
import type { CandidatePortal } from "@/lib/types/hiring";

const ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];

/** Pre-joining document upload from the candidate portal. The server re-checks type and size. */
export function DocumentUploadForm({
  token,
  rules,
  onUploaded,
}: {
  token: string;
  rules: CandidatePortal["document_rules"];
  onUploaded: () => void;
}) {
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ category?: string; file?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function checkFile(candidate: File | null): string | undefined {
    if (!candidate) return "Choose a file to upload.";
    const name = candidate.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      return "Upload a PDF, PNG or JPEG file.";
    }
    if (candidate.size === 0) return "The file is empty.";
    if (candidate.size > rules.max_mb * 1024 * 1024) {
      return `The file must be ${rules.max_mb} MB or smaller.`;
    }
    return undefined;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setSuccess(null);
    const found: { category?: string; file?: string } = {};
    if (!category) found.category = "Choose what this document is.";
    const fileError = checkFile(file);
    if (fileError) found.file = fileError;
    setErrors(found);
    if (found.category || found.file || !file) return;

    const form = new FormData();
    form.append("category", category);
    form.append("file", file);
    setPending(true);
    try {
      await post(`/public/candidate/${encodeURIComponent(token)}/documents`, form, {
        skipAuthRedirect: true,
      });
      setSuccess(`${file.name} was uploaded.`);
      setFile(null);
      setCategory("");
      if (fileInput.current) fileInput.current.value = "";
      onUploaded();
    } catch (caught) {
      setServerError(
        caught instanceof ApiError ? caught.detail : "The document could not be uploaded. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="doc-category" label="Document type *" error={errors.category}>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="doc-category" className="w-full" aria-invalid={Boolean(errors.category)}>
              <SelectValue placeholder="Choose a type" />
            </SelectTrigger>
            <SelectContent>
              {rules.categories.map((value) => (
                <SelectItem key={value} value={value}>
                  {humanize(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          htmlFor="doc-file"
          label="File *"
          hint={`PDF, PNG or JPEG, up to ${rules.max_mb} MB.`}
          error={errors.file}
        >
          <Input
            id="doc-file"
            ref={fileInput}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            aria-invalid={Boolean(errors.file)}
            onChange={(event) => {
              const chosen = event.target.files?.[0] ?? null;
              setFile(chosen);
              setErrors((current) => ({ ...current, file: chosen ? checkFile(chosen) : undefined }));
            }}
          />
        </FormField>
      </div>
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert variant="success">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending || rules.categories.length === 0}>
        {pending ? <Loader2 className="animate-spin" /> : <Upload />}
        Upload document
      </Button>
    </form>
  );
}
