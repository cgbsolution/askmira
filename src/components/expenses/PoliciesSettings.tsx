"use client";

import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { InlineProblem, QueryBoundary, errorDetail } from "@/components/expenses/ReviewCommon";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { put } from "@/lib/api";
import type {
  ConversionConvention,
  ExpensePosture,
  ExpenseSettings,
  ExpenseSettingsInput,
} from "@/lib/types/expenses";

const CONVENTION_LABEL: Record<ConversionConvention, string> = {
  transaction_date: "Rate on the date the expense was incurred",
  settlement_date: "Rate on the date it was settled",
};

/** Tenant-wide expense settings, and what the module does not do yet. */
export function PoliciesSettings({ canAdmin }: { canAdmin: boolean }) {
  const query = useApiQuery<ExpenseSettings>("/expenses/settings");
  const posture = useApiQuery<ExpensePosture>("/expenses/posture");
  const [convention, setConvention] = useState<ConversionConvention>("transaction_date");
  const [rateSource, setRateSource] = useState("");
  const [blockDays, setBlockDays] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPosture, setShowPosture] = useState(false);

  const { data } = query;
  useEffect(() => {
    if (!data) return;
    setConvention(data.conversion_convention);
    setRateSource(data.rate_source);
    setBlockDays(String(data.advance_block_after_days));
  }, [data]);

  const valid = rateSource.trim().length > 0 && /^\d{1,3}$/.test(blockDays) && Number(blockDays) > 0;

  const save = async () => {
    if (!valid) return;
    setIsSaving(true);
    setProblem(null);
    try {
      const body: ExpenseSettingsInput = {
        conversion_convention: convention,
        rate_source: rateSource.trim(),
        advance_block_after_days: Number(blockDays),
      };
      const saved = await put<ExpenseSettings>("/expenses/settings", body);
      query.setData(saved);
      toast.success("Expense settings saved");
    } catch (error) {
      setProblem(errorDetail(error, "Could not save the settings."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            {canAdmin
              ? "How foreign currency is converted and when an unsettled advance blocks a new one."
              : "Read-only for your role. An HR admin can change these."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QueryBoundary query={query}>
            {(settings) => (
              <div className="grid max-w-2xl gap-4">
                <div className="grid gap-1.5">
                  <Label>Reporting currency</Label>
                  <p className="text-sm font-medium text-foreground">{settings.reporting_currency}</p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="settings-convention">Conversion convention</Label>
                  <Select
                    value={convention}
                    disabled={!canAdmin}
                    onValueChange={(value) => setConvention(value as ConversionConvention)}
                  >
                    <SelectTrigger id="settings-convention" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONVENTION_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="settings-source">Rate source</Label>
                    <Input
                      id="settings-source"
                      value={rateSource}
                      disabled={!canAdmin}
                      maxLength={200}
                      aria-invalid={canAdmin && !rateSource.trim()}
                      onChange={(event) => setRateSource(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="settings-block">Block a new advance after (days)</Label>
                    <Input
                      id="settings-block"
                      inputMode="numeric"
                      className="tabular-nums"
                      value={blockDays}
                      disabled={!canAdmin}
                      aria-invalid={canAdmin && !valid}
                      onChange={(event) => setBlockDays(event.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                </div>
                {problem && <InlineProblem>{problem}</InlineProblem>}
                {canAdmin && (
                  <div>
                    <Button disabled={!valid || isSaving} onClick={() => void save()}>
                      {isSaving && <Loader2 className="animate-spin" />}
                      Save settings
                    </Button>
                  </div>
                )}
              </div>
            )}
          </QueryBoundary>
        </CardContent>
      </Card>

      <Card tier="tier1" className="gap-3 py-4">
        <CardHeader>
          <CardTitle className="text-sm">What is enforced, and what is not built</CardTitle>
          {posture.data && (
            <CardDescription>
              {posture.data.not_built.length} {posture.data.not_built.length === 1 ? "item" : "items"} not built yet.
            </CardDescription>
          )}
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => setShowPosture((current) => !current)}>
              {showPosture ? <ChevronUp /> : <ChevronDown />}
              {showPosture ? "Hide" : "Show"}
            </Button>
          </CardAction>
        </CardHeader>
        {showPosture && (
          <CardContent>
            <QueryBoundary query={posture}>
              {(data) => (
                <div className="grid gap-4 text-sm md:grid-cols-2">
                  <div>
                    <p className="mb-1 font-medium text-foreground">Enforced</p>
                    <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                      {data.enforced.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 font-medium text-foreground">Not built</p>
                    <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                      {data.not_built.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </QueryBoundary>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
