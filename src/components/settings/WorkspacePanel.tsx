"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch } from "@/lib/api";
import type { TenantSettings } from "@/lib/types/admin";

import { errorDetail } from "./settingsShared";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "SGD", "AED"];
const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "UTC"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEK_STARTS = [
  { value: "monday", label: "Monday" },
  { value: "sunday", label: "Sunday" },
  { value: "saturday", label: "Saturday" },
];

interface Values {
  name: string;
  currency: string;
  timezone: string;
  fiscal_year_start_month: number;
  week_start: string;
}

/**
 * The workspace's own settings.
 *
 * The fiscal year start is the one with teeth: every tax computation, statutory
 * return and year-to-date figure is bounded by it, and in India that is April
 * rather than January. It is shown with that consequence attached, and only the
 * four fields the API accepts are editable — the rest (plan, region, slug) are
 * shown read-only rather than omitted, because "where is my data held" is a
 * question an administrator has to be able to answer.
 */
export function WorkspacePanel() {
  const { reloadSession } = useAuth();
  const { data, error, isLoading, reload } = useApiQuery<TenantSettings>("/admin/tenant");
  const [values, setValues] = useState<Values | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    const settings = data.settings ?? {};
    setValues({
      name: data.name,
      currency: String(settings.currency ?? "INR"),
      timezone: String(settings.timezone ?? "Asia/Kolkata"),
      fiscal_year_start_month: Number(settings.fiscal_year_start_month ?? 4),
      week_start: String(settings.week_start ?? "monday"),
    });
  }, [data]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => (current ? { ...current, [key]: value } : current));

  const submit = async () => {
    if (!values) return;
    setIsBusy(true);
    try {
      await patch<TenantSettings>("/admin/tenant", {
        name: values.name.trim(),
        currency: values.currency,
        timezone: values.timezone,
        fiscal_year_start_month: values.fiscal_year_start_month,
        week_start: values.week_start,
      });
      await reloadSession();
      reload();
      toast.success("Workspace settings saved.");
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the settings."));
    } finally {
      setIsBusy(false);
    }
  };

  const fyStart = values?.fiscal_year_start_month ?? 4;
  const fyEnd = ((fyStart + 10) % 12) + 1;

  return (
    <DataPanel
      title="Workspace"
      description="Changing these changes how dates and money are read across every module."
      isLoading={isLoading || (data !== null && values === null)}
      error={error?.detail ?? null}
      onRetry={reload}
    >
      {values && data && (
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <FormField htmlFor="workspace-name" label="Workspace name">
            <Input
              id="workspace-name"
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
            />
          </FormField>

          <FormField
            htmlFor="workspace-currency"
            label="Currency"
            hint="Every amount in the product is held and shown in this currency."
          >
            <Select value={values.currency} onValueChange={(next) => set("currency", next)}>
              <SelectTrigger id="workspace-currency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            htmlFor="workspace-fy"
            label="Financial year starts in"
            hint={`Year-to-date tax, statutory returns and Form 16 all run ${MONTHS[fyStart - 1]} to ${MONTHS[fyEnd - 1]}.`}
          >
            <Select
              value={String(values.fiscal_year_start_month)}
              onValueChange={(next) => set("fiscal_year_start_month", Number(next))}
            >
              <SelectTrigger id="workspace-fy" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, index) => (
                  <SelectItem key={month} value={String(index + 1)}>
                    {month}
                    {index === 3 && " (Indian financial year)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            htmlFor="workspace-week"
            label="Week starts on"
            hint="Used by rosters, timesheets and the team calendar."
          >
            <Select value={values.week_start} onValueChange={(next) => set("week_start", next)}>
              <SelectTrigger id="workspace-week" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEK_STARTS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            htmlFor="workspace-timezone"
            label="Default timezone"
            hint="A work location can override this; attendance is judged in the location's zone."
          >
            <Select value={values.timezone} onValueChange={(next) => set("timezone", next)}>
              <SelectTrigger id="workspace-timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 self-end text-sm sm:col-span-2">
            <Fact label="Workspace address" value={<span className="font-mono">{data.slug}</span>} />
            <Fact label="Plan" value={<Badge variant="outline">{data.plan}</Badge>} />
            <Fact
              label="Data region"
              value={<Badge variant="outline">{data.data_region}</Badge>}
            />
          </dl>

          <div className="sm:col-span-2">
            <Button onClick={submit} disabled={isBusy || values.name.trim().length < 2}>
              {isBusy && <Loader2 className="animate-spin" />} Save changes
            </Button>
          </div>
        </div>
      )}
    </DataPanel>
  );
}

/** A setting an administrator must be able to read but cannot change here. */
function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}
