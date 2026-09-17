"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import React, { useEffect, useState } from "react";

import { ADMIN_ROLES, HR_ROLES } from "@/components/payroll-ops/loans/common";
import { QueryBoundary } from "@/components/payroll-ops/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { GratuityConfig } from "@/lib/types/payroll-ops";
import { formatDate } from "@/lib/utils";

import { AccrualsPanel } from "./AccrualsPanel";
import { EncashmentAdminPanel } from "./EncashmentAdminPanel";
import { GratuityConfigPanel } from "./GratuityConfigPanel";
import { LiabilityPanel } from "./LiabilityPanel";
import { PayoutsPanel } from "./PayoutsPanel";

/** HR's gratuity and leave encashment screen (prompt 08). */
export function GratuityAdmin() {
  const { hasRole } = useAuth();
  const isHr = hasRole(...HR_ROLES);
  const isAdmin = hasRole(...ADMIN_ROLES);
  // `null` is a real answer from this endpoint (no configuration yet), so the
  // "loaded" wrapper keeps it apart from "still loading".
  const configQuery = useApiQuery<GratuityConfig | null>("/gratuity/config");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [tab, setTab] = useState<string | null>(null);
  useEffect(() => {
    if (!configQuery.isLoading) setHasLoaded(true);
  }, [configQuery.isLoading]);
  // A reload after saving keeps the screen (and the open tab) in place.
  const loaded = {
    ...configQuery,
    isLoading: !hasLoaded,
    data: !hasLoaded || configQuery.error ? null : { config: configQuery.data },
  };

  return (
    <QueryBoundary query={loaded} skeletonRows={4}>
      {({ config }) => (
        <div className="space-y-4">
          {!config ? (
            <Alert variant="warning">
              <ShieldAlert />
              <AlertTitle>Gratuity is not configured</AlertTitle>
              <AlertDescription>
                Nothing computes until a configuration is saved and approved by the Compliance SME.
                Start in the Configuration tab.
              </AlertDescription>
            </Alert>
          ) : config.is_approved ? (
            <Alert variant="success">
              <ShieldCheck />
              <AlertTitle>Configuration approved</AlertTitle>
              <AlertDescription>
                Signed off by the Compliance SME
                {config.approved_at ? ` on ${formatDate(config.approved_at)}` : ""}. Accruals,
                liability and payouts use it.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="warning">
              <ShieldAlert />
              <AlertTitle>Configuration awaiting Compliance SME approval</AlertTitle>
              <AlertDescription>
                Accruals, liability and exit payouts are refused until the saved configuration is
                approved.
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={tab ?? (config?.is_approved ? "liability" : "config")} onValueChange={setTab}>
            <div className="no-scrollbar overflow-x-auto">
              <TabsList>
                <TabsTrigger value="liability">Liability</TabsTrigger>
                <TabsTrigger value="accruals">Accruals</TabsTrigger>
                <TabsTrigger value="payouts">Payouts at exit</TabsTrigger>
                <TabsTrigger value="config">Configuration</TabsTrigger>
                <TabsTrigger value="encashment">Encashment</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="liability">
              <LiabilityPanel />
            </TabsContent>
            <TabsContent value="accruals">
              <AccrualsPanel canRun={isHr} />
            </TabsContent>
            <TabsContent value="payouts">
              <PayoutsPanel canCompute={isHr} />
            </TabsContent>
            <TabsContent value="config">
              <GratuityConfigPanel config={config} isAdmin={isAdmin} onChanged={configQuery.reload} />
            </TabsContent>
            <TabsContent value="encashment">
              <EncashmentAdminPanel isHr={isHr} isAdmin={isAdmin} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </QueryBoundary>
  );
}
