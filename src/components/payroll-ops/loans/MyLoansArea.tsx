"use client";

import { HandCoins, UserX } from "lucide-react";
import React, { useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { LoanAccount } from "@/lib/types/payroll-ops";

import { ApplyLoanDialog } from "./ApplyLoanDialog";
import { LoanDetailSheet } from "./LoanDetailSheet";
import { LoansTable } from "./LoansTable";
import { MyEncashment } from "./MyEncashment";
import { MyReimbursements } from "./MyReimbursements";
import { QueryPanel } from "./QueryPanel";

/** The signed-in person's own loans, reimbursements and leave encashment. */
export function MyLoansArea() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (!user?.employee_id) {
    return (
      <Card tier="tier1">
        <EmptyState
          icon={UserX}
          title="Your login is not linked to an employee record"
          description="Loans, reimbursements and leave encashment belong to an employee record. Ask your HR admin to link your account to yours."
        />
      </Card>
    );
  }

  return (
    <Tabs defaultValue="loans">
      <div className="no-scrollbar overflow-x-auto">
        <TabsList>
          <TabsTrigger value="loans">My loans</TabsTrigger>
          <TabsTrigger value="reimbursements">Reimbursements</TabsTrigger>
          <TabsTrigger value="encashment">Leave encashment</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="loans">
        <MyLoansPanel />
      </TabsContent>
      <TabsContent value="reimbursements">
        <MyReimbursements />
      </TabsContent>
      <TabsContent value="encashment">
        <MyEncashment />
      </TabsContent>
    </Tabs>
  );
}

function MyLoansPanel() {
  const query = useApiQuery<LoanAccount[]>("/loans/mine");
  const [openLoanId, setOpenLoanId] = useState<string | null>(null);

  return (
    <>
      <QueryPanel
        query={query}
        title="My loans"
        description="Once a loan is disbursed, its EMI is deducted from your salary in each payroll run."
        actions={<ApplyLoanDialog mode="self" onCreated={query.reload} />}
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: HandCoins,
          title: "You have no loans",
          description:
            "Loans you apply for show up here with their repayment schedule and what has been recovered.",
        }}
      >
        {(rows) => <LoansTable rows={rows} onOpen={(loan) => setOpenLoanId(loan.id)} />}
      </QueryPanel>
      <LoanDetailSheet mode="self" loanId={openLoanId} onClose={() => setOpenLoanId(null)} />
    </>
  );
}
