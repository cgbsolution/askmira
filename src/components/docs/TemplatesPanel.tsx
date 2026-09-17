"use client";

import { History, LayoutTemplate, Loader2, MoreHorizontal, Pencil, Plus, Sparkles } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { RequireRole } from "@/components/common/RequireRole";
import { LETTER_CATEGORY } from "@/components/docs/letterLabels";
import { TemplateEditorSheet } from "@/components/docs/TemplateEditorSheet";
import { apiMessage } from "@/components/people/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ADMIN } from "@/lib/access";
import { get, post } from "@/lib/api";
import type { LetterTemplate, LetterTemplateDetail, TemplateVersion } from "@/lib/types/docs";
import { formatDate } from "@/lib/utils";

/** The template catalogue: create, edit (as a new version), preview, version history. */
export function TemplatesPanel() {
  const [showAll, setShowAll] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<LetterTemplateDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [versionsOf, setVersionsOf] = useState<LetterTemplate | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const { data, error, isLoading, reload } = useApiQuery<LetterTemplate[]>(
    `/letter-templates${showAll ? "?include_inactive=true" : ""}`,
  );
  const versions = useApiQuery<TemplateVersion[]>(
    versionsOf ? `/letter-templates/${versionsOf.id}/versions` : null,
  );
  const rows = data ?? [];

  const openEditor = async (template: LetterTemplate | null) => {
    if (!template) {
      setEditing(null);
      setEditorOpen(true);
      return;
    }
    setLoadingId(template.id);
    try {
      setEditing(await get<LetterTemplateDetail>(`/letter-templates/${template.id}`));
      setEditorOpen(true);
    } catch (caught) {
      toast.error(apiMessage(caught, "The template could not be opened."));
    } finally {
      setLoadingId(null);
    }
  };

  const seed = async () => {
    setIsSeeding(true);
    try {
      const created = await post<LetterTemplate[]>("/letter-templates/seed");
      toast.success(
        created.length
          ? `${created.length} seed template(s) installed. Review them with your legal team before use.`
          : "The seed templates are already installed.",
      );
      reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "The seed templates could not be installed."));
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <>
      <DataPanel
        title="Letter templates"
        description="Editing a template saves a new version; letters already issued never change."
        actions={
          <>
            <RequireRole roles={ADMIN}>
              <Button size="sm" variant="outline" disabled={isSeeding} onClick={() => void seed()}>
                {isSeeding ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Install seed templates
              </Button>
            </RequireRole>
            <Button size="sm" variant="accent" onClick={() => void openEditor(null)}>
              <Plus /> New template
            </Button>
          </>
        }
        toolbar={
          <div className="flex items-center gap-2">
            <Switch id="tpl-show-all" checked={showAll} onCheckedChange={setShowAll} />
            <Label htmlFor="tpl-show-all">Show earlier versions</Label>
          </div>
        }
        isLoading={isLoading}
        error={error?.detail}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: LayoutTemplate,
          title: "No templates yet",
          description:
            "Create one, or install the seed offer, appointment, confirmation, relieving and experience templates.",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Rules</TableHead>
              <TableHead>Fields</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((template) => (
              <TableRow key={template.id}>
                <TableCell>
                  <p className="font-medium">{template.name}</p>
                  <p className="text-xs text-muted-foreground">{template.code}</p>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {LETTER_CATEGORY[template.category]}
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-1.5 tabular-nums">
                    v{template.version}
                    {!template.active && <Badge variant="muted">Superseded</Badge>}
                    {template.is_seed && <Badge variant="warning">Seed — review before use</Badge>}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1">
                    {template.requires_approval && <Badge variant="outline">Approval</Badge>}
                    {template.requires_signature && <Badge variant="outline">E-signature</Badge>}
                    {!template.requires_approval && !template.requires_signature && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {template.fields.length}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${template.name}`}
                        disabled={loadingId === template.id}
                      >
                        {loadingId === template.id ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => void openEditor(template)}>
                        <Pencil /> {template.active ? "Edit & preview" : "Open (saves as newest)"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setVersionsOf(template)}>
                        <History /> Version history
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      <TemplateEditorSheet
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editing}
        onSaved={reload}
      />

      <Dialog open={versionsOf !== null} onOpenChange={(open) => !open && setVersionsOf(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{versionsOf?.code} versions</DialogTitle>
            <DialogDescription>Each issued letter names the version it was rendered from.</DialogDescription>
          </DialogHeader>
          {versions.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : versions.error ? (
            <p className="text-sm text-destructive">{versions.error.detail}</p>
          ) : (
            <ul className="grid gap-2">
              {(versions.data ?? []).map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="tabular-nums">
                    v{v.version} · {v.name}
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {formatDate(v.created_at)}
                    {v.active && <Badge variant="success">Active</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
