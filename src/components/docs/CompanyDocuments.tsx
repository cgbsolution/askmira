"use client";

import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Download,
  EyeOff,
  Loader2,
  PenLine,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { IconInput } from "@/components/common/IconInput";
import { TablePager, usePaged } from "@/components/common/TablePager";
import { HandbookBuilder } from "@/components/docs/HandbookBuilder";
import { apiMessage } from "@/components/people/labels";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";

import { AcknowledgementRegisterSheet, AcknowledgePolicyDialog } from "./PolicyAcknowledgement";
import { del, downloadFile, patch, post } from "@/lib/api";
import type { CompanyDocument } from "@/lib/types/docs";
import { cn, formatDay } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg";

/** The policies an Indian mid-market company usually files, one click away. */
const TYPE_PRESETS = [
  "Employee handbook",
  "Leave policy",
  "Attendance policy",
  "Code of conduct",
  "POSH policy",
  "IT policy",
  "Cyber security policy",
  "Travel & relocation policy",
  "Insurance policy",
  "PIP policy",
  "Exit policy",
  "Labour policy",
];

/** The "every type" chip. */
export const ALL_TYPES = "__all__";

/** Chip filters with counts: "All (12)", "Leave policy (2)"… */
export function TypeChips({
  counts,
  value,
  onChange,
  total,
}: {
  counts: [string, number][];
  value: string;
  onChange: (value: string) => void;
  total: number;
}) {
  if (counts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
      {[[ALL_TYPES, total] as [string, number], ...counts].map(([type, count]) => (
        <Button
          key={type}
          type="button"
          size="sm"
          variant={value === type ? "default" : "outline"}
          className="h-8 rounded-full"
          aria-pressed={value === type}
          onClick={() => onChange(type)}
        >
          {type === ALL_TYPES ? "All" : type}
          <span
            className={cn(
              "rounded-full px-1.5 text-xs tabular-nums",
              value === type ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
            )}
          >
            {count}
          </span>
        </Button>
      ))}
    </div>
  );
}

/** How many of each, in first-seen order of the (already sorted) list. */
export function countBy<T>(rows: T[], key: (row: T) => string): [string, number][] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return [...counts.entries()];
}

function CompanyDocumentDialog({
  document,
  open,
  onOpenChange,
  onSaved,
}: {
  /** Editing this one; null adds a new document. */
  document: CompanyDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const editing = document !== null;
  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [remark, setRemark] = useState("");
  const [published, setPublished] = useState(true);
  const [requiresAck, setRequiresAck] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(document?.document_type ?? "");
    setTitle(document?.title ?? "");
    setNumber(document?.document_number ?? "");
    setIssuedOn(document?.issued_on ?? "");
    setValidUntil(document?.valid_until ?? "");
    setRemark(document?.remark ?? "");
    setPublished(document?.is_employee_visible ?? true);
    setRequiresAck(document?.requires_acknowledgement ?? false);
    setFile(null);
    setErrors({});
    setServerError(null);
  }, [open, document]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!type.trim()) found.type = "Say what kind of document this is.";
    if (!title.trim()) found.title = "Give it a title.";
    if (!editing && !file) found.file = "Choose a file.";
    else if (file && file.size > MAX_BYTES) found.file = "The file is larger than 10 MB.";
    if (issuedOn && validUntil && validUntil < issuedOn) found.valid = "The expiry date cannot be before the issue date.";
    if (requiresAck && !published) found.ack = "A document everyone must acknowledge has to be published.";
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) return;

    setIsSaving(true);
    try {
      if (editing) {
        await patch(`/documents/company/${document.id}`, {
          document_type: type.trim(),
          title: title.trim(),
          document_number: number.trim() || null,
          remark: remark.trim() || null,
          issued_on: issuedOn || null,
          valid_until: validUntil || null,
          is_employee_visible: published,
          requires_acknowledgement: requiresAck,
        });
        toast.success(`"${title.trim()}" updated`);
      } else if (file) {
        const form = new FormData();
        form.set("document_type", type.trim());
        form.set("title", title.trim());
        form.set("is_employee_visible", published ? "true" : "false");
        form.set("requires_acknowledgement", requiresAck ? "true" : "false");
        if (number.trim()) form.set("document_number", number.trim());
        if (remark.trim()) form.set("remark", remark.trim());
        if (issuedOn) form.set("issued_on", issuedOn);
        if (validUntil) form.set("valid_until", validUntil);
        form.set("file", file);
        await post("/documents/company", form, { timeout: 120_000 });
        toast.success(`"${title.trim()}" added`);
      }
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      setServerError(apiMessage(caught, "The document could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit company document" : "Add a company document"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "The file stays as it is. To replace it, add the new version and remove this one."
                : "A policy or handbook for everyone. PDF, PNG or JPEG up to 10 MB."}
            </DialogDescription>
          </DialogHeader>
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          <FormField htmlFor="company-doc-type" label="Document type" error={errors.type}>
            <Input
              id="company-doc-type"
              value={type}
              maxLength={64}
              placeholder="e.g. Leave policy"
              onChange={(event) => setType(event.target.value)}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {TYPE_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={type === preset ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setType(preset);
                    if (!title.trim()) setTitle(preset);
                  }}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="company-doc-title" label="Title" error={errors.title}>
              <Input
                id="company-doc-title"
                value={title}
                maxLength={255}
                placeholder="e.g. Leave policy 2026"
                onChange={(event) => setTitle(event.target.value)}
              />
            </FormField>
            <FormField htmlFor="company-doc-number" label="Document no." optional>
              <Input
                id="company-doc-number"
                value={number}
                maxLength={64}
                placeholder="e.g. HR-POL-004"
                onChange={(event) => setNumber(event.target.value)}
              />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="company-doc-issued" label="Effective from" optional>
              <DatePicker id="company-doc-issued" value={issuedOn || null} onChange={setIssuedOn} />
            </FormField>
            <FormField htmlFor="company-doc-valid" label="Valid till" optional error={errors.valid}>
              <DatePicker
                id="company-doc-valid"
                value={validUntil || null}
                min={issuedOn || undefined}
                onChange={setValidUntil}
              />
            </FormField>
          </div>
          <FormField htmlFor="company-doc-remark" label="Remark" optional>
            <Textarea
              id="company-doc-remark"
              rows={2}
              maxLength={1000}
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
            />
          </FormField>
          {!editing && (
            <FormField htmlFor="company-doc-file" label="File" error={errors.file}>
              <Input
                id="company-doc-file"
                type="file"
                accept={ACCEPT}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </FormField>
          )}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Published to employees</p>
              <p className="text-xs text-muted-foreground">
                Everyone can read and download it from their documents. Off keeps it with HR.
              </p>
            </div>
            <Switch checked={published} onCheckedChange={setPublished} aria-label="Published to employees" />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Every employee must acknowledge it</p>
              <p className="text-xs text-muted-foreground">
                Everyone is asked to read it and confirm by typing their name. HR sees who has.
              </p>
              {errors.ack && <p className="pt-1 text-xs text-destructive">{errors.ack}</p>}
            </div>
            <Switch
              checked={requiresAck}
              onCheckedChange={setRequiresAck}
              aria-label="Every employee must acknowledge it"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : editing ? <Pencil /> : <Upload />}
              {editing ? "Save" : "Add document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The company's own documents — policies, handbooks — filtered by type. HR
 * adds, edits, publishes and removes them; everyone else reads the published
 * ones (the server decides which rows come back).
 */
export function CompanyDocumentsPanel({
  title = "Company documents",
  description,
}: {
  title?: string;
  description?: string;
}) {
  const { hasRole } = useAuth();
  const isHr = hasRole("admin", "sub_admin");
  const { data, error, isLoading, reload } = useApiQuery<CompanyDocument[]>("/documents/company");
  const [type, setType] = useState(ALL_TYPES);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CompanyDocument | null>(null);
  const [deleting, setDeleting] = useState<CompanyDocument | null>(null);
  const [acknowledging, setAcknowledging] = useState<CompanyDocument | null>(null);
  const [registerFor, setRegisterFor] = useState<CompanyDocument | null>(null);

  const all = data ?? [];
  const counts = countBy(all, (row) => row.document_type);
  const needle = query.trim().toLowerCase();
  const rows = all.filter(
    (row) =>
      (type === ALL_TYPES || row.document_type === type) &&
      (!needle ||
        [row.document_type, row.title, row.document_number ?? "", row.remark ?? ""].some((value) =>
          value.toLowerCase().includes(needle),
        )),
  );
  const paged = usePaged(rows);

  const download = async (row: CompanyDocument) => {
    try {
      await downloadFile(`/documents/company/${row.id}/download`, row.title);
    } catch (caught) {
      toast.error(apiMessage(caught, "The document could not be downloaded."));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await del(`/documents/company/${deleting.id}`);
      toast.success(`"${deleting.title}" removed`);
      reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "The document could not be removed."));
      throw caught;
    }
  };

  return (
    <>
      <DataPanel
        title={title}
        description={
          description ??
          (isHr
            ? "Policies and handbooks. Published ones are open to every employee."
            : "Company policies and handbooks, to read and download.")
        }
        actions={
          isHr ? (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus /> Add company document
            </Button>
          ) : undefined
        }
        toolbar={
          all.length > 0 ? (
            <div className="flex w-full flex-col gap-3">
              <IconInput
                icon={Search}
                aria-label="Search company documents"
                placeholder="Search type, title or number"
                className="w-full sm:w-72"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <TypeChips counts={counts} value={type} onChange={setType} total={all.length} />
            </div>
          ) : undefined
        }
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: Building2,
          title: all.length === 0 ? "No company documents yet" : "Nothing matches",
          description:
            all.length === 0
              ? isHr
                ? "Add the employee handbook, leave policy and code of conduct so everyone can find them."
                : "When HR publishes a policy or handbook, it appears here."
              : "Try another type or search.",
        }}
        footer={rows.length > 0 ? <TablePager paged={paged} /> : undefined}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 pl-6">Sr. no.</TableHead>
              <TableHead>Document type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Document no.</TableHead>
              <TableHead>Effective from</TableHead>
              <TableHead>Valid till</TableHead>
              <TableHead>Remark</TableHead>
              <TableHead className="pr-6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.rows.map((row, index) => (
              <TableRow key={row.id}>
                <TableCell className="pl-6 tabular-nums text-muted-foreground">{paged.offset + index + 1}</TableCell>
                <TableCell className="font-medium">{row.document_type}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.title}
                    {isHr && !row.is_employee_visible && (
                      <Badge variant="muted">
                        <EyeOff /> HR only
                      </Badge>
                    )}
                    {row.requires_acknowledgement && isHr && (
                      <Badge variant="accent">Acknowledgement required</Badge>
                    )}
                    {row.requires_acknowledgement && row.acknowledged_by_me === false && (
                      <Badge variant="warning">Please acknowledge</Badge>
                    )}
                    {row.acknowledged_by_me === true && (
                      <Badge variant="success">
                        <CheckCircle2 /> Acknowledged
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.document_number ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.issued_on ? formatDay(row.issued_on, true) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.valid_until ? (
                    <span className="flex items-center gap-2">
                      {formatDay(row.valid_until, true)}
                      {row.is_expired && <Badge variant="destructive">Expired</Badge>}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="max-w-56 whitespace-normal text-sm text-muted-foreground">
                  {row.remark ?? "—"}
                </TableCell>
                <TableCell className="pr-6">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Download ${row.title}`}
                      onClick={() => void download(row)}
                    >
                      <Download />
                    </Button>
                    {row.acknowledged_by_me === false && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Acknowledge ${row.title}`}
                        onClick={() => setAcknowledging(row)}
                      >
                        <PenLine />
                      </Button>
                    )}
                    {isHr && row.requires_acknowledgement && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Who acknowledged ${row.title}`}
                        onClick={() => setRegisterFor(row)}
                      >
                        <ClipboardList />
                      </Button>
                    )}
                    {isHr && (
                      <>
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${row.title}`} onClick={() => setEditing(row)}>
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          aria-label={`Remove ${row.title}`}
                          onClick={() => setDeleting(row)}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      {isHr && (
        <div className="mt-6">
          <HandbookBuilder onPublished={reload} />
        </div>
      )}
      {isHr && (
        <CompanyDocumentDialog
          document={editing}
          open={adding || editing !== null}
          onOpenChange={(open) => {
            if (!open) {
              setAdding(false);
              setEditing(null);
            }
          }}
          onSaved={reload}
        />
      )}
      <AcknowledgePolicyDialog
        document={acknowledging}
        onClose={() => setAcknowledging(null)}
        onDone={reload}
      />
      <AcknowledgementRegisterSheet document={registerFor} onClose={() => setRegisterFor(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Remove this company document?"
        description={
          deleting
            ? `"${deleting.title}" will no longer be available to anyone. The audit log keeps a record that it existed.`
            : undefined
        }
        confirmLabel="Remove"
        destructive
        onConfirm={remove}
      />
    </>
  );
}
