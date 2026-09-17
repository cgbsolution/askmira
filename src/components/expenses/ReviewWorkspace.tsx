"use client";

import { Info } from "lucide-react";
import React, { useCallback, useState } from "react";

import { ReviewAdvances } from "@/components/expenses/ReviewAdvances";
import { ReviewAgeing } from "@/components/expenses/ReviewAgeing";
import { ReviewClaims } from "@/components/expenses/ReviewClaims";
import { QueryBoundary } from "@/components/expenses/ReviewCommon";
import { ReviewTravel } from "@/components/expenses/ReviewTravel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Advance, ReviewQueue, TravelRequest } from "@/lib/types/expenses";

function Count({ value }: { value: number }) {
  if (value === 0) return null;
  return (
    <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[11px] font-semibold tabular-nums text-accent-foreground">
      {value}
    </span>
  );
}

/**
 * Finance's queue: submitted claims, submitted trips, advances to settle, and
 * the ageing of what is still outstanding.
 *
 * The server leaves out anything about the signed-in person; the count of
 * what it left out is shown so nobody wonders where their own claim went.
 */
export function ReviewWorkspace() {
  const query = useApiQuery<ReviewQueue>("/expenses/review-queue");
  const [tab, setTab] = useState("claims");
  // Trips approved in this sitting, so an advance can be issued straight away.
  const [approvedTrips, setApprovedTrips] = useState<TravelRequest[]>([]);
  const { reload } = query;

  const onTripApproved = useCallback((trip: TravelRequest) => {
    setApprovedTrips((current) => [trip, ...current.filter((row) => row.id !== trip.id)]);
  }, []);

  const onAdvanceIssued = useCallback((advance: Advance) => {
    setApprovedTrips((current) =>
      current.map((trip) =>
        trip.id === advance.travel_request_id ? { ...trip, advance_issued: advance.amount } : trip,
      ),
    );
  }, []);

  return (
    <QueryBoundary query={query} skeletonRows={5}>
      {(queue) => (
        <div className="flex flex-col gap-4">
          {queue.excluded_own > 0 && (
            <Alert>
              <Info />
              <AlertDescription>
                <p>
                  <span className="tabular-nums">{queue.excluded_own}</span>{" "}
                  {queue.excluded_own === 1 ? "item is" : "items are"} not shown here because{" "}
                  {queue.excluded_own === 1 ? "it is" : "they are"} about you. Items about you go to
                  another approver.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <div className="no-scrollbar overflow-x-auto">
              <TabsList>
                <TabsTrigger value="claims">
                  Claims
                  <Count value={queue.claims.length} />
                </TabsTrigger>
                <TabsTrigger value="travel">
                  Travel requests
                  <Count value={queue.travel_requests.length} />
                </TabsTrigger>
                <TabsTrigger value="settle">
                  Advances to settle
                  <Count value={queue.advances_to_settle.length} />
                </TabsTrigger>
                <TabsTrigger value="ageing">Ageing</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="claims">
              <ReviewClaims claims={queue.claims} onChanged={reload} />
            </TabsContent>
            <TabsContent value="travel">
              <ReviewTravel
                requests={queue.travel_requests}
                approvedTrips={approvedTrips}
                onApproved={onTripApproved}
                onAdvanceIssued={onAdvanceIssued}
                onChanged={reload}
              />
            </TabsContent>
            <TabsContent value="settle">
              <ReviewAdvances advances={queue.advances_to_settle} onChanged={reload} />
            </TabsContent>
            <TabsContent value="ageing">
              <ReviewAgeing />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </QueryBoundary>
  );
}
