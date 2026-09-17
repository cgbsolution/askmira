"use client";

import { FilePlus2, Loader2, Pencil, Receipt, Send, Upload } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/common/Money";
import { DownloadButton, toastApiError } from "@/components/payroll-ops/shared";
import { Button } from "@/components/ui/button";
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
import type { TaxDeclaration } from "@/lib/types/tax";
import { formatDate } from "@/lib/utils";

import { DeclarationStatusBadge, ProofStatusBadge, QueryPanel } from "./common";
import { DeclarationDialog } from "./DeclarationDialog";
import { ProofUploadDialog } from "./ProofUploadDialog";

/** The employee's declarations for the year, their proofs and where each stands. */
export function DeclarationsPanel({
  financialYear,
  onChanged,
}: {
  financialYear: string;
  onChanged: () => void;
}) {
  const query = useApiQuery<TaxDeclaration[]>(
    `/tax/declarations?financial_year=${encodeURIComponent(financialYear)}`,
  );
  const [editing, setEditing] = useState<TaxDeclaration | "new" | null>(null);
  const [uploadFor, setUploadFor] = useState<TaxDeclaration | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const changed = () => {
    query.reload();
    onChanged();
  };

  const submit = async (declaration: TaxDeclaration) => {
    setSubmittingId(declaration.id);
    try {
      await post<TaxDeclaration>(`/tax/declarations/${declaration.id}/submit`);
      toast.success(`${declaration.section} declaration submitted`);
      changed();
    } catch (error) {
      toastApiError(error, "The declaration could not be submitted.");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <>
      <QueryPanel
        query={query}
        title="Declarations"
        description={`Investments and expenses you plan to claim in FY ${financialYear}, and the proof for each.`}
        actions={
          <Button variant="accent" onClick={() => setEditing("new")}>
            <FilePlus2 /> Add declaration
          </Button>
        }
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: Receipt,
          title: `No declarations for FY ${financialYear}`,
          description:
            "Declare what you plan to claim — 80C, 80D, home-loan interest under 24B, LTA and so on. The Projection tab shows what each one does to your TDS.",
        }}
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Section</TableHead>
                <TableHead className="text-right">Declared</TableHead>
                <TableHead className="text-right">Accepted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Proofs</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const locked = row.status === "locked";
                return (
                  <TableRow key={row.id}>
                    <TableCell className="align-top">
                      <p className="font-medium text-foreground">{row.section}</p>
                      {row.sub_category && (
                        <p className="text-xs text-muted-foreground">{row.sub_category}</p>
                      )}
                      {row.description && (
                        <p className="mt-1 max-w-56 whitespace-normal text-xs text-muted-foreground">
                          {row.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <Money value={row.declared_amount} />
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <Money value={row.accepted_amount} className="font-medium" />
                    </TableCell>
                    <TableCell className="align-top">
                      <DeclarationStatusBadge status={row.status} />
                      {row.submitted_at && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Submitted {formatDate(row.submitted_at)}
                        </p>
                      )}
                      {row.locked_at && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Locked {formatDate(row.locked_at)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="min-w-64 whitespace-normal align-top">
                      {row.proofs.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No proof uploaded</span>
                      ) : (
                        <ul className="space-y-2">
                          {row.proofs.map((proof) => (
                            <li key={proof.id} className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <ProofStatusBadge status={proof.status} />
                                <Money value={proof.proof_amount} className="text-sm" />
                                {proof.status !== "pending" && (
                                  <span className="text-xs text-muted-foreground">
                                    accepted <Money value={proof.accepted_amount} />
                                  </span>
                                )}
                                {proof.has_document && (
                                  <DownloadButton
                                    path={`/tax/proofs/${proof.id}/document`}
                                    fallbackName={proof.document_name ?? `proof-${proof.id}`}
                                    label="Document"
                                    variant="ghost"
                                  />
                                )}
                              </div>
                              {proof.verifier_remarks && (
                                <p className="text-xs italic text-muted-foreground">
                                  “{proof.verifier_remarks}”
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex justify-end gap-1">
                        {!locked && (
                          <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                            <Pencil /> Edit
                          </Button>
                        )}
                        {row.status === "draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={submittingId === row.id}
                            onClick={() => void submit(row)}
                          >
                            {submittingId === row.id ? <Loader2 className="animate-spin" /> : <Send />}
                            Submit
                          </Button>
                        )}
                        {!locked && (
                          <Button variant="outline" size="sm" onClick={() => setUploadFor(row)}>
                            <Upload /> Proof
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </QueryPanel>

      <DeclarationDialog
        financialYear={financialYear}
        declaration={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={changed}
      />
      <ProofUploadDialog
        declaration={uploadFor}
        onOpenChange={(open) => !open && setUploadFor(null)}
        onUploaded={changed}
      />
    </>
  );
}
