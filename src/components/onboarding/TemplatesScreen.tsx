"use client";

import { ClipboardList, Loader2, Pencil, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { pluralCount } from "@/components/onboarding/shared";
import { TemplateEditor } from "@/components/onboarding/TemplateEditor";
import { ForbiddenState, toastApiError } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del, post, put } from "@/lib/api";
import type { OnboardingTemplate, TemplateInput } from "@/lib/types/onboarding";

type Editing = { template: OnboardingTemplate | null } | null;

/**
 * /onboarding/templates — the tenant's onboarding checklists. Nothing is made
 * up front: HR builds one, or asks for the standard Indian checklist and edits
 * it to fit.
 */
export function TemplatesScreen() {
  const query = useApiQuery<OnboardingTemplate[]>("/onboarding/templates");
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<OnboardingTemplate | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const rows = query.data ?? [];
  const forbidden = query.error?.status === 403;

  const buildStandard = async () => {
    setIsBuilding(true);
    try {
      const created = await post<OnboardingTemplate>("/onboarding/templates/standard");
      toast.success("Standard checklist created. Review it and make it yours.");
      query.reload();
      setEditing({ template: created });
    } catch (caught) {
      toastApiError(caught, "The standard checklist could not be created.");
    } finally {
      setIsBuilding(false);
    }
  };

  const makeDefault = async (template: OnboardingTemplate) => {
    try {
      await put<OnboardingTemplate>(`/onboarding/templates/${template.id}`, {
        is_default: true,
      } satisfies Partial<TemplateInput>);
      toast.success(`${template.name} is now the default`);
      query.reload();
    } catch (caught) {
      toastApiError(caught, "The default could not be changed.");
    }
  };

  const standardButton = (
    <Button variant="outline" disabled={isBuilding} onClick={() => void buildStandard()}>
      {isBuilding ? <Loader2 className="animate-spin" /> : <Sparkles />}
      Create a standard template
    </Button>
  );
  const newButton = (
    <Button onClick={() => setEditing({ template: null })}>
      <Plus /> New checklist
    </Button>
  );

  return (
    <PageShell
      title="Checklists"
      description="Onboarding checklists: the tasks, who does each, and when relative to the joining date."
      actions={
        <>
          {standardButton}
          {newButton}
        </>
      }
    >
      <DataPanel
        tier="tier1"
        isLoading={query.isLoading && query.data === null}
        error={forbidden ? null : (query.error?.detail ?? null)}
        onRetry={query.reload}
        isEmpty={!forbidden && query.data !== null && rows.length === 0}
        empty={{
          icon: ClipboardList,
          title: "No onboarding checklists yet",
          description:
            "Build your own, or start from the standard Indian checklist: offer acceptance, PAN, Aadhaar and bank proof, education and previous-employment documents, PF nomination (Form 2) and Form 11, laptop and email, ID card, manager welcome, buddy introduction, policy acknowledgements and a day-30 check-in.",
          action: (
            <div className="flex flex-wrap justify-center gap-2">
              {standardButton}
              {newButton}
            </div>
          ),
        }}
      >
        {forbidden ? (
          <ForbiddenState message={query.error?.detail} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Checklist</TableHead>
                <TableHead>Applies to</TableHead>
                <TableHead>Tasks</TableHead>
                <TableHead>Used by</TableHead>
                <TableHead className="w-48" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const before = row.tasks.filter((task) => task.due_offset_days < 0).length;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-md">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-foreground">{row.name}</span>
                        {row.is_default && <Badge variant="accent">Default</Badge>}
                        {!row.active && <Badge variant="muted">Inactive</Badge>}
                      </div>
                      {row.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs whitespace-normal text-muted-foreground">
                          {row.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.department_name || row.location_name ? (
                        [row.department_name, row.location_name].filter(Boolean).join(" · ")
                      ) : (
                        <span className="text-muted-foreground">Everyone</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span className="block">{row.task_count}</span>
                      {before > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          {before} before joining
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.plan_count > 0 ? pluralCount(row.plan_count, "plan") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {row.active && !row.is_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void makeDefault(row)}
                          >
                            <Star /> Make default
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${row.name}`}
                          onClick={() => setEditing({ template: row })}
                        >
                          <Pencil />
                        </Button>
                        {row.plan_count === 0 && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${row.name}`}
                            onClick={() => setDeleting(row)}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DataPanel>

      <TemplateEditor
        open={editing !== null}
        template={editing?.template ?? null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          query.reload();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete ${deleting.name}?` : "Delete checklist"}
        description="Nobody has been onboarded with it, so nothing refers to it. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await del(`/onboarding/templates/${deleting.id}`);
            toast.success("Checklist deleted");
            query.reload();
          } catch (caught) {
            toastApiError(caught, "The checklist could not be deleted.");
            throw caught;
          }
        }}
      />
    </PageShell>
  );
}
