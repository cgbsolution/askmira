"use client";

import { BookOpen, ChevronDown, Loader2 } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";

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
import { downloadFile } from "@/lib/api";
import type { PayrollRun } from "@/lib/types/payroll";

const FORMATS = [
  { key: "tally", label: "Tally (XML voucher)", file: "payroll-journal.xml" },
  { key: "zoho", label: "Zoho Books (journal CSV)", file: "payroll-journal.csv" },
  { key: "csv", label: "Generic journal CSV", file: "payroll-journal.csv" },
];

/** Post an approved run to the books: a balanced journal in Tally, Zoho or plain CSV. */
export function JournalExportMenu({ run }: { run: PayrollRun }) {
  const [byDepartment, setByDepartment] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (run.status !== "approved" && run.status !== "paid") return null;
  // A month imported from factoHR is already in the books from there.
  if (isImported(run)) return null;

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

  return (
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
          <DropdownMenuItem key={format.key} onSelect={() => void download(format.key, format.file)}>
            {format.label}
          </DropdownMenuItem>
        ))}
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
  );
}
