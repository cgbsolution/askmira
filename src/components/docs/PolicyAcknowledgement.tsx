"use client";

import { CheckCircle2, Loader2, PenLine } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { apiMessage } from "@/components/people/labels";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { downloadFile, post } from "@/lib/api";
import type { AcknowledgementRegister, CompanyDocument } from "@/lib/types/docs";
import { formatDate } from "@/lib/utils";

/** The employee reads the policy, then acknowledges it by typing their own name. */
export function AcknowledgePolicyDialog({
  document,
  onClose,
  onDone,
}: {
  document: CompanyDocument | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [typed, setTyped] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!document) return;
    if (typed.trim().length < 2) return setError("Type your full name.");
    setIsSaving(true);
    setError(null);
    try {
      await post(`/documents/company/${document.id}/acknowledge`, { typed_name: typed.trim() });
      toast.success(`You acknowledged "${document.title}".`);
      setTyped("");
      onDone();
      onClose();
    } catch (caught) {
      setError(apiMessage(caught, "The acknowledgement could not be recorded."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={document !== null} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Acknowledge {document?.title}</DialogTitle>
            <DialogDescription>
              Read the document first. By typing your name you confirm you have read it and will
              follow it. The record keeps the exact file you acknowledged.
            </DialogDescription>
          </DialogHeader>
          {document && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void downloadFile(`/documents/company/${document.id}/download`, document.title)
              }
            >
              Open the document
            </Button>
          )}
          <FormField
            htmlFor="ack-name"
            label="Type your full name"
            hint={user?.full_name ? `As on your record: ${user.full_name}` : undefined}
            error={error}
          >
            <Input
              id="ack-name"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : <PenLine />}
              Acknowledge
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** HR: who has acknowledged the current version of a policy, and who has not. */
export function AcknowledgementRegisterSheet({
  document,
  onClose,
}: {
  document: CompanyDocument | null;
  onClose: () => void;
}) {
  const query = useApiQuery<AcknowledgementRegister>(
    document ? `/documents/company/${document.id}/acknowledgements` : null,
  );
  const data = query.data;
  return (
    <Sheet open={document !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="pr-10">
          <SheetTitle>Acknowledgements — {document?.title}</SheetTitle>
          <SheetDescription>
            {data
              ? `${data.acknowledged} acknowledged, ${data.pending} still to acknowledge the current file.`
              : "Loading…"}
          </SheetDescription>
        </SheetHeader>
        {data && (
          <div className="px-4 pb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Typed name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.employee_id}>
                    <TableCell>
                      <span className="font-medium text-foreground">{row.employee_name}</span>
                      <span className="block text-xs text-muted-foreground">{row.employee_code}</span>
                    </TableCell>
                    <TableCell>
                      {row.acknowledged_at ? (
                        <Badge variant="success">
                          <CheckCircle2 /> {formatDate(row.acknowledged_at)}
                        </Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.typed_name ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
