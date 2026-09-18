"use client";

import { Blocks, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, put } from "@/lib/api";
import type { ModuleRow, ModuleState } from "@/lib/types/admin";

/** The section each module key switches on, for the confirmation copy. */
const AFFECTED: Record<string, string> = {
  core_hr: "People — directory, org chart, positions, lifecycle and documents",
  leave: "Time — time off, attendance, shifts and devices",
  payroll: "Payroll, statutory filings, loans, expenses and everyone's payslips",
  hiring: "Hiring — requisitions, candidates, interviews and offers",
  culture: "Culture — the feed, clubs, awards and surveys",
  rewards: "Rewards — points, the catalogue and redemptions",
  analytics: "Analytics — the BI connector and benchmarking",
};

function errorDetail(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/**
 * Settings → Modules.
 *
 * Switching a module off is not cosmetic: it hides the section from every
 * sidebar and the API refuses that module's routes. So switching *off* asks
 * first and names what disappears, while switching on applies straight away.
 */
export function ModulesScreen() {
  const { reloadSession } = useAuth();
  const { data, error, isLoading, reload } = useApiQuery<ModuleState>("/admin/modules");
  const [pending, setPending] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ModuleRow | null>(null);

  const apply = async (key: string, enabled: boolean) => {
    setPending(key);
    try {
      await put<ModuleState>("/admin/modules", { modules: { [key]: enabled } });
      // The sidebar and the route guard read the session's tenant, not this page.
      await reloadSession();
      reload();
      toast.success(enabled ? "Module switched on." : "Module switched off.");
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not change the module."));
      throw caught;
    } finally {
      setPending(null);
    }
  };

  const modules = data?.modules ?? [];

  return (
    <PageShell
      title="Modules"
      description="Which parts of AskMira this workspace has switched on."
    >
      <SectionNav section="settings" />

      <Alert>
        <Info />
        <AlertTitle>A switched-off module is switched off everywhere</AlertTitle>
        <AlertDescription>
          It disappears from the sidebar and the API refuses its routes, for every role — so a
          link someone saved returns a refusal rather than a page. Nothing is deleted: switching
          the module back on returns the data exactly as it was.
        </AlertDescription>
      </Alert>

      <DataPanel
        title="Modules"
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={modules.length === 0}
        empty={{ icon: Blocks, title: "No modules in the catalogue" }}
      >
        <ul className="divide-y divide-border">
          {modules.map((module) => (
            <li key={module.key} className="flex items-start justify-between gap-6 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor={`module-${module.key}`} className="text-sm font-medium">
                    {module.description}
                  </Label>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {module.key}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {AFFECTED[module.key] ?? "This module's screens and API routes."}
                </p>
              </div>
              <Switch
                id={`module-${module.key}`}
                checked={module.enabled}
                disabled={pending !== null}
                aria-label={`${module.description}: ${module.enabled ? "on" : "off"}`}
                onCheckedChange={(next) => {
                  if (next) void apply(module.key, true);
                  else setConfirming(module);
                }}
              />
            </li>
          ))}
        </ul>
      </DataPanel>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Switch off ${confirming?.key ?? ""}?`}
        description={
          confirming ? (
            <>
              This hides <strong>{AFFECTED[confirming.key] ?? confirming.description}</strong> from
              everyone in the workspace, and the API will refuse those routes. The data stays and
              comes back if you switch the module on again.
            </>
          ) : undefined
        }
        confirmLabel="Switch off"
        destructive
        onConfirm={async () => {
          if (confirming) await apply(confirming.key, false);
        }}
      />
    </PageShell>
  );
}
