import React from "react";

import { PayslipSheet } from "@/components/payroll/PayslipSheet";
import { PayslipTrace } from "@/components/payroll/PayslipTrace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Payslip } from "@/lib/types/payroll";

/** The payslip as printed (the PDF's layout), and beside it how every figure was reached. */
export function PayslipViews({ payslip }: { payslip: Payslip }) {
  return (
    <Tabs defaultValue="payslip" className="gap-4">
      <TabsList>
        <TabsTrigger value="payslip">Payslip</TabsTrigger>
        <TabsTrigger value="working">How it was worked out</TabsTrigger>
      </TabsList>
      <TabsContent value="payslip">
        <PayslipSheet sheet={payslip.sheet} error={payslip.sheet_error} className="max-w-4xl" />
      </TabsContent>
      <TabsContent value="working">
        <PayslipTrace payslip={payslip} />
      </TabsContent>
    </Tabs>
  );
}
