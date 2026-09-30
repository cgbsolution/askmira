"use client";

import { FileText, Laptop, UserRoundSearch } from "lucide-react";
import React, { useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { DocumentEntrySections } from "@/components/docs/DocumentEntrySections";
import { EmployeePicker, type PickedEmployee } from "@/components/people/EmployeePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { OnboardingPlan } from "@/lib/types/onboarding";
import { cn, formatDay } from "@/lib/utils";

import { JoinerAssets } from "./JoinerAssetsDocs";

type Kind = "assets" | "documents";

const COPY: Record<Kind, { title: string; description: string }> = {
  assets: {
    title: "Asset assignment",
    description:
      "Hand over laptops, phones and access cards to new joiners and anyone else, and see what each person holds.",
  },
  documents: {
    title: "Document entry",
    description:
      "Employee, dependant and company documents — with their numbers, issue and expiry dates, remarks and the soft copy.",
  },
};

/**
 * The onboarding transactions, as factoHR's On Board menu has them: asset
 * assignment and document entry. People being onboarded now are one click
 * away; anyone else is a search. The work itself is the Assets and Documents
 * modules' own — this is the onboarding way in.
 */
export function OnboardingTransactionScreen({ kind }: { kind: Kind }) {
  const [picked, setPicked] = useState<PickedEmployee | null>(null);
  const joiners = useApiQuery<OnboardingPlan[]>("/onboarding/plans?status=in_progress");
  const copy = COPY[kind];

  return (
    <PageShell title={copy.title} description={copy.description} icon={kind === "assets" ? Laptop : FileText}>
      <Card tier="tier1">
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
          <FormField htmlFor="transaction-person" label="Employee">
            <EmployeePicker
              id="transaction-person"
              value={picked}
              onChange={setPicked}
              placeholder="Search by name or code"
              allowClear
            />
          </FormField>
          {(joiners.data ?? []).length > 0 && (
            <div className="grid gap-1.5">
              <p className="text-sm font-medium">Being onboarded now</p>
              <div className="flex flex-wrap gap-2">
                {(joiners.data ?? []).map((plan) => (
                  <Button
                    key={plan.id}
                    variant="outline"
                    size="sm"
                    className={cn(picked?.id === plan.employee_id && "border-primary ring-2 ring-primary/20")}
                    onClick={() => setPicked({ id: plan.employee_id, label: plan.employee_name })}
                  >
                    {plan.employee_name}
                    <Badge variant={plan.employee_status === "pre_joining" ? "accent" : "outline"}>
                      {plan.employee_status === "pre_joining" ? "Joins" : "Joined"}{" "}
                      {formatDay(plan.joining_date)}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {kind === "documents" ? (
        <DocumentEntrySections key={picked?.id ?? "everyone"} employee={picked} />
      ) : picked ? (
        <JoinerAssets key={picked.id} employeeId={picked.id} employeeName={picked.label} />
      ) : (
        <Card tier="tier1">
          <EmptyState
            icon={UserRoundSearch}
            title="Choose an employee"
            description="Pick someone above to see the assets they hold and hand one over. The full register, with returns and repairs, is under Assets → Asset register."
          />
        </Card>
      )}
    </PageShell>
  );
}
