"use client";

import { PageShell } from "@/components/common/PageShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BudgetTab } from "./BudgetTab";
import { PositionsTab } from "./PositionsTab";
import { ScenariosTab } from "./ScenariosTab";
import { VacanciesTab } from "./VacanciesTab";

/**
 * Employees → Positions.
 *
 * A position is a seat that exists whether or not anybody sits in it, which is
 * what lets the org chart show vacancies and the budget show the cost of the
 * empty chairs. Seats are frozen or abolished with a reason rather than
 * deleted, so last year's headcount can still be explained.
 */
export function PositionsScreen() {
  return (
    <PageShell
      title="Positions"
      description="Approved seats, who holds them, what is vacant, and what the budget allows."
    >
      <Tabs defaultValue="positions">
        <TabsList>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="vacancies">Vacancies</TabsTrigger>
          <TabsTrigger value="budget">Headcount budget</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
        </TabsList>
        <TabsContent value="positions" className="mt-4">
          <PositionsTab />
        </TabsContent>
        <TabsContent value="vacancies" className="mt-4">
          <VacanciesTab />
        </TabsContent>
        <TabsContent value="budget" className="mt-4">
          <BudgetTab />
        </TabsContent>
        <TabsContent value="scenarios" className="mt-4">
          <ScenariosTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
