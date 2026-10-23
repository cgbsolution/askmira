"use client";

import { Loader2, Sparkles } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { apiMessage } from "@/components/payroll/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { post } from "@/lib/api";
import type { StandardSetupResult } from "@/lib/types/payroll";

/**
 * Shown while a workspace has no salary structure: one click adds India's usual
 * wage types and a structure built from them. The rules are on the button, and
 * nothing the workspace already has is changed.
 */
export function StandardSetupCallout({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  const install = async () => {
    setBusy(true);
    try {
      const result = await post<StandardSetupResult>("/salary-components/standard");
      const parts = [
        result.components_added.length
          ? `${result.components_added.length} wage types added`
          : "Your wage types were kept as they are",
        result.structure_name ? `the ${result.structure_name} structure created` : null,
      ].filter(Boolean);
      if (result.structure_skipped) {
        toast.warning(`${parts.join(", ")}.`, { description: result.structure_skipped, duration: 15000 });
      } else {
        toast.success(`${parts.join(", ")}.`, {
          description: "Change any of it under Payroll setup → Salary structures.",
        });
      }
      onDone();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not set up the salary structure."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Alert variant="warning">
      <Sparkles />
      <AlertTitle>No salary structure yet</AlertTitle>
      <AlertDescription className="grid gap-3">
        <p>
          A structure says how a CTC splits into wage types. Start from the usual Indian one: Basic 50% of CTC, HRA 40%
          of Basic, gratuity 4.81% of Basic, and Special allowance takes the rest. It also adds conveyance, education,
          telephone and uniform allowances, bonus, leave encashment, fuel and medical reimbursements, insurance and a
          bonus provision to type per person. Nothing you already have is changed.
        </p>
        <div>
          <Button size="sm" disabled={busy} onClick={() => void install()}>
            {busy && <Loader2 className="animate-spin" />}
            Set up the standard structure
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
