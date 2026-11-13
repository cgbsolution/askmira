"use client";

import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Send,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { apiMessage, isImported } from "@/components/payroll/labels";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApiQuery } from "@/hooks/useApiQuery";
import { downloadFile, post } from "@/lib/api";
import type { PayrollRun } from "@/lib/types/payroll";

const FORMATS = [
  { key: "tally", label: "Tally (XML voucher)", file: "payroll-journal.xml" },
  {
    key: "zoho",
    label: "Zoho Books (journal CSV)",
    file: "payroll-journal.csv",
  },
  { key: "csv", label: "Generic journal CSV", file: "payroll-journal.csv" },
];

interface FinancePosting {
  linked: boolean;
  posted: boolean;
  journal_number?: string | null;
  journal_id?: string;
  created_accounts?: string[];
}

interface ZohoPosting {
  connected: boolean;
  posted: boolean;
  organisation?: string | null;
  journal_number?: string | null;
  journal_id?: string;
  posted_at?: string;
}

/** Post an approved run to the books: a balanced journal in Tally, Zoho or plain CSV. */
export function JournalExportMenu({ run }: { run: PayrollRun }) {
  const [byDepartment, setByDepartment] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmPost, setConfirmPost] = useState(false);
  const [confirmFinance, setConfirmFinance] = useState(false);
  const postable =
    (run.status === "approved" || run.status === "paid") && !isImported(run);
  const zoho = useApiQuery<ZohoPosting>(
    postable ? `/payroll/runs/${run.id}/journal/zoho-books` : null,
  );

  const finance = useApiQuery<FinancePosting>(
    postable ? `/payroll/runs/${run.id}/journal/finance` : null,
  );

  if (!postable) return null;

  const download = async (key: string, file: string) => {
    setBusy(key);
    try {
      await downloadFile(
        `/payroll/runs/${run.id}/journal?format=${key}&by_department=${byDepartment}`,
        file,
      );
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not export the journal."));
    } finally {
      setBusy(null);
    }
  };

  const postToZoho = async () => {
    setBusy("zoho-books");
    try {
      const result = await post<ZohoPosting>(
        `/payroll/runs/${run.id}/journal/zoho-books?by_department=${byDepartment}`,
      );
      toast.success(
        `Posted to Zoho Books as journal ${result.journal_number ?? result.journal_id}`,
      );
      zoho.reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not post to Zoho Books."));
      zoho.reload();
      throw caught;
    } finally {
      setBusy(null);
    }
  };

  const postToFinance = async () => {
    setBusy("finance");
    try {
      const result = await post<FinancePosting>(
        `/payroll/runs/${run.id}/journal/finance?by_department=${byDepartment}`,
      );
      const added = result.created_accounts?.length
        ? ` Added there: ${result.created_accounts.join(", ")}.`
        : "";
      toast.success(
        `Posted to Finance as journal ${result.journal_number ?? result.journal_id}.${added}`,
      );
      finance.reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not post to Finance."));
      finance.reload();
      throw caught;
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={busy !== null}>
            {busy ? <Loader2 className="animate-spin" /> : <BookOpen />}
            Journal
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Export to the books</DropdownMenuLabel>
          {FORMATS.map((format) => (
            <DropdownMenuItem
              key={format.key}
              onSelect={() => void download(format.key, format.file)}
            >
              {format.label}
            </DropdownMenuItem>
          ))}
          {finance.data?.linked && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Post into Finance</DropdownMenuLabel>
              {finance.data.posted ? (
                <DropdownMenuItem disabled>
                  <CheckCircle2 /> In Finance as{" "}
                  {finance.data.journal_number ?? finance.data.journal_id}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setConfirmFinance(true)}>
                  <Send /> Post to Finance
                </DropdownMenuItem>
              )}
            </>
          )}
          {zoho.data?.connected && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>
                Post straight into the books
              </DropdownMenuLabel>
              {zoho.data.posted ? (
                <DropdownMenuItem disabled>
                  <CheckCircle2 /> In Zoho Books as{" "}
                  {zoho.data.journal_number ?? zoho.data.journal_id}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setConfirmPost(true)}>
                  <Send /> Post to Zoho Books
                </DropdownMenuItem>
              )}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={byDepartment}
            onCheckedChange={(checked) => setByDepartment(checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            Split by department (cost centres)
          </DropdownMenuCheckboxItem>
          <DropdownMenuItem asChild>
            <Link href={`/payroll/accounting?run=${run.id}`}>Map ledgers…</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmPost}
        onOpenChange={setConfirmPost}
        title="Post this run to Zoho Books?"
        description={`The journal for ${String(run.period_month).padStart(2, "0")}/${run.period_year} is posted to ${
          zoho.data?.organisation ?? "your Zoho Books organisation"
        }${byDepartment ? ", split by department" : ""}. A run is posted only once.`}
        confirmLabel="Post journal"
        onConfirm={postToZoho}
      />
      <ConfirmDialog
        open={confirmFinance}
        onOpenChange={setConfirmFinance}
        title="Post this run to Finance?"
        description={`The journal for ${String(run.period_month).padStart(2, "0")}/${run.period_year} is booked in Finance as a published journal${
          byDepartment ? ", split by department" : ""
        }. A ledger Finance does not have is added there. A run is posted only once.`}
        confirmLabel="Post journal"
        onConfirm={postToFinance}
      />
    </>
  );
}
