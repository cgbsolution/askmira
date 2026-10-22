"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

import { PageShell } from "@/components/common/PageShell";
import { JoinerWizard } from "@/components/onboarding/JoinerWizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Adding a person, in the same three steps as Onboarding → Add new joiner: one
 * way in, whichever menu HR came from. Somebody who joined long ago gets no
 * checklist unless one is chosen.
 */
export function NewEmployeeView() {
  const router = useRouter();
  return (
    <PageShell
      title="Add employee"
      description="Basic details, job details, then their onboarding checklist and login."
      actions={
        <Button variant="outline" asChild>
          <Link href="/people/import">Import from a spreadsheet</Link>
        </Button>
      }
    >
      <Card tier="tier1">
        <CardContent>
          <JoinerWizard
            onCancel={() => router.push("/people")}
            renderDoneActions={(created, addAnother) => (
              <>
                <Button variant="outline" onClick={addAnother}>
                  Add another
                </Button>
                <Button asChild>
                  <Link href={`/people/${created.employee_id}`}>Open profile</Link>
                </Button>
              </>
            )}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
