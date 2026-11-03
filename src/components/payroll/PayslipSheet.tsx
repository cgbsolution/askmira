import { AlertTriangle } from "lucide-react";
import React from "react";

import { groupIndian } from "@/components/payroll-ops/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PayslipSheet as Sheet, PayslipSheetLine } from "@/lib/types/payroll";
import { cn } from "@/lib/utils";

/** "48,474.00": Indian grouping, two decimals, never through a JS number. */
function amount(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  return groupIndian(`${whole}.${(fraction + "00").slice(0, 2)}`);
}

/** The PDF's header cells: bold, sentence case, on blush. */
const HEAD = "w-1/2 text-sm font-semibold normal-case tracking-normal text-foreground";

function Lines({
  heading,
  lines,
  total,
  empty,
}: {
  heading: string;
  lines: PayslipSheetLine[];
  total?: { label: string; value: string };
  empty?: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      {/* table-ok: the payslip as printed — the same two-column table as its PDF */}
      <Table>
        <TableHeader>
          <TableRow className="bg-blush-100 hover:bg-blush-100 dark:bg-blush-900/40 dark:hover:bg-blush-900/40">
            <TableHead className={HEAD}>{heading}</TableHead>
            <TableHead className={HEAD}>Amount (INR)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 && empty ? (
            <TableRow>
              <TableCell>{empty}</TableCell>
              <TableCell className="text-right tabular-nums">0.00</TableCell>
            </TableRow>
          ) : (
            lines.map((line, index) => (
              <TableRow key={`${line.name}-${index}`}>
                <TableCell className="whitespace-normal">{line.name}</TableCell>
                <TableCell className="text-right tabular-nums">{amount(line.amount)}</TableCell>
              </TableRow>
            ))
          )}
          {total && (
            <TableRow className="bg-cream-100 font-semibold hover:bg-cream-100 dark:bg-blush-900/20 dark:hover:bg-blush-900/20">
              <TableCell>{total.label}</TableCell>
              <TableCell className="text-right tabular-nums">{amount(total.value)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * The payslip laid out as its PDF prints it: company, details, earnings,
 * deductions, net pay in figures and words, employer contributions. Every
 * value comes from the API's `sheet`, which is built by the same code as the
 * PDF, so the screen and the paper cannot disagree.
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
  return (
    <Card tier="tier1" className={cn("overflow-hidden", className)}>
      <CardContent className="grid gap-5 p-5 sm:p-8">
        <div className="grid gap-3">
          <p className="border-b-2 border-primary pb-3 text-lg font-semibold text-foreground">
            {sheet.company_name}
          </p>
          {sheet.company_address && (
            <p className="border-b-2 border-primary pb-3 text-xs leading-relaxed text-muted-foreground">
              {sheet.company_address}
            </p>
          )}
        </div>

        <p className="text-lg font-semibold text-foreground">{sheet.title}</p>

        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {sheet.facts.map((fact) => (
            <div key={fact.label} className="grid grid-cols-[8.5rem_1fr] gap-3">
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="break-words text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-3">
          <Lines
            heading="Earnings"
            lines={sheet.earnings}
            total={{ label: "Total earnings", value: sheet.total_earnings }}
          />
          <Lines
            heading="Deductions"
            lines={sheet.deductions}
            empty="No deductions"
            total={{ label: "Total deductions", value: sheet.total_deductions }}
          />
        </div>

        <div className="grid gap-1">
          <p className="text-lg font-semibold text-foreground">
            Net pay: INR {amount(sheet.net_pay)}
          </p>
          <p className="text-sm text-foreground">{sheet.net_pay_in_words}</p>
        </div>

        {sheet.perquisites.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Perquisites (non-cash, taxable, not paid to you):{" "}
            {sheet.perquisites.map((line) => `${line.name} ${amount(line.amount)}`).join("; ")}.
          </p>
        )}

        {sheet.employer_contributions.length > 0 && (
          <div className="grid gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Employer contributions</p>
              <p className="text-xs text-muted-foreground">
                Paid by the company on your behalf; not part of your net pay.
              </p>
            </div>
            <Lines heading="Contribution" lines={sheet.employer_contributions} />
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          This is a computer-generated payslip and does not require a signature. {sheet.company_name} -{" "}
          {sheet.reference}
        </p>
      </CardContent>
    </Card>
  );
}
