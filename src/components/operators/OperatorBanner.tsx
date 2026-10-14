"use client";

import { Building2, Loader2, LogOut } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";

interface OperatorSession {
  active: boolean;
  client?: string | null;
  operator_firm?: string | null;
}

/**
 * Shown while a payroll operator is inside a client's workspace, on every page,
 * so nobody forgets whose payroll they are touching — and how to leave.
 */
export function OperatorBanner() {
  const { data } = useApiQuery<OperatorSession>("/operator/session");
  const [busy, setBusy] = useState(false);
  if (!data?.active) return null;

  const exit = async () => {
    setBusy(true);
    try {
      await post("/operator/exit");
      window.location.assign("/operator");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not return to your workspace.");
      setBusy(false);
    }
  };

  return (
    <Alert className="mb-4 flex items-center justify-between gap-3">
      <Building2 />
      <AlertDescription className="flex-1">
        You are working in <strong>{data.client}</strong>&apos;s workspace as a payroll operator. Payroll is
        open to you; employee, leave and attendance records are read-only.
      </AlertDescription>
      <Button size="sm" variant="outline" onClick={() => void exit()} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
        Back to my workspace
      </Button>
    </Alert>
  );
}
