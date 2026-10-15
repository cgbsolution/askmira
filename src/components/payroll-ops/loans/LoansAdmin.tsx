"use client";

import { Info } from "lucide-react";
import React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ClaimsReviewPanel } from "./ClaimsReviewPanel";
import { FlexiDeclarationsPanel } from "./FlexiDeclaration";
import { LoanApplicationsPanel } from "./LoanApplicationsPanel";
import { LoanSchemesPanel } from "./LoanSchemesPanel";
import { ReimbursementComponentsPanel } from "./ReimbursementComponentsPanel";

/** HR's loans and reimbursements screen (prompt 14). */
export function LoansAdmin() {
  return (
    <div className="space-y-4">
      <Alert>
        <Info />
        <AlertTitle>EMIs are recovered in the payroll run, not here</AlertTitle>
        <AlertDescription>
          This screen approves, disburses and tracks loans. The monthly EMI is deducted inside each
          payroll run, following the loan&apos;s repayment schedule and never taking net pay below
          the scheme&apos;s minimum. What each run recovered, skipped or carried forward shows in the
          loan&apos;s ledger.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="loans">
        <div className="no-scrollbar overflow-x-auto">
          <TabsList>
            <TabsTrigger value="loans">Applications &amp; loans</TabsTrigger>
            <TabsTrigger value="schemes">Schemes</TabsTrigger>
            <TabsTrigger value="claims">Reimbursement claims</TabsTrigger>
            <TabsTrigger value="components">Reimbursement components</TabsTrigger>
            <TabsTrigger value="flexi">Flexi benefit plans</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="loans">
          <LoanApplicationsPanel />
        </TabsContent>
        <TabsContent value="schemes">
          <LoanSchemesPanel />
        </TabsContent>
        <TabsContent value="claims">
          <ClaimsReviewPanel />
        </TabsContent>
        <TabsContent value="components">
          <ReimbursementComponentsPanel />
        </TabsContent>
        <TabsContent value="flexi">
          <FlexiDeclarationsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
