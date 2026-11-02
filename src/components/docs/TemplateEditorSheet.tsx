"use client";

import { ChevronDown, Eye, Loader2, Plus, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { LETTER_CATEGORY } from "@/components/docs/letterLabels";
import { PdfPreview } from "@/components/docs/PdfPreview";
import { EmployeePicker, type PickedEmployee } from "@/components/people/EmployeePicker";
import { apiMessage } from "@/components/people/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor, type RichTextField } from "@/components/ui/rich-text-editor";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { fetchFile, post, put } from "@/lib/api";
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
const NO_DEFAULT = "__typed__";

/** Where each group of fields comes from, in the order the Insert field menu lists them. */
const GROUPS: Record<string, string> = {
  employee: "Employee",
  salary: "Salary",
  company: "Company (letterhead)",
  computed: "Dates, tables and signature",
  profile: "Profile (joining form)",
  statutory: "Statutory",
  tenant: "Workspace",
};

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
    use_letterhead: true,
    fields: [],
  };
}

function prettify(token: string): string {
  const key = token.split(".").pop() ?? token;
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Create a template, or edit one — an edit is saved as the next version and the
 * version being edited never changes.
 *
 * The letter is written in a document editor; values filled in for each person
 * are inserted from a menu. Preview renders the PDF exactly as it will print,
 * on the letterhead, for a real employee or with labelled sample values.
 */
export function TemplateEditorSheet({
  open,
  onOpenChange,
  template,
  initial = null,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The version being edited; omitted for a new template. */
  template: LetterTemplateDetail | null;
  /** Starting content for a new template (Duplicate). */
  initial?: TemplateContentInput | null;
  onSaved: () => void;
}) {
  const [code, setCode] = useState("");
  const [content, setContent] = useState<TemplateContentInput>(blank);
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [previewFor, setPreviewFor] = useState<PickedEmployee | null>(null);
  const [previewAsOf, setPreviewAsOf] = useState("");
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [problems, setProblems] = useState<string[] | null>(null);
  const [previewNote, setPreviewNote] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const mergeFields = useApiQuery<MergeFields>(open ? "/letter-templates/merge-fields" : null);

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setPdf(null);
    setProblems(null);
    setPreviewNote(null);
    setPreviewFor(null);
    setPreviewAsOf("");
    setMode("visual");
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
        use_letterhead: template.use_letterhead,
        fields: template.fields.map((f) => ({ ...f, source_path: f.source_path ?? null })),
      });
    } else if (initial) {
      setCode("");
      setContent({ ...initial, fields: initial.fields.map((f) => ({ ...f })) });
    } else {
      setCode("");
      setContent(blank());
    }
  }, [open, template, initial]);

  const labels = mergeFields.data?.labels ?? {};

  /** Every field the menu offers: record fields, then this template's typed ones. */
  const insertable = useMemo<RichTextField[]>(() => {
    const data = mergeFields.data;
    if (!data) return [];
    const out: RichTextField[] = [];
    const add = (token: string, group: string) =>
      out.push({ token, label: data.labels?.[token] ?? prettify(token), group });
    for (const source of Object.keys(GROUPS)) {
      if (source === "computed") {
        for (const name of data.computed) add(`computed.${name}`, GROUPS.computed);
      } else {
        for (const name of data.sources[source] ?? []) add(`${source}.${name}`, GROUPS[source]);
      }
    }
    for (const field of content.fields) {
      if (field.source === "manual" && field.token.length > "manual.".length) {
        out.push({ token: field.token, label: field.label || prettify(field.token), group: "Typed when issuing" });
      }
    }
    return out;
  }, [mergeFields.data, content.fields]);

  /** Record fields a typed value can start from. */
  const defaultOptions = useMemo(
    () =>
      insertable.filter(
        (f) => !f.token.startsWith("computed.") && !f.token.startsWith("manual."),
      ),
    [insertable],
  );

  const set = <K extends keyof TemplateContentInput>(key: K, value: TemplateContentInput[K]) =>
    setContent((current) => ({ ...current, [key]: value }));

  const setField = (index: number, change: Partial<TemplateField>) =>
    set(
      "fields",
      content.fields.map((field, i) => (i === index ? { ...field, ...change } : field)),
    );

  const runPreview = async () => {
    if (!content.body_html.trim()) {
      setServerError("Write the letter before previewing it.");
      return;
    }
    setIsPreviewing(true);
    setServerError(null);
    try {
      // Typed fields with nothing to start from show their label; the rest are
      // filled in from the chosen person, as issuing would.
      const manual: Record<string, string> = {};
      content.fields
        .filter((f) => f.source === "manual" && (!previewFor || !f.source_path))
        .forEach((f) => {
          const key = f.token.split(".").pop() ?? f.token;
          manual[key] = `[${f.label}]`;
        });
      const request = {
        body_html: content.body_html,
        header_html: content.header_html || null,
        footer_html: content.footer_html || null,
        fields: content.fields,
        employee_id: previewFor?.id ?? null,
        manual_values: manual,
        as_of: previewAsOf || null,
        use_letterhead: content.use_letterhead,
        category: content.category,
      };
      const [checked, file] = await Promise.all([
        post<LetterPreview>("/letter-templates/preview", request),
        fetchFile("/letter-templates/preview-pdf", { method: "POST", body: request, timeout: 60_000 }),
      ]);
      setProblems(checked.problems);
      setPreviewNote(
        checked.is_sample
          ? "Sample values in brackets — not a real person. Choose an employee to see their salary and details."
          : `For ${checked.employee_label}, values as of ${checked.as_of}. Nothing was issued.`,
      );
      setPdf(file.blob);
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
    if (!content.body_html.replace(/<[^>]*>|&nbsp;/g, "").trim()) {
      return setServerError("The letter is empty.");
    }
    if (content.fields.some((f) => !f.token.trim() || !f.label.trim())) {
      return setServerError("Every declared field needs a token and a label.");
    }
    const body = {
      ...content,
      name: content.name.trim(),
      header_html: content.header_html?.trim() || null,
      footer_html: content.footer_html?.trim() || null,
      signatory_role: content.signatory_role?.trim() || null,
      fields: content.fields.map((f) => ({
        ...f,
        source_path: f.source === "manual" ? f.source_path || null : null,
      })),
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
        toast.success(`${saved.name} created`);
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
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-5xl">
        <form onSubmit={save} className="grid gap-5 p-4" noValidate>
          <SheetHeader className="p-0">
            <SheetTitle>
              {template ? `Edit ${template.name} (v${template.version})` : "New letter template"}
            </SheetTitle>
            <SheetDescription>
              {template
                ? `Saving creates v${template.version + 1}. Letters already issued from v${template.version} keep their exact text.`
                : "Write the letter, insert the values each person gets, preview it, and save."}
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
            <FormField htmlFor="tpl-name" label="Name">
              <Input
                id="tpl-name"
                value={content.name}
                maxLength={255}
                onChange={(e) => set("name", e.target.value)}
              />
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
            <FormField
              htmlFor="tpl-code"
              label="Code"
              hint={template ? "A template's code never changes." : "Letters, digits, - and _."}
            >
              <Input
                id="tpl-code"
                value={code}
                disabled={Boolean(template)}
                maxLength={32}
                className="font-mono"
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
              />
            </FormField>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="tpl-letterhead">Print on the letterhead</Label>
              <p className="text-xs text-muted-foreground">
                Logo, colours and the company&apos;s details from Documents → Letterhead. Off for plain paper.
              </p>
            </div>
            <Switch
              id="tpl-letterhead"
              checked={content.use_letterhead}
              onCheckedChange={(checked) => set("use_letterhead", checked)}
            />
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "visual" | "html")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="tpl-body">Letter</Label>
              <TabsList>
                <TabsTrigger value="visual">Editor</TabsTrigger>
                <TabsTrigger value="html">HTML</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="visual" className="mt-2">
              <RichTextEditor
                aria-label="Letter text"
                id="tpl-body"
                value={content.body_html}
                onChange={(html) => set("body_html", html)}
                fields={insertable}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Highlighted words are filled in for each person when the letter is issued. Use Insert
                field to add one; delete it like a word.
              </p>
            </TabsContent>
            <TabsContent value="html" className="mt-2">
              <Textarea
                id="tpl-body-html"
                rows={16}
                className="font-mono text-xs"
                value={content.body_html}
                onChange={(e) => set("body_html", e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The same letter as HTML, for layouts the editor cannot make. Fields are written as{" "}
                <span className="font-mono">{"{{employee.designation}}"}</span>.
              </p>
            </TabsContent>
          </Tabs>

          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="w-fit px-2">
                <ChevronDown /> Header and footer HTML (advanced)
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="grid gap-4 pt-2 sm:grid-cols-2">
              <FormField htmlFor="tpl-header" label="Header HTML" optional>
                <Textarea
                  id="tpl-header"
                  rows={3}
                  className="font-mono text-xs"
                  value={content.header_html ?? ""}
                  onChange={(e) => set("header_html", e.target.value)}
                />
              </FormField>
              <FormField htmlFor="tpl-footer" label="Footer HTML" optional>
                <Textarea
                  id="tpl-footer"
                  rows={3}
                  className="font-mono text-xs"
                  value={content.footer_html ?? ""}
                  onChange={(e) => set("footer_html", e.target.value)}
                />
              </FormField>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Fields</p>
                <p className="text-xs text-muted-foreground">
                  Required fields stop a letter going out with a blank. Typed fields are asked for
                  when issuing; give one a field to start from and it is filled in for you.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  set("fields", [
                    ...content.fields,
                    { token: "manual.", label: "", source: "manual", required: true, source_path: null },
                  ])
                }
              >
                <Plus /> Add field
              </Button>
            </div>
            {content.fields.map((field, index) => (
              <div
                key={index}
                className="grid items-end gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1.2fr_1.2fr_0.9fr_1.3fr_auto_auto]"
              >
                <FormField htmlFor={`fld-token-${index}`} label="Token">
                  <Input
                    id={`fld-token-${index}`}
                    className="font-mono text-xs"
                    value={field.token}
                    onChange={(e) => setField(index, { token: e.target.value.trim() })}
                  />
                </FormField>
                <FormField htmlFor={`fld-label-${index}`} label="Label">
                  <Input
                    id={`fld-label-${index}`}
                    value={field.label}
                    placeholder={labels[field.token] ?? ""}
                    onChange={(e) => setField(index, { label: e.target.value })}
                  />
                </FormField>
                <FormField htmlFor={`fld-source-${index}`} label="Source">
                  <Select
                    value={field.source}
                    onValueChange={(v) =>
                      setField(index, {
                        source: v as FieldSource,
                        source_path: v === "manual" ? field.source_path : null,
                      })
                    }
                  >
                    <SelectTrigger id={`fld-source-${index}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s === "manual" ? "typed" : s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField htmlFor={`fld-default-${index}`} label="Starts from">
                  <Select
                    value={field.source_path || NO_DEFAULT}
                    disabled={field.source !== "manual"}
                    onValueChange={(v) => setField(index, { source_path: v === NO_DEFAULT ? null : v })}
                  >
                    <SelectTrigger id={`fld-default-${index}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value={NO_DEFAULT}>
                        {field.source === "manual" ? "Nothing — HR types it" : "—"}
                      </SelectItem>
                      {defaultOptions.map((option) => (
                        <SelectItem key={option.token} value={option.token}>
                          {option.group}: {option.label}
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
                  aria-label={`Remove field ${field.token}`}
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
            <div className="grid items-end gap-2 sm:grid-cols-[1fr_12rem_auto]">
              <FormField htmlFor="tpl-preview-person" label="For">
                <EmployeePicker
                  id="tpl-preview-person"
                  value={previewFor}
                  onChange={setPreviewFor}
                  placeholder="Sample values (no employee)"
                  allowClear
                />
              </FormField>
              <FormField htmlFor="tpl-preview-asof" label="Values as of" optional>
                <DatePicker id="tpl-preview-asof" value={previewAsOf} onChange={setPreviewAsOf} />
              </FormField>
              <Button type="button" variant="outline" onClick={() => void runPreview()} disabled={isPreviewing}>
                {isPreviewing ? <Loader2 className="animate-spin" /> : <Eye />}
                Preview
              </Button>
            </div>
            {previewNote && <p className="text-xs text-muted-foreground">{previewNote}</p>}
            {problems && problems.length > 0 && (
              <Alert variant="warning">
                <AlertTitle>Blanks that would stop this letter being issued</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <PdfPreview blob={pdf} isLoading={isPreviewing} title="Letter preview" className="h-[80vh]" />
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
