"use client";

import { FileText, Info, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { SETTLEMENT_STATUS_LABELS, useReloadOn } from "@/components/exits/common";
import { apiErrorMessage, InlineProblem, QueryBoundary } from "@/components/payroll-ops/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { ExitLetterInput, IssuedDocument, LetterGate } from "@/lib/types/payroll-ops";

const KIND_LABELS: Record<ExitLetterInput["kind"], string> = {
  relieving: "Relieving letter",
  experience: "Experience letter",
};

/**
 * Relieving and experience letters. Whether they may be issued yet is the
 * server's gate (usually: the settlement is approved); its reason is shown.
 */
export function LettersPanel({ exitId, version }: { exitId: string; version: number }) {
  const gate = useApiQuery<LetterGate>(`/exits/${exitId}/letter-gate`);
  useReloadOn(version, gate.reload);
  const [busyKind, setBusyKind] = useState<ExitLetterInput["kind"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ kind: ExitLetterInput["kind"]; doc: IssuedDocument }[]>(
    [],
  );

  const issue = async (kind: ExitLetterInput["kind"]) => {
    setBusyKind(kind);
    setError(null);
    try {
      const doc = await post<IssuedDocument>(`/exits/${exitId}/letters`, { kind });
      setIssued((current) => [...current, { kind, doc }]);
      toast.success(`${KIND_LABELS[kind]} ${doc.reference_number} issued`);
    } catch (caught) {
      setError(apiErrorMessage(caught, "The letter could not be issued."));
      gate.reload();
    } finally {
      setBusyKind(null);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Letters</CardTitle>
        <CardDescription>Relieving and experience letters for this exit.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <QueryBoundary query={gate} skeletonRows={1}>
          {(data) => (
            <>
              {!data.allowed && (
                <Alert variant="warning">
                  <Info />
                  <AlertTitle>Letters cannot be issued yet</AlertTitle>
                  <AlertDescription>
                    <p>{data.reason}</p>
                    {data.settlement_status && (
                      <p>
                        Settlement status:{" "}
                        {SETTLEMENT_STATUS_LABELS[data.settlement_status] ??
                          data.settlement_status}
                      </p>
                    )}
                    {data.hold_reason && <p>Hold reason: {data.hold_reason}</p>}
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex flex-wrap gap-2">
                {(Object.keys(KIND_LABELS) as ExitLetterInput["kind"][]).map((kind) => (
                  <Button
                    key={kind}
                    variant="outline"
                    size="sm"
                    disabled={!data.allowed || busyKind !== null}
                    onClick={() => void issue(kind)}
                  >
                    {busyKind === kind ? <Loader2 className="animate-spin" /> : <FileText />}
                    Issue {KIND_LABELS[kind].toLowerCase()}
                  </Button>
                ))}
              </div>
            </>
          )}
        </QueryBoundary>

        {error && <InlineProblem>{error}</InlineProblem>}

        {issued.map(({ kind, doc }) => (
          <Alert key={doc.letter_id} variant="success">
            <FileText />
            <AlertTitle>
              {KIND_LABELS[kind]} {doc.reference_number}
            </AlertTitle>
            <AlertDescription>
              <p>
                It is in Documents
                {kind === "relieving"
                  ? ", where a relieving letter needs approval before it is released."
                  : "."}
              </p>
            </AlertDescription>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
}
