"use client";

import { FileSignature, FileText, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import {
  apiErrorMessage,
  DownloadButton,
  InlineProblem,
  NotLiveNotice,
} from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { Form12BBIssueInput, Form12BBPreview, IssuedDocument } from "@/lib/types/tax";
import { formatDate } from "@/lib/utils";

import { QueryPanel, shortHash, useReloadOn } from "./common";

/**
 * Form 12BB: the claims table as the server builds it (shown only inside a
 * sandboxed frame), issuing the form through the letter engine, and the forms
 * already issued.
 */
export function Form12BBPanel({
  financialYear,
  version,
}: {
  financialYear: string;
  version: number;
}) {
  const fy = encodeURIComponent(financialYear);
  const preview = useApiQuery<Form12BBPreview>(`/tax/form-12bb?financial_year=${fy}`);
  const documents = useApiQuery<IssuedDocument[]>(`/tax/form-12bb/documents?financial_year=${fy}`);
  useReloadOn(version, preview.reload);

  const [parentName, setParentName] = useState("");
  const [place, setPlace] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);

  const parentError = parentName.trim() ? null : "Father's or parent's name is required.";
  const placeError = place.trim() ? null : "Place is required.";

  const issue = async () => {
    setAttempted(true);
    if (parentError || placeError) return;
    setIsIssuing(true);
    setServerError(null);
    const body: Form12BBIssueInput = {
      financial_year: financialYear,
      parent_name: parentName.trim(),
      place: place.trim(),
    };
    try {
      const issued = await post<IssuedDocument>("/tax/form-12bb/issue", body);
      toast.success(`Form 12BB issued — ${issued.reference_number}`, {
        description: "It is for you to e-sign.",
      });
      setAttempted(false);
      documents.reload();
    } catch (error) {
      setServerError(apiErrorMessage(error, "Form 12BB could not be issued."));
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <div className="grid gap-4">
      <NotLiveNotice title="E-signature is not connected yet">
        Form 12BB is issued through the letter engine for you to e-sign. E-signature is not
        connected to a live provider, so an issued form is not yet signed.
      </NotLiveNotice>

      <QueryPanel
        query={preview}
        title="Claims in your Form 12BB"
        description={`Built from your declarations for FY ${financialYear}. Save changes in the other tabs and this refreshes.`}
        loadingRows={5}
      >
        {(data) => (
          <div className="p-4">
            {/* The one allowed raw element: server HTML only ever renders in a sandboxed frame. */}
            <iframe
              sandbox=""
              srcDoc={data.claims_table}
              title="Form 12BB claims"
              className="h-96 w-full rounded-md border border-border bg-card"
            />
          </div>
        )}
      </QueryPanel>

      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Issue Form 12BB</CardTitle>
          <CardDescription>
            The verification part of the form needs your father&apos;s or parent&apos;s name and the
            place you are signing from.
          </CardDescription>
        </CardHeader>
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void issue();
          }}
        >
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              htmlFor="f12bb-parent"
              label="Father's or parent's name"
              error={attempted ? parentError : null}
            >
              <Input
                id="f12bb-parent"
                value={parentName}
                maxLength={255}
                aria-invalid={attempted && Boolean(parentError)}
                onChange={(event) => setParentName(event.target.value)}
              />
            </FormField>
            <FormField htmlFor="f12bb-place" label="Place" error={attempted ? placeError : null}>
              <Input
                id="f12bb-place"
                value={place}
                maxLength={120}
                aria-invalid={attempted && Boolean(placeError)}
                onChange={(event) => setPlace(event.target.value)}
              />
            </FormField>
            {serverError && (
              <div className="md:col-span-2">
                <InlineProblem>{serverError}</InlineProblem>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={isIssuing}>
              {isIssuing ? <Loader2 className="animate-spin" /> : <FileSignature />}
              Issue for e-signature
            </Button>
          </CardFooter>
        </form>
      </Card>

      <QueryPanel
        query={documents}
        title="Issued forms"
        description={`Every Form 12BB issued to you for FY ${financialYear}.`}
        loadingRows={2}
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: FileText,
          title: "No Form 12BB issued yet",
          description: `Nothing has been issued to you for FY ${financialYear}.`,
        }}
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead className="hidden md:table-cell">Content hash</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.letter_id}>
                  <TableCell className="font-medium text-foreground tabular-nums">
                    {row.reference_number}
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted">{row.status.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.issued_at ? formatDate(row.issued_at) : "Not issued"}
                  </TableCell>
                  <TableCell
                    className="hidden text-xs text-muted-foreground tabular-nums md:table-cell"
                    title={row.content_hash}
                  >
                    {shortHash(row.content_hash)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DownloadButton
                      path={`/tax/form-12bb/${row.letter_id}/pdf`}
                      fallbackName={`form-12bb-${row.reference_number}.pdf`}
                      label="PDF"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </QueryPanel>
    </div>
  );
}
