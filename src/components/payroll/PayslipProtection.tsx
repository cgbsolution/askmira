"use client";

import { LockKeyhole } from "lucide-react";
import React from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, put } from "@/lib/api";

interface Protection {
  enabled: boolean;
  rule: string;
}

/** Admins: payslip PDFs employees download open with a password. */
export function PayslipProtectionSwitch() {
  const { hasRole } = useAuth();
  const { data, reload } = useApiQuery<Protection>("/payroll/payslip-protection");
  if (!hasRole("admin") || !data) return null;

  const toggle = async (enabled: boolean) => {
    try {
      await put("/payroll/payslip-protection", { enabled });
      toast.success(enabled ? "Payslip PDFs now open with a password." : "Payslip PDFs no longer need a password.");
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The setting was not saved.");
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-md border border-border px-3 py-2">
      <Switch id="payslip-password" checked={data.enabled} onCheckedChange={(on) => void toggle(on)} />
      <Label htmlFor="payslip-password" className="grid gap-0.5 text-sm font-normal">
        <span>Payslip PDFs open with a password</span>
        <span className="text-xs text-muted-foreground">{data.rule}</span>
      </Label>
    </div>
  );
}

/** For the person: what their payslip PDF opens with, when the workspace protects it. */
export function PayslipPasswordHint() {
  const { data } = useApiQuery<Protection>("/payroll/payslip-protection");
  if (!data?.enabled) return null;
  return (
    <Alert>
      <LockKeyhole />
      <AlertDescription>Your payslip PDFs open with a password. {data.rule}</AlertDescription>
    </Alert>
  );
}
