"use client";

import { Eye, Loader2, Plus, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { LETTER_CATEGORY } from "@/components/docs/letterLabels";
import { SandboxedHtml } from "@/components/docs/SandboxedHtml";
import { EmployeePicker, type PickedEmployee } from "@/components/people/EmployeePicker";
import { apiMessage } from "@/components/people/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post, put } from "@/lib/api";
import type {
  FieldSource,
  LetterCategory,
  LetterPreview,
  LetterTemplateDetail,
  MergeFields,
  TemplateContentInput,
  TemplateField,
} from "@/lib/types/docs";
import { humanizeRole } from "@/lib/utils";

const APPROVER_ROLES = ["admin", "sub_admin"];
const SOURCES: FieldSource[] = ["employee", "salary", "tenant", "manual", "computed"];

function blank(): TemplateContentInput {
  return {
    name: "",
    category: "custom",
    body_html: "",
    header_html: null,
    footer_html: null,
    requires_approval: false,
    approver_roles: [],
    requires_signature: false,
    signatory_role: null,
    fields: [],
  };
}

/**
 * Create a template, or edit one — an edit is saved as the next version and the
 * version being edited never changes. Preview renders in a sandboxed frame,
 * against a real employee or labelled sample values, and issues nothing.
 */
export function TemplateEditorSheet({
  open,
  onOpenChange,
  template,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The version being edited; omitted for a new template. */
  template: LetterTemplateDetail | null;
  onSaved: () => void;
}) {
  const [code, setCode] = useState("");
  const [content, setContent] = useState<TemplateContentInput>(blank);
  const [previewFor, setPreviewFor] = useState<PickedEmployee | null>(null);
  const [preview, setPreview] = useState<LetterPreview | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const mergeFields = useApiQuery<MergeFields>(open ? "/letter-templates/merge-fields" : null);

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setPreview(null);
    setPreviewFor(null);
    if (template) {
      setCode(template.code);
      setContent({
        name: template.name,
        category: template.category,
        body_html: template.body_html,
        header_html: template.header_html,
        footer_html: template.footer_html,
        requires_approval: template.requires_approval,
        approver_roles: template.approver_roles,
        requires_signature: template.requires_signature,
        signatory_role: template.signatory_role,
        fields: template.fields.map((f) => ({ ...f })),
      });
    } else {
      setCode("");
      setContent(blank());
    }
  }, [open, template]);

  const set = <K extends keyof TemplateContentInput>(key: K, value: TemplateContentInput[K]) =>
    setContent((current) => ({ ...current, [key]: value }));

  const setField = (index: number, change: Partial<TemplateField>) =>
    set(
      "fields",
      content.fields.map((field, i) => (i === index ? { ...field, ...change } : field)),
    );

  const runPreview = async () => {
    if (!content.body_html.trim()) {
      setServerError("Write the letter body before previewing it.");
      return;
    }
    setIsPreviewing(true);
    setServerError(null);
    try {
      const manual: Record<string, string> = {};
      content.fields
        .filter((f) => f.source === "manual")
        .forEach((f) => {
          const key = f.token.split(".").pop() ?? f.token;
          manual[key] = `[${f.label}]`;
        });
      setPreview(
        await post<LetterPreview>("/letter-templates/preview", {
          body_html: content.body_html,
          header_html: content.header_html || null,
          footer_html: content.footer_html || null,
          fields: content.fields,
          employee_id: previewFor?.id ?? null,
          manual_values: manual,
        }),
      );
    } catch (error) {
      setServerError(apiMessage(error, "The preview could not be rendered."));
    } finally {
      setIsPreviewing(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);
    if (!template && !/^[A-Za-z0-9_-]+$/.test(code.trim())) {
      return setServerError("The code may use letters, digits, - and _ only.");
    }
    if (!content.name.trim()) return setServerError("Give the template a name.");
    if (!content.body_html.trim()) return setServerError("The letter body is empty.");
    if (content.fields.some((f) => !f.token.trim() || !f.label.trim())) {
      return setServerError("Every declared field needs a token and a label.");
    }
    const body = {
      ...content,
      name: content.name.trim(),
      header_html: content.header_html?.trim() || null,
      footer_html: content.footer_html?.trim() || null,
      signatory_role: content.signatory_role?.trim() || null,
    };
    setIsSaving(true);
    try {
      if (template) {
        const saved = await put<LetterTemplateDetail>(`/letter-templates/${template.id}`, body);
        toast.success(`Saved as ${saved.code} v${saved.version}`);
      } else {
        const saved = await post<LetterTemplateDetail>("/letter-templates", {
          ...body,
          code: code.trim(),
        });
        toast.success(`${saved.code} v${saved.version} created`);
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      setServerError(apiMessage(error, "The template could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <form onSubmit={save} className="grid gap-5 p-4" noValidate>
          <SheetHeader className="p-0">
            <SheetTitle>
              {template ? `Edit ${template.code} (v${template.version})` : "New letter template"}
            </SheetTitle>
            <SheetDescription>
              {template
                ? `Saving creates v${template.version + 1}. Letters already issued from v${template.version} keep their exact text.`
                : "Template markup is yours; every merged value is escaped."}
            </SheetDescription>
          </SheetHeader>

          {template?.is_seed && (
            <Alert variant="warning">
              <AlertTitle>Seed template</AlertTitle>
              <AlertDescription>
                A starting point in a standard Indian format. Review and adapt it with your HR and
                legal teams before issuing it to anyone.
              </AlertDescription>
            </Alert>
          )}
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField htmlFor="tpl-code" label="Code">
              <Input
                id="tpl-code"
                value={code}
                disabled={Boolean(template)}
                maxLength={32}
                onChange={(e) => setCode(e.target.value)}
              />
            </FormField>
            <FormField htmlFor="tpl-name" label="Name">
              <Input id="tpl-name" value={content.name} onChange={(e) => set("name", e.target.value)} />
            </FormField>
            <FormField htmlFor="tpl-category" label="Category">
              <Select value={content.category} onValueChange={(v) => set("category", v as LetterCategory)}>
                <SelectTrigger id="tpl-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LETTER_CATEGORY) as LetterCategory[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {LETTER_CATEGORY[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField htmlFor="tpl-header" label="Header HTML" optional>
            <Textarea
              id="tpl-header"
              rows={2}
              className="font-mono text-xs"
              value={content.header_html ?? ""}
              onChange={(e) => set("header_html", e.target.value)}
            />
          </FormField>
          <FormField
            htmlFor="tpl-body"
            label="Body HTML"
            hint="Use tokens like {{employee.first_name}}, {{computed.ctc_table}}, {{manual.joining_date}}."
          >
            <Textarea
              id="tpl-body"
              rows={12}
              className="font-mono text-xs"
              value={content.body_html}
              onChange={(e) => set("body_html", e.target.value)}
            />
          </FormField>
          <FormField htmlFor="tpl-footer" label="Footer HTML" optional>
            <Textarea
              id="tpl-footer"
              rows={2}
              className="font-mono text-xs"
              value={content.footer_html ?? ""}
              onChange={(e) => set("footer_html", e.target.value)}
            />
          </FormField>

          {mergeFields.data && (
            <div className="rounded-lg border border-border p-3 text-xs">
              <p className="mb-2 font-medium text-foreground">Available tokens</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(mergeFields.data.sources).flatMap(([source, fields]) =>
                  fields.map((field) => (
                    <Badge key={`${source}.${field}`} variant="outline" className="font-normal">
                      {source}.{field}
                    </Badge>
                  )),
                )}
                {mergeFields.data.computed.map((name) => (
                  <Badge key={name} variant="secondary" className="font-normal">
                    computed.{name}
                  </Badge>
                ))}
              </div>
              <p className="mt-2 text-muted-foreground">{mergeFields.data.manual_note}</p>
            </div>
          )}

          <Separator />

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Declared fields</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  set("fields", [
                    ...content.fields,
                    { token: "manual.", label: "", source: "manual", required: true },
                  ])
                }
              >
                <Plus /> Add field
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Required fields block issuance when empty. Manual fields are asked for when a letter is issued.
            </p>
            {content.fields.map((field, index) => (
              <div key={index} className="grid items-end gap-2 sm:grid-cols-[1.3fr_1.3fr_1fr_auto_auto]">
                <FormField htmlFor={`fld-token-${index}`} label="Token">
                  <Input
                    id={`fld-token-${index}`}
                    className="font-mono text-xs"
                    value={field.token}
                    onChange={(e) => setField(index, { token: e.target.value })}
                  />
                </FormField>
                <FormField htmlFor={`fld-label-${index}`} label="Label">
                  <Input
                    id={`fld-label-${index}`}
                    value={field.label}
                    onChange={(e) => setField(index, { label: e.target.value })}
                  />
                </FormField>
                <FormField htmlFor={`fld-source-${index}`} label="Source">
                  <Select
                    value={field.source}
                    onValueChange={(v) => setField(index, { source: v as FieldSource })}
                  >
                    <SelectTrigger id={`fld-source-${index}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <div className="flex h-9 items-center gap-2">
                  <Checkbox
                    id={`fld-required-${index}`}
                    checked={field.required}
                    onCheckedChange={(checked) => setField(index, { required: checked === true })}
                  />
                  <Label htmlFor={`fld-required-${index}`}>Required</Label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove field"
                  onClick={() => set("fields", content.fields.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="tpl-approval">Needs approval before sending</Label>
                <Switch
                  id="tpl-approval"
                  checked={content.requires_approval}
                  onCheckedChange={(checked) => set("requires_approval", checked)}
                />
              </div>
              {content.requires_approval && (
                <div className="grid gap-2">
                  <p className="text-xs text-muted-foreground">
                    Who may approve (none selected: any admin)
                  </p>
                  {APPROVER_ROLES.map((role) => (
                    <div key={role} className="flex items-center gap-2">
                      <Checkbox
                        id={`role-${role}`}
                        checked={content.approver_roles.includes(role)}
                        onCheckedChange={(checked) =>
                          set(
                            "approver_roles",
                            checked === true
                              ? [...content.approver_roles, role]
                              : content.approver_roles.filter((r) => r !== role),
                          )
                        }
                      />
                      <Label htmlFor={`role-${role}`}>{humanizeRole(role)}</Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="tpl-signature">Needs e-signature</Label>
                <Switch
                  id="tpl-signature"
                  checked={content.requires_signature}
                  onCheckedChange={(checked) => set("requires_signature", checked)}
                />
              </div>
              <FormField htmlFor="tpl-signatory" label="Signatory role" optional>
                <Input
                  id="tpl-signatory"
                  value={content.signatory_role ?? ""}
                  onChange={(e) => set("signatory_role", e.target.value)}
                />
              </FormField>
            </div>
          </div>

          <Separator />

          <div className="grid gap-3">
            <p className="text-sm font-semibold">Preview</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-64 flex-1">
                <EmployeePicker
                  value={previewFor}
                  onChange={setPreviewFor}
                  placeholder="Sample values (no employee)"
                  allowClear
                />
              </div>
              <Button type="button" variant="outline" onClick={() => void runPreview()} disabled={isPreviewing}>
                {isPreviewing ? <Loader2 className="animate-spin" /> : <Eye />}
                Preview
              </Button>
            </div>
            {preview && (
              <div className="grid gap-2">
                <p className="text-xs text-muted-foreground">
                  {preview.is_sample
                    ? "Sample values in brackets — not a real employee. Salary tokens need a real employee."
                    : `Rendered for ${preview.employee_label}, values as of ${preview.as_of}. Nothing was issued.`}
                </p>
                {preview.problems.length > 0 && (
                  <Alert variant="warning">
                    <AlertTitle>Holes that would block issuance</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4">
                        {preview.problems.map((problem) => (
                          <li key={problem}>{problem}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <SandboxedHtml html={preview.html} title="Template preview" className="h-[50vh]" />
              </div>
            )}
          </div>

          <SheetFooter className="flex-row justify-end gap-2 p-0">
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              {template ? `Save as v${template.version + 1}` : "Create template"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
