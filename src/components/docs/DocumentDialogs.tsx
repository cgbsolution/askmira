"use client";

import { Loader2, Upload } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { EmployeePicker, type PickedEmployee } from "@/components/people/EmployeePicker";
import { apiMessage } from "@/components/people/labels";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { patch, post } from "@/lib/api";
import type { DocumentCategory, DocumentCategoryOption, VaultDocument } from "@/lib/types/docs";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg";

/** HR uploads a document to one employee's vault. The server re-checks size and type. */
export function UploadDocumentDialog({
  open,
  onOpenChange,
  categories,
  employee,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: DocumentCategoryOption[];
  /** Fixed recipient (on a profile). Omitted: HR picks one. */
  employee?: PickedEmployee | null;
  onUploaded: () => void;
}) {
  const [person, setPerson] = useState<PickedEmployee | null>(employee ?? null);
  const [category, setCategory] = useState<DocumentCategory | "">("");
  const [title, setTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [visible, setVisible] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPerson(employee ?? null);
    setCategory("");
    setTitle("");
    setValidUntil("");
    setVisible(true);
    setFile(null);
    setErrors({});
    setServerError(null);
  }, [open, employee]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!person) found.person = "Choose whose vault this goes in.";
    if (!category) found.category = "Choose a category.";
    if (!title.trim()) found.title = "Give the document a title.";
    if (!file) found.file = "Choose a file.";
    else if (file.size > MAX_BYTES) found.file = "The file is larger than 10 MB.";
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length || !file || !person) return;

    const form = new FormData();
    form.set("employee_id", person.id);
    form.set("category", category);
    form.set("title", title.trim());
    form.set("is_employee_visible", visible ? "true" : "false");
    if (validUntil) form.set("valid_until", validUntil);
    form.set("file", file);

    setIsSaving(true);
    try {
      await post("/documents", form, { timeout: 120_000 });
      toast.success(`"${title.trim()}" uploaded`);
      onUploaded();
      onOpenChange(false);
    } catch (error) {
      setServerError(apiMessage(error, "The document could not be uploaded."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Upload a document</DialogTitle>
            <DialogDescription>
              PDF, PNG or JPEG up to 10 MB. The type is checked from the file itself.
            </DialogDescription>
          </DialogHeader>
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          {!employee && (
            <FormField htmlFor="doc-person" label="Employee" error={errors.person}>
              <EmployeePicker id="doc-person" value={person} onChange={setPerson} />
            </FormField>
          )}
          <FormField htmlFor="doc-category" label="Category" error={errors.category}>
            <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
              <SelectTrigger id="doc-category" className="w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="doc-title" label="Title" error={errors.title}>
            <Input
              id="doc-title"
              value={title}
              maxLength={255}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="doc-valid" label="Valid until" optional hint="For passports, visas, certificates.">
            <Input
              id="doc-valid"
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="doc-file" label="File" error={errors.file}>
            <Input
              id="doc-file"
              type="file"
              accept={ACCEPT}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </FormField>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Visible to the employee</p>
              <p className="text-xs text-muted-foreground">
                Off keeps it in the HR file only.
              </p>
            </div>
            <Switch
              checked={visible}
              onCheckedChange={setVisible}
              aria-label="Visible to the employee"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Upload />}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** HR edits a document's metadata. The file itself never changes. */
export function EditDocumentDialog({
  document,
  onOpenChange,
  categories,
  onSaved,
}: {
  document: VaultDocument | null;
  onOpenChange: (open: boolean) => void;
  categories: DocumentCategoryOption[];
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [visible, setVisible] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!document) return;
    setTitle(document.title);
    setCategory(document.category);
    setValidUntil(document.valid_until ?? "");
    setVisible(document.is_employee_visible);
    setServerError(null);
  }, [document]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!document) return;
    if (!title.trim()) {
      setServerError("A title is required.");
      return;
    }
    setIsSaving(true);
    try {
      await patch(`/documents/${document.id}`, {
        title: title.trim(),
        category,
        valid_until: validUntil || null,
        is_employee_visible: visible,
      });
      toast.success("Document updated");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      setServerError(apiMessage(error, "The document could not be updated."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={document !== null} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Edit document details</DialogTitle>
            <DialogDescription>To replace the file, upload a new one and delete this.</DialogDescription>
          </DialogHeader>
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          <FormField htmlFor="edit-doc-title" label="Title">
            <Input id="edit-doc-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField htmlFor="edit-doc-category" label="Category">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="edit-doc-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="edit-doc-valid" label="Valid until" optional>
            <Input
              id="edit-doc-valid"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </FormField>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Visible to the employee</p>
            <Switch checked={visible} onCheckedChange={setVisible} aria-label="Visible to the employee" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * An employee adds a document to their own record. It waits for HR to verify
 * it; whose record it goes on is decided by the server from the login.
 */
export function SelfUploadDialog({
  open,
  onOpenChange,
  categories,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Only the categories an employee may upload (`/documents/categories/self-upload`). */
  categories: DocumentCategoryOption[];
  onUploaded: () => void;
}) {
  const [category, setCategory] = useState<DocumentCategory | "">("");
  const [title, setTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategory("");
    setTitle("");
    setValidUntil("");
    setFile(null);
    setErrors({});
    setServerError(null);
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!category) found.category = "Choose what kind of document this is.";
    if (!title.trim()) found.title = "Give the document a title.";
    if (!file) found.file = "Choose a file.";
    else if (file.size > MAX_BYTES) found.file = "The file is larger than 10 MB.";
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length || !file) return;

    const form = new FormData();
    form.set("category", category);
    form.set("title", title.trim());
    if (validUntil) form.set("valid_until", validUntil);
    form.set("file", file);

    setIsSaving(true);
    try {
      await post("/documents/mine", form, { timeout: 120_000 });
      toast.success(`"${title.trim()}" uploaded. HR will verify it.`);
      onUploaded();
      onOpenChange(false);
    } catch (error) {
      setServerError(apiMessage(error, "The document could not be uploaded."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Add a document to your record</DialogTitle>
            <DialogDescription>
              ID proof, certificates, relieving letters. PDF, PNG or JPEG up to 10 MB. HR verifies it
              before it counts as on file.
            </DialogDescription>
          </DialogHeader>
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          <FormField htmlFor="self-doc-category" label="Kind of document" error={errors.category}>
            <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
              <SelectTrigger id="self-doc-category" className="w-full">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            htmlFor="self-doc-title"
            label="Title"
            error={errors.title}
            hint="For example: Passport, B.Tech degree, Relieving letter from Acme."
          >
            <Input
              id="self-doc-title"
              value={title}
              maxLength={255}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="self-doc-valid" label="Valid until" optional hint="For passports, visas and licences.">
            <DatePicker id="self-doc-valid" value={validUntil || null} onChange={setValidUntil} />
          </FormField>
          <FormField htmlFor="self-doc-file" label="File" error={errors.file}>
            <Input
              id="self-doc-file"
              type="file"
              accept={ACCEPT}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Upload />}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** HR verifies or rejects a document the employee uploaded. A rejection says why. */
export function VerifyDocumentDialog({
  document,
  decision,
  onOpenChange,
  onDone,
}: {
  document: VaultDocument | null;
  decision: "verified" | "rejected";
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNote("");
    setError(null);
  }, [document, decision]);

  const submit = async () => {
    if (!document) return;
    if (decision === "rejected" && note.trim().length < 3) {
      setError("Say why, so the employee knows what to upload instead.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await post(`/documents/${document.id}/verify`, { decision, note: note.trim() || null });
      toast.success(decision === "verified" ? "Document verified" : "Document rejected");
      onDone();
      onOpenChange(false);
    } catch (caught) {
      setError(apiMessage(caught, "The document could not be updated."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={document !== null} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {decision === "verified" ? "Verify" : "Reject"} {document ? `"${document.title}"` : "document"}
          </DialogTitle>
          <DialogDescription>
            Uploaded by {document?.employee_name}. Download it and check it against the original first.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <FormField
          htmlFor="verify-note"
          label={decision === "verified" ? "Note" : "Why it is rejected"}
          optional={decision === "verified"}
        >
          <Textarea id="verify-note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={decision === "rejected" ? "destructive" : "default"}
            disabled={isSaving}
            onClick={() => void submit()}
          >
            {isSaving && <Loader2 className="animate-spin" />}
            {decision === "verified" ? "Verify" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
