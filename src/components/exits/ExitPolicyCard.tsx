"use client";

import { Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { useExitRoles } from "@/components/exits/common";
import { apiErrorMessage, InlineProblem, QueryBoundary } from "@/components/payroll-ops/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/useApiQuery";
import { put } from "@/lib/api";
import type { ExitPolicy } from "@/lib/types/payroll-ops";

/** Exit policy. HR can read it; an HR admin changes it. */
export function ExitPolicyCard() {
  const { isAdmin } = useExitRoles();
  const query = useApiQuery<ExitPolicy>("/exits/policy");
  const [draft, setDraft] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async (value: boolean) => {
    setIsSaving(true);
    setError(null);
    try {
      const saved = await put<ExitPolicy>("/exits/policy", { letters_require_settlement: value });
      query.setData(saved);
      setDraft(null);
      toast.success("Exit policy saved");
    } catch (caught) {
      setError(apiErrorMessage(caught, "The policy could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card tier="tier1" className="max-w-2xl">
      <CardHeader>
        <CardTitle>Exit policy</CardTitle>
        <CardDescription>
          {isAdmin ? "Changes are recorded in the audit trail." : "Only an HR admin can change this."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <QueryBoundary query={query} skeletonRows={1}>
          {(policy) => {
            const value = draft ?? policy.letters_require_settlement;
            const isDirty = draft !== null && draft !== policy.letters_require_settlement;
            return (
              <>
                <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-3">
                  <div>
                    <Label htmlFor="policy-letters-require-settlement">
                      Relieving and experience letters wait for the settlement to be approved
                    </Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      When on, a letter cannot be issued until the full &amp; final settlement is
                      approved, and never while it is on hold.
                    </p>
                  </div>
                  <Switch
                    id="policy-letters-require-settlement"
                    checked={value}
                    disabled={!isAdmin || isSaving}
                    onCheckedChange={setDraft}
                  />
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button disabled={!isDirty || isSaving} onClick={() => void save(value)}>
                      {isSaving && <Loader2 className="animate-spin" />}
                      Save policy
                    </Button>
                    {isDirty && (
                      <Button variant="ghost" disabled={isSaving} onClick={() => setDraft(null)}>
                        Discard
                      </Button>
                    )}
                  </div>
                )}
              </>
            );
          }}
        </QueryBoundary>
        {error && <InlineProblem>{error}</InlineProblem>}
      </CardContent>
    </Card>
  );
}
