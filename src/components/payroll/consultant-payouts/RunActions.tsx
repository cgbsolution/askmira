"use client";

import {
  FileText,
  IndianRupee,
  Loader2,
  Lock,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { apiMessage } from "@/components/payroll/labels";
import { FORMAT_LABEL } from "@/components/payroll-ops/disbursements/labels";
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
import { ApiError, del, get, post } from "@/lib/api";
import type { PayoutRun } from "@/lib/types/consultant-payouts";
import type { BankProfile, DisbursementBatch } from "@/lib/types/payroll-ops";
import { toISODate, todayISO } from "@/lib/utils";

type Dialogs = "approve" | "paid" | "delete" | "bank" | null;

/** Pay the run through a bank file: only an approved run, and one file per run. */
function BankFileDialog({
  run,
  open,
  onOpenChange,
}: {
  run: PayoutRun;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [profiles, setProfiles] = useState<BankProfile[] | null>(null);
  const [profileId, setProfileId] = useState("");
  const [valueDate, setValueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [seeded, setSeeded] = useState(false);

  if (open && !seeded) {
    setSeeded(true);
    setDone(false);
    setError(null);
    setValueDate(run.pay_date >= todayISO() ? run.pay_date : "");
    get<BankProfile[]>("/disbursement/bank-profiles")
      .then((rows) => {
        const usable = rows.filter(
          (row) =>
            row.active &&
            (!run.legal_entity_id ||
              row.legal_entity_id === run.legal_entity_id),
        );
        setProfiles(usable);
        if (usable.length === 1) setProfileId(usable[0].id);
      })
      .catch((caught) =>
        setError(apiMessage(caught, "Could not load the bank profiles.")),
      );
  }
  if (!open && seeded) setSeeded(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profileId || !valueDate)
      return setError("Choose a bank profile and the value date.");
    setError(null);
    setIsBusy(true);
    try {
      await post<DisbursementBatch>(`/consultant-payouts/${run.id}/bank-file`, {
        bank_profile_id: profileId,
        value_date: valueDate,
      });
      toast.success("Bank file prepared and waiting for approval.");
      setDone(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError &&
          caught.status === 422 &&
          caught.detail.startsWith("Request failed")
          ? "The bank file was blocked by validation. Open Bank files to see what to fix, then try again."
          : apiMessage(caught, "The bank file could not be prepared."),
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Prepare the bank file</DialogTitle>
            <DialogDescription>
              Pays this run&apos;s consultants. Someone other than you approves
              the file on Bank files before it goes to the bank.
            </DialogDescription>
          </DialogHeader>
          {done ? (
            <p className="text-sm text-foreground">
              The file is ready.{" "}
              <Link
                href="/payroll/disbursements"
                className="font-medium underline underline-offset-2"
              >
                Open Bank files
              </Link>{" "}
              to approve and download it.
            </p>
          ) : (
            <>
              <FormField htmlFor="payout-bank-profile" label="Bank profile">
                {profiles !== null && profiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active bank profile for this company. Add one on Bank
                    files.
                  </p>
                ) : (
                  <Select value={profileId} onValueChange={setProfileId}>
                    <SelectTrigger id="payout-bank-profile" className="w-full">
                      <SelectValue placeholder="Choose a bank profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {(profiles ?? []).map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.bank_name} ·{" "}
                          {FORMAT_LABEL[profile.file_format] ??
                            profile.file_format}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              <FormField
                htmlFor="payout-value-date"
                label="Value date"
                hint="The date the bank should credit the payments."
              >
                <DatePicker
                  id="payout-value-date"
                  required
                  min={toISODate(new Date())}
                  value={valueDate}
                  onChange={setValueDate}
                />
              </FormField>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => onOpenChange(false)}
            >
              {done ? "Close" : "Cancel"}
            </Button>
            {!done && (
              <Button type="submit" disabled={isBusy || profiles?.length === 0}>
                {isBusy && <Loader2 className="animate-spin" />}
                Prepare file
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The lifecycle buttons for a payout run, each shown only when the step is
 * possible. The API enforces every rule again and its refusal (stale figures,
 * held lines, who may approve) is shown in its own words.
 */
export function RunActions({
  run,
  onChanged,
  onDeleted,
}: {
  run: PayoutRun;
  onChanged: (run: PayoutRun) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [paidOn, setPaidOn] = useState(todayISO());
  const [reference, setReference] = useState("");
  const draft = run.status === "draft";

  const call = async (path: string, body: unknown, success: string) => {
    try {
      const updated = await post<PayoutRun>(
        `/consultant-payouts/${run.id}/${path}`,
        body,
      );
      toast.success(success);
      onChanged(updated);
    } catch (caught) {
      toast.error(apiMessage(caught, "That step could not be completed."));
      throw caught;
    }
  };

  const recalculate = async () => {
    setBusy(true);
    try {
      await call("recalculate", undefined, "Figures recalculated.");
    } catch {
      // Already shown as a toast.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {draft && (
        <>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void recalculate()}
          >
            {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Recalculate
          </Button>
          <Button onClick={() => setDialog("approve")}>
            <Lock /> Approve &amp; lock
          </Button>
          <Button variant="outline" onClick={() => setDialog("delete")}>
            <Trash2 /> Delete run
          </Button>
        </>
      )}
      {run.status === "approved" && (
        <>
          <Button onClick={() => setDialog("bank")}>
            <FileText /> Prepare bank file
          </Button>
          <Button variant="outline" onClick={() => setDialog("paid")}>
            <IndianRupee /> Mark paid
          </Button>
        </>
      )}

      <ConfirmDialog
        open={dialog === "approve"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Approve and lock this payout run?"
        description={
          <>
            {run.totals.lines_included} consultant(s), net pay{" "}
            <Money value={run.totals.net_payable} />. Once locked the run cannot
            be recalculated or deleted. You will be asked to confirm it is you.
            Someone other than whoever drafted the run approves it, and held
            lines must be fixed or left out first.
          </>
        }
        confirmLabel="Approve & lock"
        onConfirm={() => call("approve", undefined, "Run approved and locked.")}
      />
      <ConfirmDialog
        open={dialog === "paid"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Mark this run paid?"
        description="Record that the money has moved. Once paid, no bank file can be made for this run."
        confirmLabel="Mark paid"
        onConfirm={async () => {
          if (!paidOn || !reference.trim()) {
            toast.error("Enter the date paid and the bank reference.");
            throw new Error("missing");
          }
          await call(
            "paid",
            { paid_on: paidOn, reference: reference.trim() },
            "Run marked paid.",
          );
        }}
      >
        <FormField htmlFor="payout-paid-on" label="Date paid">
          <DatePicker
            id="payout-paid-on"
            required
            value={paidOn}
            onChange={setPaidOn}
          />
        </FormField>
        <FormField
          htmlFor="payout-reference"
          label="Bank reference"
          hint="For example the UTR or batch number."
        >
          <Input
            id="payout-reference"
            value={reference}
            maxLength={200}
            onChange={(event) => setReference(event.target.value)}
          />
        </FormField>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Delete this payout run?"
        description="Nothing on it has been paid. Its hours entries are free for a later run. The audit log keeps a record."
        confirmLabel="Delete run"
        cancelLabel="Keep run"
        destructive
        onConfirm={async () => {
          try {
            await del(`/consultant-payouts/${run.id}`);
          } catch (caught) {
            toast.error(apiMessage(caught, "The run could not be deleted."));
            throw caught;
          }
          toast.success("The run was deleted.");
          onDeleted();
        }}
      />
      <BankFileDialog
        run={run}
        open={dialog === "bank"}
        onOpenChange={(open) => !open && setDialog(null)}
      />
    </div>
  );
}
