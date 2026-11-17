"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";

import { EmployeePicker } from "@/components/common/EmployeePicker";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { EmployeeSummary } from "@/lib/types";

import { WeekEditor } from "./TimesheetScreen";

/**
 * A consultant's timesheet, filled in by HR or their internal approver. Pick the person,
 * then the same week editor as everyone's own timesheet works on their behalf.
 */
export function ConsultantTimesheetPage({
  employeeId,
}: {
  employeeId?: string;
}) {
  const router = useRouter();
  const person = useApiQuery<EmployeeSummary>(
    employeeId ? `/employees/${employeeId}` : null,
  );
  const [picked, setPicked] = useState<EmployeeSummary | null>(null);
  const chosen = employeeId ? (person.data ?? picked) : null;

  return (
    <PageShell
      title="Consultant timesheet"
      description="Fill in a consultant's week for them and submit it for approval."
    >
      <Card tier="tier2">
        <CardContent className="grid gap-4">
          <FormField htmlFor="consultant-picker" label="Consultant">
            {employeeId && !chosen && person.error ? (
              // A reader who may not open the person's record still fills in their week.
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <p className="text-sm">The consultant you chose</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/time/timesheets/people")}
                >
                  Change
                </Button>
              </div>
            ) : (
              <EmployeePicker
                id="consultant-picker"
                value={chosen}
                excludeId={null}
                onChange={(employee) => {
                  setPicked(employee);
                  router.push(
                    employee
                      ? `/time/timesheets/people/${employee.id}`
                      : "/time/timesheets/people",
                  );
                }}
              />
            )}
          </FormField>
        </CardContent>
      </Card>
      {employeeId && <WeekEditor key={employeeId} employeeId={employeeId} />}
    </PageShell>
  );
}
