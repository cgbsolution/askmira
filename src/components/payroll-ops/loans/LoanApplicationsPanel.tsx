"use client";

import { HandCoins } from "lucide-react";
import React, { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { EmployeeSummary } from "@/lib/types";
import type { LoanAccount, LoanStatus } from "@/lib/types/payroll-ops";

import { ApplyLoanDialog } from "./ApplyLoanDialog";
import { HR_ROLES, LOAN_STATUS_LABEL } from "./common";
import { EmployeePicker } from "./EmployeePicker";
import { LoanDetailSheet } from "./LoanDetailSheet";
import { LoansTable } from "./LoansTable";
import { QueryPanel } from "./QueryPanel";

/** Every loan HR can see, filterable by status and employee. */
export function LoanApplicationsPanel() {
  const { hasRole } = useAuth();
  const [status, setStatus] = useState<LoanStatus | "any">("any");
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [openLoanId, setOpenLoanId] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (employee) params.set("employee_id", employee.id);
  if (status !== "any") params.set("loan_status", status);
  const search = params.toString();
  const query = useApiQuery<LoanAccount[]>(`/loans${search ? `?${search}` : ""}`);
  const filtered = Boolean(employee) || status !== "any";

  return (
    <>
      <QueryPanel
        query={query}
        title="Applications & loans"
        actions={hasRole(...HR_ROLES) && <ApplyLoanDialog mode="for" onCreated={query.reload} />}
        toolbar={
          <>
            <Select value={status} onValueChange={(value) => setStatus(value as LoanStatus | "any")}>
              <SelectTrigger size="sm" className="w-40" aria-label="Loan status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any status</SelectItem>
                {(Object.keys(LOAN_STATUS_LABEL) as LoanStatus[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {LOAN_STATUS_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <EmployeePicker
              className="w-full sm:w-72"
              value={employee}
              onChange={setEmployee}
              placeholder="Filter by employee"
            />
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {query.data ? `${query.data.length} ${query.data.length === 1 ? "loan" : "loans"}` : ""}
            </span>
          </>
        }
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: HandCoins,
          title: filtered ? "No loans match these filters" : "No loan applications yet",
          description: filtered
            ? "Clear the status or employee filter to see more."
            : "Applications made by employees, or by HR on their behalf, appear here.",
        }}
      >
        {(rows) => <LoansTable rows={rows} showEmployee onOpen={(loan) => setOpenLoanId(loan.id)} />}
      </QueryPanel>

      <LoanDetailSheet
        mode="hr"
        loanId={openLoanId}
        onClose={() => setOpenLoanId(null)}
        onChanged={query.reload}
      />
    </>
  );
}
