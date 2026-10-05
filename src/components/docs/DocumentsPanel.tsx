"use client";

import {
  BadgeCheck,
  Download,
  EyeOff,
  FileText,
  FilePlus2,
  MoreHorizontal,
  Pencil,
  ShieldX,
  Trash2,
  Upload,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import {
  EditDocumentDialog,
  SelfUploadDialog,
  UploadDocumentDialog,
  VerifyDocumentDialog,
} from "@/components/docs/DocumentDialogs";
import type { PickedEmployee } from "@/components/people/EmployeePicker";
import { apiMessage, NONE } from "@/components/people/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del, downloadFile } from "@/lib/api";
import type {
  DocumentCategoryOption,
  DocumentVerification,
  VaultDocument,
} from "@/lib/types/docs";
import { formatDate, formatDay } from "@/lib/utils";

const VERIFICATION: Record<
  Exclude<DocumentVerification, "not_required">,
  { label: string; variant: "warning" | "success" | "destructive" }
> = {
  pending: { label: "Waiting for HR", variant: "warning" },
  verified: { label: "Verified", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

function size(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A vault listing. HR sees everybody's (or one person's) and manages them;
 * everyone else sees their own documents HR marked visible — the server
 * decides which rows come back.
 */
export function DocumentsPanel({
  title = "Documents",
  employee,
  showEmployee = false,
  expiringOnly = false,
  verification,
}: {
  title?: string;
  /** Restrict to one person (a profile tab). */
  employee?: PickedEmployee | null;
  showEmployee?: boolean;
  expiringOnly?: boolean;
  /** Only documents in this verification state (HR's "to verify" queue). */
  verification?: DocumentVerification;
}) {
  const { user, hasRole } = useAuth();
  const isHr = hasRole("admin", "sub_admin");
  const [category, setCategory] = useState(NONE);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<VaultDocument | null>(null);
  const [deleting, setDeleting] = useState<VaultDocument | null>(null);
  const [selfUploading, setSelfUploading] = useState(false);
  const [verifying, setVerifying] = useState<{
    document: VaultDocument;
    decision: "verified" | "rejected";
  } | null>(null);

  const categories = useApiQuery<DocumentCategoryOption[]>("/documents/categories");
  const params = new URLSearchParams();
  if (employee) params.set("employee_id", employee.id);
  if (category !== NONE) params.set("category", category);
  if (verification) params.set("verification", verification);
  const path = expiringOnly ? "/documents/expiring?within_days=60" : `/documents?${params}`;
  const { data, error, isLoading, reload } = useApiQuery<VaultDocument[]>(path);

  const labels = new Map((categories.data ?? []).map((c) => [c.value as string, c.label]));
  const rows = data ?? [];
  const managingOwn = Boolean(employee && employee.id === user?.employee_id);
  const canUpload = isHr && !expiringOnly && !managingOwn && !verification;
  // Anybody adds documents to their own record; HR verifies them.
  const canSelfUpload =
    Boolean(user?.employee_id) && !expiringOnly && !verification && (managingOwn || (!isHr && !employee));
  const selfCategories = useApiQuery<DocumentCategoryOption[]>(
    canSelfUpload ? "/documents/categories/self-upload" : null,
  );

  const download = async (doc: VaultDocument) => {
    try {
      await downloadFile(`/documents/${doc.id}/download`, doc.title);
    } catch (caught) {
      toast.error(apiMessage(caught, "The document could not be downloaded."));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await del(`/documents/${deleting.id}`);
      toast.success(`"${deleting.title}" deleted`);
      reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "The document could not be deleted."));
      throw caught;
    }
  };

  return (
    <>
      <DataPanel
        title={title}
        description={
          expiringOnly
            ? "Expired, or expiring in the next 60 days."
            : isHr
              ? managingOwn
                ? "Documents you add wait for another admin to verify them."
                : verification === "pending"
                  ? "Documents employees added themselves. Download each one and check it before verifying."
                  : undefined
              : "Documents HR has shared with you, and those you have added yourself."
        }
        actions={
          canUpload ? (
            <Button size="sm" onClick={() => setUploading(true)}>
              <Upload /> Upload
            </Button>
          ) : canSelfUpload ? (
            <Button size="sm" onClick={() => setSelfUploading(true)}>
              <FilePlus2 /> Add a document
            </Button>
          ) : undefined
        }
        toolbar={
          expiringOnly ? undefined : (
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label="Category" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>All categories</SelectItem>
                {(categories.data ?? []).map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
        isLoading={isLoading}
        error={error?.detail}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: FileText,
          title: expiringOnly
            ? "Nothing is expiring"
            : verification === "pending"
              ? "Nothing waiting to be verified"
              : "No documents here",
          description: expiringOnly
            ? "No document with a validity date runs out in the next 60 days."
            : verification === "pending"
              ? "When an employee adds a document to their record, it waits here for you."
              : canSelfUpload
                ? "Add your ID proof, certificates and relieving letters. HR shares letters and contracts here too."
                : isHr
                  ? "Upload ID proofs, contracts and certificates to keep them with the record."
                  : "When HR shares a document with you, it appears here.",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              {showEmployee && <TableHead>Employee</TableHead>}
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((doc) => {
              const own = doc.employee_id === user?.employee_id;
              const state = doc.verification_status === "not_required" ? null : VERIFICATION[doc.verification_status];
              return (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{doc.title}</span>
                      {isHr && !doc.is_employee_visible && (
                        <Badge variant="muted">
                          <EyeOff /> HR only
                        </Badge>
                      )}
                    </div>
                    {doc.verification_status === "rejected" && doc.verification_note && (
                      <p className="mt-0.5 text-xs text-destructive">{doc.verification_note}</p>
                    )}
                  </TableCell>
                  {showEmployee && (
                    <TableCell className="text-muted-foreground">
                      {doc.employee_name} ({doc.employee_code})
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground">
                    {labels.get(doc.category) ?? doc.category}
                  </TableCell>
                  <TableCell>
                    {state ? (
                      <Badge variant={state.variant}>{state.label}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {doc.issued_on ? (
                      formatDay(doc.issued_on, true)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {doc.valid_until ? (
                      <span className="flex items-center gap-2">
                        {formatDay(doc.valid_until, true)}
                        {doc.is_expired && <Badge variant="destructive">Expired</Badge>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {size(doc.file_size_bytes)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(doc.created_at)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${doc.title}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => void download(doc)}>
                          <Download /> Download
                        </DropdownMenuItem>
                        {isHr && !own && doc.verification_status === "pending" && (
                          <>
                            <DropdownMenuItem onSelect={() => setVerifying({ document: doc, decision: "verified" })}>
                              <BadgeCheck /> Verify
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setVerifying({ document: doc, decision: "rejected" })}
                            >
                              <ShieldX /> Reject
                            </DropdownMenuItem>
                          </>
                        )}
                        {isHr && !own && (
                          <>
                            <DropdownMenuItem onSelect={() => setEditing(doc)}>
                              <Pencil /> Edit details
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(doc)}>
                              <Trash2 /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataPanel>

      {canUpload && (
        <UploadDocumentDialog
          open={uploading}
          onOpenChange={setUploading}
          categories={categories.data ?? []}
          employee={employee}
          onUploaded={reload}
        />
      )}
      {canSelfUpload && (
        <SelfUploadDialog
          open={selfUploading}
          onOpenChange={setSelfUploading}
          categories={selfCategories.data ?? []}
          onUploaded={reload}
        />
      )}
      <VerifyDocumentDialog
        document={verifying?.document ?? null}
        decision={verifying?.decision ?? "verified"}
        onOpenChange={(open) => !open && setVerifying(null)}
        onDone={reload}
      />
      <EditDocumentDialog
        document={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        categories={categories.data ?? []}
        onSaved={reload}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this document?"
        description={
          deleting
            ? `"${deleting.title}" will be removed from ${deleting.employee_name}'s vault. The audit log keeps a record that it existed.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
      />
    </>
  );
}
