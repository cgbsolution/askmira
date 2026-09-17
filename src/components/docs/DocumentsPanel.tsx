"use client";

import { Download, EyeOff, FileText, MoreHorizontal, Pencil, Trash2, Upload } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { EditDocumentDialog, UploadDocumentDialog } from "@/components/docs/DocumentDialogs";
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
import type { DocumentCategoryOption, VaultDocument } from "@/lib/types/docs";
import { formatDate, formatDay } from "@/lib/utils";

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
}: {
  title?: string;
  /** Restrict to one person (a profile tab). */
  employee?: PickedEmployee | null;
  showEmployee?: boolean;
  expiringOnly?: boolean;
}) {
  const { user, hasRole } = useAuth();
  const isHr = hasRole("tenant_admin", "hr_admin", "hr_ops");
  const [category, setCategory] = useState(NONE);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<VaultDocument | null>(null);
  const [deleting, setDeleting] = useState<VaultDocument | null>(null);

  const categories = useApiQuery<DocumentCategoryOption[]>("/documents/categories");
  const params = new URLSearchParams();
  if (employee) params.set("employee_id", employee.id);
  if (category !== NONE) params.set("category", category);
  const path = expiringOnly ? "/documents/expiring?within_days=60" : `/documents?${params}`;
  const { data, error, isLoading, reload } = useApiQuery<VaultDocument[]>(path);

  const labels = new Map((categories.data ?? []).map((c) => [c.value as string, c.label]));
  const rows = data ?? [];
  const managingOwn = Boolean(employee && employee.id === user?.employee_id);
  const canUpload = isHr && !expiringOnly && !managingOwn;

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
                ? "Documents on your own record are managed by another HR admin."
                : undefined
              : "Documents HR has shared with you."
        }
        actions={
          canUpload ? (
            <Button size="sm" onClick={() => setUploading(true)}>
              <Upload /> Upload
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
          title: expiringOnly ? "Nothing is expiring" : "No documents here",
          description: expiringOnly
            ? "No document with a validity date runs out in the next 60 days."
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
              <TableHead>Valid until</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((doc) => {
              const own = doc.employee_id === user?.employee_id;
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
