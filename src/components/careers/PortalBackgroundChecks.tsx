"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { usePublicQuery } from "@/components/careers/usePublicQuery";
import { FormField } from "@/components/common/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, post } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

interface PortalCheck {
  id: string;
  agency_name: string;
  checks: string[];
  notice: string;
  status: "awaiting_your_answer" | "agreed" | "declined";
  answered_at: string | null;
}

/**
 * Background-check requests, for the candidate to agree to or decline.
 * Nothing is sent to the agency until they agree; the outcome is HR's and is
 * never shown here.
 */
export function PortalBackgroundChecks({ token, candidateName }: { token: string; candidateName: string }) {
  const base = `/public/candidate/${encodeURIComponent(token)}/background-checks`;
  const checks = usePublicQuery<PortalCheck[]>(base);
  const rows = checks.data ?? [];
  if (rows.length === 0) return null;

  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle>Background checks</CardTitle>
        <CardDescription>Nothing is checked until you agree. You can decline.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {rows.map((row) => (
          <CheckRequest key={row.id} base={base} row={row} candidateName={candidateName} onAnswered={checks.reload} />
        ))}
      </CardContent>
    </Card>
  );
}

function CheckRequest({
  base,
  row,
  candidateName,
  onAnswered,
}: {
  base: string;
  row: PortalCheck;
  candidateName: string;
  onAnswered: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<"agree" | "decline" | null>(null);

  const answer = async (agree: boolean) => {
    setBusy(agree ? "agree" : "decline");
    try {
      await post(`${base}/${row.id}/respond`, { agree, typed_name: agree ? typed.trim() : undefined });
      toast.success(agree ? "Thank you. The checks can now begin." : "You declined. HR has been told.");
      onAnswered();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Your answer could not be saved.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="grid gap-1">
          <p className="text-sm font-medium text-foreground">Checks by {row.agency_name}</p>
          <p className="text-sm text-muted-foreground">{row.notice}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {row.checks.map((check) => (
              <li key={check}>
                <Badge variant="outline">{check}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {row.status === "awaiting_your_answer" ? (
        <div className="grid gap-3">
          <FormField htmlFor={`bgv-name-${row.id}`} label={`To agree, type your full name (${candidateName})`}>
            <Input id={`bgv-name-${row.id}`} autoComplete="name" value={typed} onChange={(event) => setTyped(event.target.value)} />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy !== null || !typed.trim()} onClick={() => void answer(true)}>
              {busy === "agree" && <Loader2 className="animate-spin" />} I agree
            </Button>
            <Button variant="outline" disabled={busy !== null} onClick={() => void answer(false)}>
              {busy === "decline" && <Loader2 className="animate-spin" />} Decline
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {row.status === "agreed"
            ? `You agreed${row.answered_at ? ` on ${formatDateTime(row.answered_at)}` : ""}.`
            : "You declined this request."}
        </p>
      )}
    </div>
  );
}
