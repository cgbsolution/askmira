"use client";

import { ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import React, { useState } from "react";

import { GstCapturePanel } from "@/components/expenses/GstCapturePanel";
import { GstConfigPanel } from "@/components/expenses/GstConfigPanel";
import { GstCreditsPanel } from "@/components/expenses/GstCreditsPanel";
import { GstDashboardPanel } from "@/components/expenses/GstDashboardPanel";
import { GstDuplicatesPanel } from "@/components/expenses/GstDuplicatesPanel";
import { GstRegisterPanel } from "@/components/expenses/GstRegisterPanel";
import { GstReviewPanel } from "@/components/expenses/GstReviewPanel";
import { Gstr2bPanel } from "@/components/expenses/Gstr2bPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { GstPosture } from "@/lib/types/expenses";

/**
 * The limits of this module, stated before any figure. The eligibility rules
 * have not been reviewed by a tax advisor; invoices are typed in, not read by
 * OCR; and a GSTIN is checked for structure only, not against the GST portal.
 */
function GstPostureNotice() {
  const posture = useApiQuery<GstPosture>("/gst/posture");
  const [expanded, setExpanded] = useState(false);
  const notBuilt = posture.data?.not_built ?? [];
  const [lead, ...rest] = notBuilt;

  return (
    <Alert variant="warning">
      <ShieldAlert />
      <AlertTitle>Read before relying on these figures</AlertTitle>
      <AlertDescription>
        {posture.isLoading && !posture.data ? (
          <Skeleton className="h-4 w-72" />
        ) : posture.error ? (
          <p>The module&apos;s posture could not be loaded: {posture.error.detail}</p>
        ) : (
          lead && <p className="font-medium">{lead}</p>
        )}
        <p>
          Invoice details are entered by hand — OCR extraction is not built. A GSTIN is checked for its format and
          checksum only — the GST portal status check is not built.
        </p>
        {posture.data && (rest.length > 0 || posture.data.enforced.length > 0) && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-7 text-current"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? <ChevronUp /> : <ChevronDown />}
              {expanded ? "Hide details" : "What is enforced and what is not built"}
            </Button>
            {expanded && (
              <div className="grid w-full gap-3 md:grid-cols-2">
                {rest.length > 0 && (
                  <div>
                    <p className="font-medium">Also not built</p>
                    <ul className="list-disc space-y-0.5 pl-5">
                      {rest.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {posture.data.enforced.length > 0 && (
                  <div>
                    <p className="font-medium">Enforced</p>
                    <ul className="list-disc space-y-0.5 pl-5">
                      {posture.data.enforced.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}

/** GST input tax credit on expenses. Configuration writes are admin-only. */
export function GstWorkspace() {
  const { hasRole } = useAuth();
  const canAdmin = hasRole("admin");

  return (
    <div className="flex flex-col gap-4">
      <GstPostureNotice />
      <Tabs defaultValue="dashboard">
        <div className="no-scrollbar overflow-x-auto">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="review">Review queue</TabsTrigger>
            <TabsTrigger value="credits">Credits</TabsTrigger>
            <TabsTrigger value="capture">Capture</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
            <TabsTrigger value="gstr2b">GSTR-2B</TabsTrigger>
            <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="dashboard">
          <GstDashboardPanel />
        </TabsContent>
        <TabsContent value="review">
          <GstReviewPanel />
        </TabsContent>
        <TabsContent value="credits">
          <GstCreditsPanel />
        </TabsContent>
        <TabsContent value="capture">
          <GstCapturePanel />
        </TabsContent>
        <TabsContent value="register">
          <GstRegisterPanel />
        </TabsContent>
        <TabsContent value="gstr2b">
          <Gstr2bPanel />
        </TabsContent>
        <TabsContent value="duplicates">
          <GstDuplicatesPanel />
        </TabsContent>
        <TabsContent value="config">
          <GstConfigPanel canAdmin={canAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
