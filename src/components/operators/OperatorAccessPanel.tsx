"use client";

import { Building2, Loader2, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface Grant {
  id: string;
  operator_email: string;
  operator_firm: string;
  scopes: string[];
  note: string | null;
  expires_at: string;
  revoked_at: string | null;
  last_entered_at: string | null;
  is_live: boolean;
}

/**
 * Settings → Company → Operators (PAY-09).
 *
 * Lets a payroll bureau work on this workspace's payroll: one named person at
 * the firm, until a date. They can run payroll and read the employee, leave and
 * attendance records it needs; nothing else. Every action they take is in the
 * audit trail marked as an operator's. Revoking ends their access at once.
 */
export function OperatorAccessPanel() {
  const { data, error, isLoading, reload } = useApiQuery<Grant[]>("/admin/operators");
  const [open, setOpen] = useState(false);
  const [workspace, setWorkspace] = useState("");
  const [email, setEmail] = useState("");
  const [expires, setExpires] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const grant = async () => {
    setSaving(true);
    try {
      await post("/admin/operators", {
        operator_workspace: workspace.trim(),
        operator_email: email.trim(),
        expires_on: expires,
        note: note.trim() || null,
      });
      toast.success("Access granted.");
      setOpen(false);
      setWorkspace("");
      setEmail("");
      setExpires("");
      setNote("");
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not grant access.");
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (row: Grant) => {
    try {
      await post(`/admin/operators/${row.id}/revoke`);
      toast.success(`Access for ${row.operator_email} ended.`);
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not revoke.");
    }
  };

  return (
    <>
      <DataPanel
        title="Payroll operators"
        description="People at a payroll bureau who may run this workspace's payroll. They read employee, leave and attendance records, and nothing outside payroll."
        isLoading={isLoading}
        error={error?.detail}
        onRetry={reload}
        isEmpty={(data ?? []).length === 0}
        empty={{
          icon: Building2,
          title: "No operators",
          description: "Your own team runs payroll. Grant a bureau access here if one does it for you.",
        }}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus /> Grant access
          </Button>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operator</TableHead>
              <TableHead>Until</TableHead>
              <TableHead>Last in</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((row) => (
              <TableRow key={row.id} className={row.is_live ? undefined : "opacity-60"}>
                <TableCell>
                  <p className="font-medium">{row.operator_email}</p>
                  <p className="text-xs text-muted-foreground">{row.operator_firm}</p>
                </TableCell>
                <TableCell>{formatDate(row.expires_at)}</TableCell>
                <TableCell>{row.last_entered_at ? formatDate(row.last_entered_at) : "Never"}</TableCell>
                <TableCell className="text-right">
                  {row.is_live ? (
                    <Button size="sm" variant="outline" onClick={() => void revoke(row)}>
                      Revoke
                    </Button>
                  ) : (
                    <Badge variant="muted">{row.revoked_at ? "Revoked" : "Ended"}</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant payroll access</DialogTitle>
            <DialogDescription>
              The operator must be an admin in their own firm&apos;s AskMira workspace. You will be asked to
              confirm it is you.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField
              label="Their workspace address"
              htmlFor="op-workspace"
              hint="What their sign-in page shows, for example acme-payroll."
            >
              <Input id="op-workspace" value={workspace} onChange={(e) => setWorkspace(e.target.value)} />
            </FormField>
            <FormField label="Their sign-in email" htmlFor="op-email">
              <Input id="op-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormField>
            <FormField label="Access ends on" htmlFor="op-expires" hint="At most a year from today.">
              <DatePicker id="op-expires" value={expires} onChange={setExpires} />
            </FormField>
            <FormField label="Note" htmlFor="op-note" optional>
              <Textarea id="op-note" rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={grant} disabled={saving || !workspace.trim() || !email.trim() || !expires}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Grant access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
