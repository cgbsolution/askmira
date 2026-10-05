"use client";

import { Landmark, Loader2, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { RequireRole } from "@/components/common/RequireRole";
import { apiErrorMessage, InlineProblem } from "@/components/payroll-ops/shared";
import { QueryPanel, useEntityName } from "@/components/payroll-ops/disbursements/common";
import { FORMAT_LABEL, IFSC_PATTERN } from "@/components/payroll-ops/disbursements/labels";
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
import { type ApiError, post } from "@/lib/api";
import type {
  BankFileFormat,
  BankProfile,
  BankProfileInput,
  LegalEntity,
} from "@/lib/types/payroll-ops";

/** The company's debit accounts, one per bank file format. Account numbers are never shown back. */
export function BankProfilesTab({
  query,
  entities,
}: {
  query: {
    data: BankProfile[] | null;
    error: ApiError | null;
    isLoading: boolean;
    reload: () => void;
  };
  entities: LegalEntity[];
}) {
  const [open, setOpen] = useState(false);
  const entityName = useEntityName(entities);

  return (
    <>
      <QueryPanel
        query={query}
        loadingRows={3}
        title="Bank profiles"
        description="The account salaries are paid from, and the file format that bank expects. The account number is stored when you save it and is never displayed again."
        actions={
          <RequireRole roles={["admin"]}>
            <Button size="sm" onClick={() => setOpen(true)} disabled={entities.length === 0}>
              <Plus /> Add bank profile
            </Button>
          </RequireRole>
        }
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: Landmark,
          title: "No bank profile yet",
          description:
            "A batch needs a bank profile to know which account pays and which file format to build. An admin adds one here.",
        }}
      >
        {(rows) => (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank</TableHead>
                    <TableHead>IFSC</TableHead>
                    <TableHead>File format</TableHead>
                    <TableHead className="hidden md:table-cell">Corporate ID</TableHead>
                    <TableHead className="hidden md:table-cell">Entity</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-foreground">{row.bank_name}</TableCell>
                      <TableCell className="tabular-nums">{row.ifsc}</TableCell>
                      <TableCell>{FORMAT_LABEL[row.file_format] ?? row.file_format}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {row.corporate_id ?? "—"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {entityName(row.legal_entity_id)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.active ? "success" : "muted"}>
                          {row.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
        )}
      </QueryPanel>
      <AddProfileDialog
        open={open}
        onOpenChange={setOpen}
        entities={entities}
        onCreated={query.reload}
      />
    </>
  );
}

function AddProfileDialog({
  open,
  onOpenChange,
  entities,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: LegalEntity[];
  onCreated: () => void;
}) {
  const [entityId, setEntityId] = useState(entities.length === 1 ? entities[0].id : "");
  const [bankName, setBankName] = useState("");
  const [account, setAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [corporateId, setCorporateId] = useState("");
  const [format, setFormat] = useState<BankFileFormat | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const reset = () => {
    setBankName("");
    setAccount("");
    setIfsc("");
    setCorporateId("");
    setFormat("");
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!entityId || !bankName.trim() || !account.trim() || !ifsc.trim() || !format) {
      setError("Legal entity, bank name, account number, IFSC and file format are required.");
      return;
    }
    if (!/^\d{6,18}$/.test(account.trim())) {
      setError("An account number is 6 to 18 digits.");
      return;
    }
    if (!IFSC_PATTERN.test(ifsc.trim().toUpperCase())) {
      setError("An IFSC is 11 characters: 4 letters, a zero, then 6 letters or digits.");
      return;
    }
    const body: BankProfileInput = {
      legal_entity_id: entityId,
      bank_name: bankName.trim(),
      account_number: account.trim(),
      ifsc: ifsc.trim().toUpperCase(),
      corporate_id: corporateId.trim() || null,
      file_format: format,
    };
    setIsBusy(true);
    try {
      await post<BankProfile>("/disbursement/bank-profiles", body);
      toast.success("Bank profile added");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The bank profile could not be saved."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isBusy) return;
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a bank profile</DialogTitle>
          <DialogDescription>
            The account number is write-only: once saved, nobody can read it back on screen.
          </DialogDescription>
        </DialogHeader>
        <form id="profile-form" className="grid gap-4" onSubmit={(event) => void submit(event)} noValidate>
          <FormField htmlFor="profile-entity" label="Legal entity">
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger id="profile-entity" className="w-full">
                <SelectValue placeholder="Choose an entity" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField htmlFor="profile-bank" label="Bank name">
              <Input
                id="profile-bank"
                required
                maxLength={120}
                value={bankName}
                onChange={(event) => setBankName(event.target.value)}
              />
            </FormField>
            <FormField htmlFor="profile-format" label="File format">
              <Select value={format} onValueChange={(value) => setFormat(value as BankFileFormat)}>
                <SelectTrigger id="profile-format" className="w-full">
                  <SelectValue placeholder="Choose a format" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FORMAT_LABEL) as BankFileFormat[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {FORMAT_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="profile-account" label="Debit account number">
              <Input
                id="profile-account"
                required
                inputMode="numeric"
                autoComplete="off"
                maxLength={18}
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                className="tabular-nums"
              />
            </FormField>
            <FormField htmlFor="profile-ifsc" label="IFSC">
              <Input
                id="profile-ifsc"
                required
                autoComplete="off"
                maxLength={11}
                value={ifsc}
                onChange={(event) => setIfsc(event.target.value.toUpperCase())}
                className="tabular-nums"
              />
            </FormField>
          </div>
          <FormField htmlFor="profile-corporate" label="Corporate ID" optional>
            <Input
              id="profile-corporate"
              maxLength={60}
              value={corporateId}
              onChange={(event) => setCorporateId(event.target.value)}
            />
          </FormField>
          {error && <InlineProblem>{error}</InlineProblem>}
        </form>
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="profile-form" disabled={isBusy}>
            {isBusy && <Loader2 className="animate-spin" />}
            Save bank profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
