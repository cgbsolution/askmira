"use client";

import { Loader2, Plus, UserSearch, Wallet } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { apiErrorMessage, InlineProblem } from "@/components/payroll-ops/shared";
import { QueryPanel } from "@/components/payroll-ops/disbursements/common";
import { EmployeePicker } from "@/components/payroll-ops/disbursements/EmployeePicker";
import {
  employeeDisplayName,
  formatTimestamp,
  IFSC_PATTERN,
  VERIFICATION_LABEL,
} from "@/components/payroll-ops/disbursements/labels";
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
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type {
  BankAccountInput,
  EmployeeBankAccount,
  VerificationMethod,
} from "@/lib/types/payroll-ops";

/**
 * One employee's salary accounts. Deliberately per employee: a list of every
 * employee's bank details is not something to put on a screen by default.
 */
export function EmployeeAccountsTab({ initialSearch }: { initialSearch: string }) {
  const { hasRole } = useAuth();
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [open, setOpen] = useState(false);
  const query = useApiQuery<EmployeeBankAccount[]>(
    employee ? `/disbursement/bank-accounts?employee_id=${encodeURIComponent(employee.id)}` : null,
  );

  useEffect(() => {
    if (initialSearch) setEmployee(null);
  }, [initialSearch]);

  const canAdd = hasRole("admin", "sub_admin");

  return (
    <>
      <QueryPanel
        query={query}
        loadingRows={2}
        title="Employee bank accounts"
        description="Where each person's salary is credited. Account numbers are write-only and never shown back; correct a wrong one by adding the right account."
        toolbar={
          <div className="flex w-full flex-wrap items-end gap-3">
            <FormField htmlFor="accounts-employee" label="Employee" className="w-full max-w-md">
              <EmployeePicker
                id="accounts-employee"
                value={employee}
                onChange={setEmployee}
                initialSearch={initialSearch}
              />
            </FormField>
            {employee && canAdd && (
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus /> Add account
              </Button>
            )}
          </div>
        }
        idle={{
          icon: UserSearch,
          title: "Choose an employee",
          description: "Search by name or employee code to see and add their salary accounts.",
        }}
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: Wallet,
          title: employee
            ? `No bank account for ${employeeDisplayName(employee)}`
            : "No bank account",
          description:
            "Without one, this person blocks the salary file. Add their account to clear it.",
        }}
      >
        {(rows) => (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account holder</TableHead>
                      <TableHead>IFSC</TableHead>
                      <TableHead className="hidden md:table-cell">Bank</TableHead>
                      <TableHead>Verification</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-foreground">
                          {row.account_holder_name}
                        </TableCell>
                        <TableCell className="tabular-nums">{row.ifsc}</TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {row.bank_name ?? "—"}
                        </TableCell>
                        <TableCell>
                          <span>{VERIFICATION_LABEL[row.verification_method]}</span>
                          {row.verified_at && (
                            <span className="block text-xs text-muted-foreground">
                              {formatTimestamp(row.verified_at)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.is_primary && <Badge variant="secondary">Primary</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
        )}
      </QueryPanel>
      {employee && (
        <AddAccountDialog
          open={open}
          onOpenChange={setOpen}
          employee={employee}
          onCreated={query.reload}
        />
      )}
    </>
  );
}

function AddAccountDialog({
  open,
  onOpenChange,
  employee,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeSummary;
  onCreated: () => void;
}) {
  const [account, setAccount] = useState("");
  const [confirmAccount, setConfirmAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [holder, setHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [method, setMethod] = useState<VerificationMethod>("manual");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const reset = () => {
    setAccount("");
    setConfirmAccount("");
    setIfsc("");
    setHolder("");
    setBankName("");
    setMethod("manual");
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!account.trim() || !ifsc.trim() || !holder.trim()) {
      setError("Account number, IFSC and account holder name are required.");
      return;
    }
    if (!/^\d{6,18}$/.test(account.trim())) {
      setError("An account number is 6 to 18 digits.");
      return;
    }
    if (account.trim() !== confirmAccount.trim()) {
      setError("The two account numbers do not match.");
      return;
    }
    if (!IFSC_PATTERN.test(ifsc.trim().toUpperCase())) {
      setError("An IFSC is 11 characters: 4 letters, a zero, then 6 letters or digits.");
      return;
    }
    const body: BankAccountInput = {
      employee_id: employee.id,
      account_number: account.trim(),
      ifsc: ifsc.trim().toUpperCase(),
      account_holder_name: holder.trim(),
      bank_name: bankName.trim() || null,
      verification_method: method,
    };
    setIsBusy(true);
    try {
      await post<EmployeeBankAccount>("/disbursement/bank-accounts", body);
      toast.success("Bank account added");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The bank account could not be saved."));
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
          <DialogTitle>Add a bank account</DialogTitle>
          <DialogDescription>
            For {employeeDisplayName(employee)} ({employee.employee_code}). The account number cannot
            be read back after saving, so it is typed twice.
          </DialogDescription>
        </DialogHeader>
        <form id="account-form" className="grid gap-4" onSubmit={(event) => void submit(event)} noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField htmlFor="account-number" label="Account number">
              <Input
                id="account-number"
                required
                inputMode="numeric"
                autoComplete="off"
                maxLength={18}
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                className="tabular-nums"
              />
            </FormField>
            <FormField htmlFor="account-number-confirm" label="Account number again">
              <Input
                id="account-number-confirm"
                required
                inputMode="numeric"
                autoComplete="off"
                maxLength={18}
                value={confirmAccount}
                onPaste={(event) => event.preventDefault()}
                onChange={(event) => setConfirmAccount(event.target.value)}
                className="tabular-nums"
              />
            </FormField>
            <FormField htmlFor="account-ifsc" label="IFSC">
              <Input
                id="account-ifsc"
                required
                autoComplete="off"
                maxLength={11}
                value={ifsc}
                onChange={(event) => setIfsc(event.target.value.toUpperCase())}
                className="tabular-nums"
              />
            </FormField>
            <FormField htmlFor="account-bank" label="Bank name" optional>
              <Input
                id="account-bank"
                maxLength={120}
                value={bankName}
                onChange={(event) => setBankName(event.target.value)}
              />
            </FormField>
          </div>
          <FormField htmlFor="account-holder" label="Account holder name, as the bank has it">
            <Input
              id="account-holder"
              required
              maxLength={140}
              value={holder}
              onChange={(event) => setHolder(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="account-verification" label="Verification">
            <Select value={method} onValueChange={(value) => setMethod(value as VerificationMethod)}>
              <SelectTrigger id="account-verification" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(VERIFICATION_LABEL) as VerificationMethod[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {VERIFICATION_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Record how the account was actually checked. No penny-drop service is connected from
              this screen.
            </p>
          </FormField>
          {error && <InlineProblem>{error}</InlineProblem>}
        </form>
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="account-form" disabled={isBusy}>
            {isBusy && <Loader2 className="animate-spin" />}
            Save account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
