"use client";

import { Loader2, Upload } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { apiErrorMessage, DownloadButton, InlineProblem, isMoneyInput } from "@/components/payroll-ops/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post, put } from "@/lib/api";
import type { PreviousEmployer, PreviousEmployerInput } from "@/lib/types/tax";

import {
  pendingState,
  ProofStatusBadge,
  UPLOAD_ACCEPT,
  UPLOAD_HINT,
  uploadProblem,
  useHasLoaded,
} from "./common";

type MoneyField = "gross_salary" | "tds_deducted" | "pf_deducted" | "professional_tax" | "exempt_allowances";

const MONEY_FIELDS: { key: MoneyField; label: string; required: boolean }[] = [
  { key: "gross_salary", label: "Gross salary", required: true },
  { key: "tds_deducted", label: "TDS deducted", required: false },
  { key: "pf_deducted", label: "Provident fund deducted", required: false },
  { key: "professional_tax", label: "Professional tax", required: false },
  { key: "exempt_allowances", label: "Exempt allowances", required: false },
];

const EMPTY: Record<MoneyField, string> = {
  gross_salary: "",
  tds_deducted: "",
  pf_deducted: "",
  professional_tax: "",
  exempt_allowances: "",
};

/**
 * Income from an earlier employer in the same financial year. Without it a
 * mid-year joiner's TDS is worked out as if they earned nothing before joining.
 */
export function PreviousEmployerPanel({
  financialYear,
  onChanged,
}: {
  financialYear: string;
  onChanged: () => void;
}) {
  const fy = encodeURIComponent(financialYear);
  const query = useApiQuery<PreviousEmployer | null>(`/tax/previous-employer?financial_year=${fy}`);
  const loaded = useHasLoaded(query);

  const [employerName, setEmployerName] = useState("");
  const [values, setValues] = useState<Record<MoneyField, string>>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileAttempted, setFileAttempted] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    if (hydrated || !loaded) return;
    const record = query.data;
    if (record) {
      setEmployerName(record.employer_name ?? "");
      setValues({
        gross_salary: record.gross_salary,
        tds_deducted: record.tds_deducted,
        pf_deducted: record.pf_deducted,
        professional_tax: record.professional_tax,
        exempt_allowances: record.exempt_allowances,
      });
    }
    setHydrated(true);
  }, [hydrated, loaded, query.data]);

  const errors = Object.fromEntries(
    MONEY_FIELDS.map(({ key, label, required }) => {
      const value = values[key].trim();
      if (!value) return [key, required ? `${label} is required.` : null];
      return [key, isMoneyInput(value) ? null : "Rupees, at most two decimals."];
    }),
  ) as Record<MoneyField, string | null>;

  const save = async () => {
    setAttempted(true);
    if (Object.values(errors).some(Boolean)) return;
    setIsSaving(true);
    setServerError(null);
    const body: PreviousEmployerInput = {
      financial_year: financialYear,
      employer_name: employerName.trim() || null,
      gross_salary: values.gross_salary.trim(),
      tds_deducted: values.tds_deducted.trim() || "0",
      pf_deducted: values.pf_deducted.trim() || "0",
      professional_tax: values.professional_tax.trim() || "0",
      exempt_allowances: values.exempt_allowances.trim() || "0",
    };
    try {
      await put<PreviousEmployer>("/tax/previous-employer", body);
      toast.success("Previous employer figures saved", {
        description: "The projection has been refreshed.",
      });
      query.reload();
      onChanged();
    } catch (error) {
      setServerError(apiErrorMessage(error, "The figures could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  const fileError = uploadProblem(file);

  const uploadDocument = async () => {
    setFileAttempted(true);
    if (fileError || !file) return;
    setIsUploading(true);
    setUploadError(null);
    const form = new FormData();
    form.append("financial_year", financialYear);
    form.append("file", file);
    try {
      await post<PreviousEmployer>("/tax/previous-employer/document", form, { timeout: 120_000 });
      toast.success("Form 16 Part B attached");
      setFile(null);
      setFileAttempted(false);
      setFileInputKey((key) => key + 1);
      query.reload();
    } catch (error) {
      setUploadError(apiErrorMessage(error, "The document could not be uploaded."));
    } finally {
      setIsUploading(false);
    }
  };

  const state = pendingState(query, { rows: 5, loaded });
  const record = query.data ?? null;

  return (
    <div className="grid gap-4">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Previous employer</CardTitle>
          <CardDescription>
            If you worked somewhere else earlier in FY {financialYear}, enter what that employer paid
            and deducted — from their Form 16 — so your TDS here is not under-deducted.
          </CardDescription>
          {record && (
            <CardAction>
              <ProofStatusBadge status={record.status} />
            </CardAction>
          )}
        </CardHeader>

        {state ? (
          <CardContent className="p-0">{state}</CardContent>
        ) : (
          <form
            noValidate
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField
                htmlFor="prev-employer-name"
                label="Employer's name"
                optional
                className="md:col-span-2"
              >
                <Input
                  id="prev-employer-name"
                  value={employerName}
                  maxLength={255}
                  onChange={(event) => setEmployerName(event.target.value)}
                />
              </FormField>
              {MONEY_FIELDS.map(({ key, label, required }) => (
                <FormField
                  key={key}
                  htmlFor={`prev-${key}`}
                  label={`${label} (₹)`}
                  optional={!required}
                  hint={required ? undefined : "Leave blank if none."}
                  error={attempted ? errors[key] : null}
                >
                  <Input
                    id={`prev-${key}`}
                    value={values[key]}
                    inputMode="decimal"
                    autoComplete="off"
                    className="tabular-nums"
                    aria-invalid={attempted && Boolean(errors[key])}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [key]: event.target.value }))
                    }
                  />
                </FormField>
              ))}
              {serverError && (
                <div className="md:col-span-2">
                  <InlineProblem>{serverError}</InlineProblem>
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" disabled={isSaving || !hydrated}>
                {isSaving && <Loader2 className="animate-spin" />}
                Save figures
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>

      {!state && (
        <Card tier="tier1">
          <CardHeader>
            <CardTitle>Form 16 Part B</CardTitle>
            <CardDescription>The previous employer&apos;s statement, as evidence for the figures above.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!record ? (
              <p className="text-sm text-muted-foreground">
                Save the figures first, then attach the document.
              </p>
            ) : (
              <>
                {record.has_document ? (
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-foreground">A document is attached.</span>
                    <DownloadButton
                      path={`/tax/previous-employer/document?financial_year=${fy}`}
                      fallbackName={`form-16-part-b-${financialYear}`}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No document is attached yet.</p>
                )}
                <form
                  noValidate
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void uploadDocument();
                  }}
                >
                  <FormField
                    htmlFor="prev-document"
                    label={record.has_document ? "Replace document" : "Document"}
                  >
                    <Input
                      key={fileInputKey}
                      id="prev-document"
                      type="file"
                      accept={UPLOAD_ACCEPT}
                      className="max-w-sm"
                      aria-invalid={fileAttempted && Boolean(fileError)}
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    />
                  </FormField>
                  <Button type="submit" variant="outline" disabled={isUploading}>
                    {isUploading ? <Loader2 className="animate-spin" /> : <Upload />}
                    Upload
                  </Button>
                  <p className="w-full text-xs text-muted-foreground">{UPLOAD_HINT}</p>
                  {fileAttempted && fileError && (
                    <p className="w-full text-xs text-destructive">{fileError}</p>
                  )}
                </form>
                {uploadError && <InlineProblem>{uploadError}</InlineProblem>}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
