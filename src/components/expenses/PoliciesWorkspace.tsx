"use client";

import React from "react";

import { PoliciesCityTiers } from "@/components/expenses/PoliciesCityTiers";
import { PoliciesList } from "@/components/expenses/PoliciesList";
import { PoliciesExchangeRates, PoliciesMileageRates, PoliciesPerDiemRates } from "@/components/expenses/PoliciesRates";
import { PoliciesSettings } from "@/components/expenses/PoliciesSettings";
import { PoliciesViolations } from "@/components/expenses/PoliciesViolations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";

/**
 * Expense configuration. Admins write policies, tiers, mileage, per-diem and
 * settings; anyone in HR may enter an exchange rate. Everything else is read.
 */
export function PoliciesWorkspace() {
  const { hasRole } = useAuth();
  const canAdmin = hasRole("admin");
  const canHr = hasRole("admin", "sub_admin");

  return (
    <Tabs defaultValue="policies">
      <div className="no-scrollbar overflow-x-auto">
        <TabsList>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="tiers">City tiers</TabsTrigger>
          <TabsTrigger value="mileage">Mileage</TabsTrigger>
          <TabsTrigger value="per-diem">Per-diem</TabsTrigger>
          <TabsTrigger value="fx">Exchange rates</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="violations">Violation rates</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="policies">
        <PoliciesList canAdmin={canAdmin} />
      </TabsContent>
      <TabsContent value="tiers">
        <PoliciesCityTiers canAdmin={canAdmin} />
      </TabsContent>
      <TabsContent value="mileage">
        <PoliciesMileageRates canWrite={canAdmin} />
      </TabsContent>
      <TabsContent value="per-diem">
        <PoliciesPerDiemRates canWrite={canAdmin} />
      </TabsContent>
      <TabsContent value="fx">
        <PoliciesExchangeRates canWrite={canHr} />
      </TabsContent>
      <TabsContent value="settings">
        <PoliciesSettings canAdmin={canAdmin} />
      </TabsContent>
      <TabsContent value="violations">
        <PoliciesViolations />
      </TabsContent>
    </Tabs>
  );
}
