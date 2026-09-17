import { AlertTriangle, CheckCircle2 } from "lucide-react";
import React from "react";

import { Money } from "@/components/common/Money";
import { COMPONENT_TYPE_LABEL } from "@/components/payroll/labels";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SalaryBreakdown } from "@/lib/types/payroll";

/** A CTC resolved against a structure, exactly as the API returned it. */
export function BreakdownTable({ breakdown }: { breakdown: SalaryBreakdown }) {
  // The guarantee the endpoint makes, shown rather than assumed.
  const reconciles = breakdown.annual_total_in_ctc === breakdown.ctc_annual;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-xs text-muted-foreground">
          {breakdown.structure_name} · <Money value={breakdown.ctc_annual} /> a year
        </p>
        <Badge variant={reconciles ? "success" : "destructive"}>
          {reconciles ? <CheckCircle2 /> : <AlertTriangle />}
          {reconciles ? "Sums exactly to CTC" : "Does not reconcile"}
        </Badge>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Component</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Monthly</TableHead>
              <TableHead className="text-right">Annual</TableHead>
              <TableHead>Statutory</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {breakdown.components.map((component) => (
              <TableRow key={component.code}>
                <TableCell>
                  <p className="font-medium text-foreground">{component.name}</p>
                  <p className="text-xs text-muted-foreground">{component.code}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="muted">{COMPONENT_TYPE_LABEL[component.component_type]}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Money value={component.monthly_amount} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={component.annual_amount} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {component.counts_toward_pf && <Badge variant="outline">PF</Badge>}
                    {component.counts_toward_esi && <Badge variant="outline">ESI</Badge>}
                    {!component.part_of_ctc && <Badge variant="warning">Outside CTC</Badge>}
                    {!component.taxable && <Badge variant="outline">Exempt</Badge>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-semibold">
                Total in CTC
              </TableCell>
              <TableCell className="text-right font-semibold">
                <Money value={breakdown.monthly_total_in_ctc} />
              </TableCell>
              <TableCell className="text-right font-semibold">
                <Money value={breakdown.annual_total_in_ctc} />
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
