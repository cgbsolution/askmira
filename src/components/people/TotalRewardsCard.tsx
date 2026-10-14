"use client";

import { Gift } from "lucide-react";
import React from "react";

import { Money } from "@/components/common/Money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { formatDay } from "@/lib/utils";

interface TotalRewards {
  financial_year: string;
  as_of: string;
  ctc: {
    annual: string | null;
    effective_from: string | null;
    earnings: string;
    employer_contributions: string;
    reimbursements: string;
    outside_ctc: string;
    components: { code: string; name: string; type: string; annual: string; monthly: string; part_of_ctc: boolean }[];
  };
  paid_this_year: { payslips: number; gross_earnings: string; employer_pf: string; employer_esi: string; net_pay: string };
  recognition: { points: number; value: string | null } | null;
  benefits: { plan: string; kind: string; lives: number; sum_insured: string; employer_premium: string; your_premium: string }[];
  not_included: string[];
}

const TYPE_LABEL: Record<string, string> = {
  earning: "Earning",
  employer_contribution: "Employer contribution",
  reimbursement: "Reimbursement",
};

/** Everything the company spends on one person, from the salary and payslips on record. */
export function TotalRewardsCard({ employeeId, isSelf }: { employeeId: string; isSelf: boolean }) {
  const { data, error } = useApiQuery<TotalRewards>(
    isSelf ? "/payroll/my-total-rewards" : `/payroll/employees/${employeeId}/total-rewards`,
  );
  if (error || !data) return null;
  const { ctc, paid_this_year: paid } = data;

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gift className="size-4 text-primary" /> Total rewards, {data.financial_year}
        </CardTitle>
        <CardDescription>
          {ctc.annual
            ? `Annual CTC in force since ${formatDay(ctc.effective_from ?? data.as_of, true)}, and what has been paid this financial year.`
            : "No salary is assigned yet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {ctc.annual && (
          <div className="grid gap-3 sm:grid-cols-4">
            <Figure label="Annual CTC" value={ctc.annual} />
            <Figure label="Earnings" value={ctc.earnings} />
            <Figure label="Employer contributions" value={ctc.employer_contributions} />
            <Figure label="Paid outside CTC" value={ctc.outside_ctc} />
          </div>
        )}
        {ctc.components.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">A month</TableHead>
                <TableHead className="text-right">A year</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ctc.components.map((c) => (
                <TableRow key={c.code}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {TYPE_LABEL[c.type] ?? c.type}
                    {!c.part_of_ctc && " · outside CTC"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={c.monthly} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={c.annual} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="grid gap-3 sm:grid-cols-4">
          <Figure label={`Gross paid (${paid.payslips} payslip${paid.payslips === 1 ? "" : "s"})`} value={paid.gross_earnings} />
          <Figure label="Employer PF paid" value={paid.employer_pf} />
          <Figure label="Employer ESI paid" value={paid.employer_esi} />
          {data.recognition && <Figure label={`Recognition (${data.recognition.points} points)`} value={data.recognition.value} />}
        </div>
        {data.benefits.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Benefit plan</TableHead>
                <TableHead className="text-right">Lives</TableHead>
                <TableHead className="text-right">Cover</TableHead>
                <TableHead className="text-right">Company pays</TableHead>
                <TableHead className="text-right">Top-up you pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.benefits.map((b) => (
                <TableRow key={b.plan}>
                  <TableCell>{b.plan}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.lives}</TableCell>
                  <TableCell className="text-right">
                    <Money value={b.sum_insured} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={b.employer_premium} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={b.your_premium} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {data.not_included.map((line) => (
          <p key={line} className="text-xs text-muted-foreground">
            {line}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">
        <Money value={value} />
      </p>
    </div>
  );
}
