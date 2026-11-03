import { AlertTriangle } from "lucide-react";
import React, { useState } from "react";

import { groupIndian } from "@/components/payroll-ops/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PayslipSheet as Sheet } from "@/lib/types/payroll";
import { cn } from "@/lib/utils";

/** "48,474.00": Indian grouping, two decimals, never through a JS number. */
function amount(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const [whole, fraction = ""] = value.split(".");
  return groupIndian(`${whole}.${(fraction + "00").slice(0, 2)}`);
}

/** The ink lines of the printed page. */
const LINE = "border-foreground/80";
const HEAD = cn("h-auto border px-2 py-2 text-center text-xs font-bold normal-case tracking-normal text-foreground", LINE);
const CELL = cn("border-x px-2 py-1.5 text-xs whitespace-normal", LINE);
const TOTAL = cn("border px-2 py-2 text-xs font-bold", LINE);

function Facts({ facts }: { facts: Sheet["left_facts"] }) {
  return (
    <dl className="grid content-start gap-y-1.5">
      {facts.map((fact) => (
        <div key={fact.label} className="grid grid-cols-[7.5rem_1fr] gap-2">
          <dt>{fact.label}</dt>
          <dd className="font-bold break-words">: {fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Logo({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <span className="hidden w-32 sm:block" />;
  return (
    // A company's own uploaded logo; its size is not known in advance.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      onError={() => setFailed(true)}
      className="h-12 w-32 shrink-0 object-contain sm:object-left"
    />
  );
}

/**
 * The payslip laid out as its PDF prints it — CGB's old factoHR salary slip:
 * logo, company and month at the top; the person's details in a box; earnings
 * (Actual, Arrears, Amount) beside deductions; net pay in figures and words.
 * Every value comes from the API's `sheet`, built by the same code as the PDF,
 * so the screen and the paper cannot disagree.
 */
export function PayslipSheet({
  sheet,
  error,
  className,
}: {
  sheet: Sheet | null | undefined;
  error?: string | null;
  className?: string;
}) {
  if (!sheet) {
    return error ? (
      <Alert variant="destructive" className={className}>
        <AlertTriangle />
        <AlertTitle>This payslip cannot be shown as printed</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    ) : null;
  }
  const rows = Math.max(sheet.earnings.length, sheet.deductions.length, 1);

  return (
    <Card tier="tier1" className={cn("overflow-hidden", className)}>
      <CardContent className="grid gap-3 p-4 text-xs text-foreground sm:p-6">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
          <Logo url={sheet.logo_url} name={sheet.company_name} />
          <div className="min-w-0 flex-1 text-center">
            <p className="text-sm font-bold uppercase">{sheet.company_name}</p>
            {sheet.company_address && <p className="font-bold">{sheet.company_address}</p>}
            <p className="pt-1.5 text-sm font-bold">{sheet.title}</p>
          </div>
          <span className="hidden w-32 sm:block" />
        </div>

        <div className={cn("border", LINE)}>
          <div className="grid gap-x-6 gap-y-1.5 p-2 sm:grid-cols-2">
            <Facts facts={sheet.left_facts} />
            <Facts facts={sheet.right_facts} />
          </div>
          <div className={cn("grid gap-x-6 gap-y-1.5 border-t p-2 sm:grid-cols-2", LINE)}>
            <Facts facts={[{ label: "Payable Days", value: sheet.payable_days }]} />
            <Facts facts={[{ label: "Net Paid Days", value: sheet.net_paid_days }]} />
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* table-ok: the payslip as printed — factoHR's earnings-beside-deductions grid */}
          <Table className="min-w-[640px] border-collapse">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={cn(HEAD, "w-[26%] text-sm")}>EARNINGS</TableHead>
                <TableHead className={cn(HEAD, "w-[11%]")}>Actual ₹</TableHead>
                <TableHead className={cn(HEAD, "w-[11%]")}>Arrears ₹</TableHead>
                <TableHead className={cn(HEAD, "w-[11%]")}>Amount ₹</TableHead>
                <TableHead className={cn(HEAD, "w-[29%] text-sm")}>DEDUCTIONS</TableHead>
                <TableHead className={cn(HEAD, "w-[12%]")}>Amount ₹</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rows }, (_, index) => {
                const earning = sheet.earnings[index];
                const deduction = sheet.deductions[index];
                return (
                  <TableRow key={index} className="border-0 hover:bg-transparent">
                    <TableCell className={cn(CELL, "uppercase")}>{earning?.name}</TableCell>
                    <TableCell className={cn(CELL, "text-right tabular-nums")}>{amount(earning?.actual)}</TableCell>
                    <TableCell className={cn(CELL, "text-right tabular-nums")}>{amount(earning?.arrears)}</TableCell>
                    <TableCell className={cn(CELL, "text-right text-sm tabular-nums")}>
                      {amount(earning?.amount)}
                    </TableCell>
                    <TableCell className={cn(CELL, "uppercase")}>{deduction?.name}</TableCell>
                    <TableCell className={cn(CELL, "text-right tabular-nums")}>{amount(deduction?.amount)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="hover:bg-transparent">
                <TableCell className={TOTAL}>Gross Earnings</TableCell>
                <TableCell className={cn(TOTAL, "text-right tabular-nums")}>{amount(sheet.total_actual)}</TableCell>
                <TableCell className={cn(TOTAL, "text-right tabular-nums")}>{amount(sheet.total_arrears)}</TableCell>
                <TableCell className={cn(TOTAL, "text-right tabular-nums")}>{amount(sheet.total_earnings)}</TableCell>
                <TableCell className={TOTAL}>Total Deductions</TableCell>
                <TableCell className={cn(TOTAL, "text-right tabular-nums")}>
                  {amount(sheet.total_deductions)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className={cn("border", LINE)}>
          <div className="grid gap-2 p-2 sm:grid-cols-[13rem_1fr]">
            <p className="font-bold">
              Net Pay <span className="ml-2">: ₹ {amount(sheet.net_pay)}</span>
            </p>
            <p>(₹{sheet.net_pay_in_words})</p>
            {sheet.payment_mode && <p className="sm:col-start-2">Mode of Payment : {sheet.payment_mode}</p>}
          </div>
          <p className={cn("border-t px-4 py-2 font-bold", LINE)}>
            *This is a system generated payslip and does not require signature
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
