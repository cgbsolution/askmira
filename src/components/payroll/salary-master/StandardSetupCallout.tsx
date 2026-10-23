"use client";

import { Loader2, Sparkles } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { apiMessage } from "@/components/payroll/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { post } from "@/lib/api";
import type { StandardSetupResult, StandardStatus } from "@/lib/types/payroll";

/**
 * Shown while the workspace lacks the Employee Salary Master template's wage
 * types (or still has AskMira's earlier names for them). One click adds what is
 * missing and renames AskMira's own defaults; a name the workspace chose itself
 * is never changed.
 */
export function StandardSetupCallout({ status, onDone }: { status: StandardStatus; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const firstTime = !status.has_structure;

  const install = async () => {
    setBusy(true);
    try {
      const result = await post<StandardSetupResult>("/salary-components/standard");
      const parts = [
        result.components_added.length ? `${result.components_added.length} wage types added` : null,
        result.components_renamed?.length ? `${result.components_renamed.length} renamed` : null,
        result.structure_name ? `the ${result.structure_name} structure created` : null,
      ].filter(Boolean);
      const title = parts.length ? `${parts.join(", ")}.` : "Already up to date.";
      if (result.structure_skipped) {
        toast.warning(title, { description: result.structure_skipped, duration: 15000 });
      } else {
        toast.success(title, { description: "Change any of it under Payroll setup → Salary structures." });
      }
      onDone();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not set up the wage types."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Alert variant="warning">
      <Sparkles />
      <AlertTitle>
        {firstTime ? "Set up the Salary Master" : "Update wage types to the Salary Master template"}
      </AlertTitle>
      <AlertDescription className="grid gap-3">
        <p>
          {firstTime
            ? "Adds the Employee Salary Master's wage types, in its groups and order: CTC TOTAL and GRATUITY AMOUNT MANUAL, regular and variable earnings, reimbursements, the statutory MANUAL rows, insurance, PROF TAX CTC and the provisions."
            : `${status.missing.length ? `${status.missing.length} wage types of the template are missing` : "Some wage types still have AskMira's earlier names"}. This adds the missing ones and renames AskMira's own defaults to the template's names. Names you chose yourself are not changed.`}
        </p>
        <div>
          <Button size="sm" disabled={busy} onClick={() => void install()}>
            {busy && <Loader2 className="animate-spin" />}
            {firstTime ? "Set up the Salary Master" : "Update wage types"}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
