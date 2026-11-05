"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState } from "react";

import { PageShell } from "@/components/common/PageShell";
import { JoinerWizard, type JoinerValues } from "@/components/onboarding/JoinerWizard";
import { HiredInProductPanel, type LinkedHire } from "@/components/people/HiredInProductPanel";
import { ImportEmployeesPanel } from "@/components/people/ImportEmployeesPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";

/** What a hire in AnytimeHire already tells the joining form. */
function fromHire(hire: LinkedHire): Partial<JoinerValues> {
  return {
    first_name: hire.first_name,
    last_name: hire.last_name,
    work_email: hire.email,
    phone: hire.phone ?? "",
    designation: hire.job ?? "",
    ...(hire.department_id ? { department_id: hire.department_id } : {}),
    ...(hire.location_id ? { location_id: hire.location_id } : {}),
  };
}

/**
 * Onboarding → Add employees: the one place people are added. One person goes
 * through a three-step form that creates their record, checklist and login
 * together; many come in from Excel (`?tab=excel`), factoHR's export included.
 */
export function NewEmployeeView() {
  const router = useRouter();
  const asked = useSearchParams().get("tab");
  const { tenant } = useAuth();
  const hireLinked = Boolean(tenant?.linked_products?.interview);
  const tab = asked === "excel" ? "excel" : asked === "hired" && hireLinked ? "hired" : "one";
  // A hire picked from AnytimeHire: the form starts with what it knows.
  const [picked, setPicked] = useState<LinkedHire | null>(null);

  return (
    <PageShell
      title="Add employees"
      description="One person with a short form, or many at once from Excel."
    >
      <Tabs
        value={tab}
        onValueChange={(next) => {
          if (next === "one") setPicked(null);
          router.replace(next === "one" ? "/onboarding/new" : `/onboarding/new?tab=${next}`);
        }}
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="one">One person</TabsTrigger>
          <TabsTrigger value="excel">Many from Excel</TabsTrigger>
          {hireLinked && <TabsTrigger value="hired">Hired in AnytimeHire</TabsTrigger>}
        </TabsList>

        <TabsContent value="one">
          <Card tier="tier1">
            <CardContent>
              <JoinerWizard
                key={picked?.ref ?? "blank"}
                initial={picked ? fromHire(picked) : undefined}
                onCancel={() => router.push("/onboarding/plans")}
                renderDoneActions={(created, addAnother) => (
                  <>
                    <Button variant="outline" onClick={addAnother}>
                      Add another
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href={`/people/${created.employee_id}`}>Open profile</Link>
                    </Button>
                    {created.plan_id && (
                      <Button asChild>
                        <Link href={`/onboarding/plans?plan=${created.plan_id}`}>
                          View their onboarding
                        </Link>
                      </Button>
                    )}
                  </>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="excel">
          <ImportEmployeesPanel />
        </TabsContent>

        {hireLinked && (
          <TabsContent value="hired">
            <HiredInProductPanel
              onPick={(hire) => {
                setPicked(hire);
                router.replace("/onboarding/new");
              }}
            />
          </TabsContent>
        )}
      </Tabs>
    </PageShell>
  );
}
