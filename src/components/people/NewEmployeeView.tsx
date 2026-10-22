"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React from "react";

import { PageShell } from "@/components/common/PageShell";
import { JoinerWizard } from "@/components/onboarding/JoinerWizard";
import { ImportEmployeesPanel } from "@/components/people/ImportEmployeesPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Onboarding → Add employees: the one place people are added. One person goes
 * through a three-step form that creates their record, checklist and login
 * together; many come in from Excel (`?tab=excel`), factoHR's export included.
 */
export function NewEmployeeView() {
  const router = useRouter();
  const tab = useSearchParams().get("tab") === "excel" ? "excel" : "one";

  return (
    <PageShell
      title="Add employees"
      description="One person with a short form, or many at once from Excel."
    >
      <Tabs
        value={tab}
        onValueChange={(next) =>
          router.replace(next === "excel" ? "/onboarding/new?tab=excel" : "/onboarding/new")
        }
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="one">One person</TabsTrigger>
          <TabsTrigger value="excel">Many from Excel</TabsTrigger>
        </TabsList>

        <TabsContent value="one">
          <Card tier="tier1">
            <CardContent>
              <JoinerWizard
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
      </Tabs>
    </PageShell>
  );
}
