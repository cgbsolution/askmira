"use client";

import { Info } from "lucide-react";
import React, { useState } from "react";

import { QueryBoundary } from "@/components/expenses/ReviewCommon";
import { ReviewClaims } from "@/components/expenses/ReviewClaims";
import { ReviewTravel } from "@/components/expenses/ReviewTravel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { TeamQueue } from "@/lib/types/expenses";

function Count({ value }: { value: number }) {
  if (value === 0) return null;
  return (
    <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[11px] font-semibold tabular-nums text-accent-foreground">
      {value}
    </span>
  );
}

/**
 * The line manager's stage: claims and trips from the caller's reporting line,
 * before finance sees them. Approving sends an item on to finance; rejecting
 * ends it, with the reason shown to the employee.
 *
 * HR sees every team's items so nothing waits on a manager who is away; the
 * banner says so, because standing in for a manager is a choice.
 */
export function TeamApprovalsWorkspace() {
  const query = useApiQuery<TeamQueue>("/expenses/team-queue");
  const [tab, setTab] = useState("claims");

  return (
    <QueryBoundary query={query} skeletonRows={4}>
      {(queue) => (
        <div className="flex flex-col gap-4">
          {queue.covers_everyone && (
            <Alert>
              <Info />
              <AlertDescription>
                <p>
                  You are seeing every team&apos;s items because you are in HR. The employee&apos;s
                  line manager normally decides these; step in only when they cannot.
                </p>
              </AlertDescription>
            </Alert>
          )}
          {queue.excluded_own > 0 && (
            <Alert>
              <Info />
              <AlertDescription>
                <p>
                  <span className="tabular-nums">{queue.excluded_own}</span>{" "}
                  {queue.excluded_own === 1 ? "item of your own is" : "items of your own are"} not
                  shown. Your own claims and trips go to your manager.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="claims">
                Claims
                <Count value={queue.claims.length} />
              </TabsTrigger>
              <TabsTrigger value="travel">
                Travel requests
                <Count value={queue.travel_requests.length} />
              </TabsTrigger>
            </TabsList>
            <TabsContent value="claims">
              <ReviewClaims claims={queue.claims} onChanged={query.reload} stage="manager" />
            </TabsContent>
            <TabsContent value="travel">
              <ReviewTravel
                requests={queue.travel_requests}
                onChanged={query.reload}
                stage="manager"
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </QueryBoundary>
  );
}
