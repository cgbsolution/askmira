"use client";

import {
  BadgeCheck,
  Download,
  EyeOff,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldX,
  Trash2,
  Users,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { IconInput } from "@/components/common/IconInput";
import { TablePager, usePaged } from "@/components/common/TablePager";
import { ALL_TYPES, CompanyDocumentsPanel, countBy, TypeChips } from "@/components/docs/CompanyDocuments";
import {
  EditDocumentDialog,
  UploadDocumentDialog,
  VerifyDocumentDialog,
} from "@/components/docs/DocumentDialogs";
import type { PickedEmployee } from "@/components/people/EmployeePicker";
import { apiMessage } from "@/components/people/labels";
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
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del, downloadFile } from "@/lib/api";
import type { DocumentCategoryOption, DocumentVerification, VaultDocument } from "@/lib/types/docs";
import { formatDay } from "@/lib/utils";

type Mode = "employee" | "dependant";

const VERIFICATION: Record<
  Exclude<DocumentVerification, "not_required">,
  { label: string; variant: "warning" | "success" | "destructive" }
> = {
  pending: { label: "Waiting for HR", variant: "warning" },
  verified: { label: "Verified", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

const COPY: Record<Mode, { title: string; add: string; emptyTitle: string; emptyText: string }> = {
  employee: {
    title: "Employee documents",
    add: "Add document",
    emptyTitle: "No employee documents yet",
    emptyText: "Add PAN, Aadhaar, certificates and relieving letters with their numbers and dates.",
  },
  dependant: {
    title: "Dependant documents",
    add: "Add dependant document",
    emptyTitle: "No dependant documents yet",
    emptyText:
      "Birth certificates, Aadhaar and insurance cards of the family members listed on a profile — for medical cover and nominations.",
  },
};

/** One of the vault's two halves: the employee's own documents, or their dependants'. */
function VaultSection({
  mode,
  documents,
  isLoading,
  error,
  reload,
  employee,
  categories,
}: {
  mode: Mode;
  documents: VaultDocument[];
  isLoading: boolean;
  error: string | undefined;
  reload: () => void;
  employee: PickedEmployee | null;
  categories: DocumentCategoryOption[];
}) {
  const { user, hasRole } = useAuth();
  const isHr = hasRole("tenant_admin", "hr_admin", "hr_ops");
  const [category, setCategory] = useState(ALL_TYPES);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<VaultDocument | null>(null);
  const [deleting, setDeleting] = useState<VaultDocument | null>(null);
  const [verifying, setVerifying] = useState<{ document: VaultDocument; decision: "verified" | "rejected" } | null>(
    null,
  );

  const copy = COPY[mode];
  const labels = new Map(categories.map((option) => [option.value as string, option.label]));
  const labelOf = (value: string) => labels.get(value) ?? value;
  const all = documents.filter((doc) => (mode === "dependant") === Boolean(doc.dependant_name));
  const counts = countBy(all, (doc) => labelOf(doc.category));
  const needle = query.trim().toLowerCase();
  const rows = all.filter(
    (doc) =>
      (category === ALL_TYPES || labelOf(doc.category) === category) &&
      (!needle ||
        [doc.title, doc.document_number ?? "", doc.employee_name, doc.employee_code, doc.dependant_name ?? "", doc.remark ?? ""]
          .some((value) => value.toLowerCase().includes(needle))),
  );
  const paged = usePaged(rows);
  const showEmployee = !employee;

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
        title={copy.title}
        description={
          employee
            ? mode === "employee"
              ? `${employee.label}'s own documents.`
              : `Documents of ${employee.label}'s family members.`
            : mode === "employee"
              ? "Every employee's documents. Pick someone above to see only theirs."
              : "Documents of employees' family members."
        }
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon-sm" aria-label={`Refresh ${copy.title.toLowerCase()}`} onClick={reload}>
              <RefreshCw />
            </Button>
            {isHr && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus /> {copy.add}
              </Button>
            )}
          </div>
        }
        toolbar={
          all.length > 0 ? (
            <div className="flex w-full flex-col gap-3">
              <IconInput
                icon={Search}
                aria-label={`Search ${copy.title.toLowerCase()}`}
                placeholder={showEmployee ? "Search document, number or employee" : "Search document or number"}
                className="w-full sm:w-80"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <TypeChips counts={counts} value={category} onChange={setCategory} total={all.length} />
            </div>
          ) : undefined
        }
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: mode === "employee" ? FileText : Users,
          title: all.length === 0 ? copy.emptyTitle : "Nothing matches",
          description: all.length === 0 ? copy.emptyText : "Try another category or search.",
        }}
        footer={rows.length > 0 ? <TablePager paged={paged} /> : undefined}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 pl-6">Sr. no.</TableHead>
              <TableHead>Document type</TableHead>
              <TableHead>Document no.</TableHead>
              {mode === "dependant" && <TableHead>Dependant</TableHead>}
              {showEmployee && <TableHead>Employee</TableHead>}
              <TableHead>Issued</TableHead>
              <TableHead>Expiry date</TableHead>
              <TableHead>Remark</TableHead>
              <TableHead className="pr-6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.rows.map((doc, index) => {
              const own = doc.employee_id === user?.employee_id;
              const state = doc.verification_status === "not_required" ? null : VERIFICATION[doc.verification_status];
              return (
                <TableRow key={doc.id}>
                  <TableCell className="pl-6 tabular-nums text-muted-foreground">{paged.offset + index + 1}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{doc.title}</span>
                      {state && <Badge variant={state.variant}>{state.label}</Badge>}
                      {isHr && !doc.is_employee_visible && (
                        <Badge variant="muted">
                          <EyeOff /> HR only
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{labelOf(doc.category)}</p>
                    {doc.verification_status === "rejected" && doc.verification_note && (
                      <p className="mt-0.5 text-xs text-destructive">{doc.verification_note}</p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{doc.document_number ?? "—"}</TableCell>
                  {mode === "dependant" && <TableCell>{doc.dependant_name}</TableCell>}
                  {showEmployee && (
                    <TableCell>
                      <p>{doc.employee_name}</p>
                      <p className="text-xs text-muted-foreground">{doc.employee_code}</p>
                    </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap">
                    {doc.issued_on ? formatDay(doc.issued_on, true) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {doc.valid_until ? (
                      <span className="flex items-center gap-2">
                        {formatDay(doc.valid_until, true)}
                        {doc.is_expired && <Badge variant="destructive">Expired</Badge>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-56 whitespace-normal text-sm text-muted-foreground">
                    {doc.remark ?? "—"}
                  </TableCell>
                  <TableCell className="pr-6">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Download ${doc.title}`}
                        onClick={() => void download(doc)}
                      >
                        <Download />
                      </Button>
                      {isHr && !own && doc.verification_status === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Verify ${doc.title}`}
                            onClick={() => setVerifying({ document: doc, decision: "verified" })}
                          >
                            <BadgeCheck />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            aria-label={`Reject ${doc.title}`}
                            onClick={() => setVerifying({ document: doc, decision: "rejected" })}
                          >
                            <ShieldX />
                          </Button>
                        </>
                      )}
                      {isHr && !own && (
                        <>
                          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${doc.title}`} onClick={() => setEditing(doc)}>
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            aria-label={`Delete ${doc.title}`}
                            onClick={() => setDeleting(doc)}
                          >
                            <Trash2 />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataPanel>

      {isHr && (
        <UploadDocumentDialog
          open={adding}
          onOpenChange={setAdding}
          categories={categories}
          employee={employee}
          forDependant={mode === "dependant"}
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
        categories={categories}
        onSaved={reload}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this document?"
        description={
          deleting
            ? `"${deleting.title}" will be removed from ${deleting.employee_name}'s record. The audit log keeps a record that it existed.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
      />
    </>
  );
}

/**
 * Document entry the way HR files paperwork: the employee's own documents,
 * their dependants' documents, and the company's policies — each with its
 * type filters, numbers, dates and remarks.
 */
export function DocumentEntrySections({
  employee,
  withCompany = true,
}: {
  employee: PickedEmployee | null;
  /** Include the company's own documents (not on a single joiner's plan). */
  withCompany?: boolean;
}) {
  const categories = useApiQuery<DocumentCategoryOption[]>("/documents/categories");
  const vault = useApiQuery<VaultDocument[]>(
    employee ? `/documents?employee_id=${employee.id}` : "/documents",
  );
  const shared = {
    documents: vault.data ?? [],
    isLoading: vault.isLoading && !vault.data,
    error: vault.error?.detail,
    reload: vault.reload,
    employee,
    categories: categories.data ?? [],
  };
  return (
    <>
      <VaultSection mode="employee" {...shared} />
      <VaultSection mode="dependant" {...shared} />
      {withCompany && <CompanyDocumentsPanel />}
    </>
  );
}
