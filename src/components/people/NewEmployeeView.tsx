"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { EmployeeForm } from "@/components/people/EmployeeForm";
import { Card, CardContent } from "@/components/ui/card";

export function NewEmployeeView() {
  const router = useRouter();
  return (
    <PageShell
      title="Add employee"
      description="Create the employee record. A sign-in for them is set up under Settings → Users & roles."
    >
      <SectionNav section="people" />
      <Card tier="tier1">
        <CardContent>
          <EmployeeForm
            onCancel={() => router.push("/people")}
            onSaved={(saved) => {
              toast.success(`${saved.employee_code} created`);
              router.push(`/people/${saved.id}`);
            }}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
