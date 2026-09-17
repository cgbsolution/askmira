"use client";

import { ClipboardCheck } from "lucide-react";
import React, { useState } from "react";

import { Money } from "@/components/common/Money";
import { PersonCell } from "@/components/common/PersonCell";
import { DownloadButton } from "@/components/payroll-ops/shared";
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
import type { ProofQueueItem } from "@/lib/types/tax";
import { formatDate } from "@/lib/utils";

import { ProofStatusBadge, QueryPanel } from "./common";
import { ProofDecisionDialog } from "./ProofDecisionDialog";

export type QueueFilter = "pending" | "all";

/** The payroll team's verification queue, oldest first as the server sends it. */
export function ProofQueueTable({
  financialYear,
  status,
}: {
  financialYear: string;
  status: QueueFilter;
}) {
  const query = useApiQuery<ProofQueueItem[]>(
    `/tax/proofs/queue?financial_year=${encodeURIComponent(financialYear)}&status=${status}`,
  );
  const [deciding, setDeciding] = useState<ProofQueueItem | null>(null);
  const count = query.data && !query.isLoading ? query.data.length : null;

  return (
    <>
      <QueryPanel
        query={query}
        title="Proof queue"
        description={
          <>
            {status === "pending"
              ? `Proofs awaiting verification for FY ${financialYear}, oldest first.`
              : `Every proof uploaded for FY ${financialYear}, oldest first.`}
            {count !== null && (
              <span className="tabular-nums">
                {" "}
                {count} {count === 1 ? "proof" : "proofs"}.
              </span>
            )}
          </>
        }
        loadingRows={5}
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: ClipboardCheck,
          title:
            status === "pending"
              ? `Nothing is awaiting verification for FY ${financialYear}`
              : `No proofs have been uploaded for FY ${financialYear}`,
          description:
            status === "pending"
              ? "Proofs employees upload appear here until someone decides them."
              : "Proofs appear here once employees upload them against their declarations.",
        }}
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="text-right">Declared</TableHead>
                <TableHead className="text-right">Proof</TableHead>
                <TableHead className="text-right">Accepted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Document</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <PersonCell name={row.employee_name} subtitle={row.employee_code} size="sm" />
                  </TableCell>
                  <TableCell>
                    <p className="text-foreground">{row.section}</p>
                    {row.sub_category && (
                      <p className="text-xs text-muted-foreground">{row.sub_category}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.declared_amount} className="text-muted-foreground" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.proof_amount} className="font-medium" />
                  </TableCell>
                  <TableCell className="text-right">
                    {row.status === "pending" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Money value={row.accepted_amount} />
                    )}
                  </TableCell>
                  <TableCell className="max-w-56 whitespace-normal">
                    <ProofStatusBadge status={row.status} />
                    {row.verifier_remarks && (
                      <p className="mt-1 text-xs italic text-muted-foreground">
                        “{row.verifier_remarks}”
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(row.created_at)}</TableCell>
                  <TableCell>
                    {row.has_document ? (
                      <DownloadButton
                        path={`/tax/proofs/${row.id}/document`}
                        fallbackName={row.document_name ?? `proof-${row.id}`}
                        variant="ghost"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">None attached</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.status === "pending" && (
                      <Button size="sm" onClick={() => setDeciding(row)}>
                        Verify
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </QueryPanel>

      <ProofDecisionDialog
        item={deciding}
        onOpenChange={(open) => !open && setDeciding(null)}
        onDecided={query.reload}
      />
    </>
  );
}
