"use client";

import { UserX } from "lucide-react";
import React from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageShell } from "@/components/common/PageShell";
import { DocumentsPanel } from "@/components/docs/DocumentsPanel";
import { LettersPanel } from "@/components/docs/LettersPanel";
import { TemplatesPanel } from "@/components/docs/TemplatesPanel";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";

/** /docs — your own vault and letters; HR also gets the company vault and expiries. */
export function MyDocumentsView() {
  const { user, hasRole } = useAuth();
  const isHr = hasRole("tenant_admin", "hr_admin", "hr_ops");
  const hasRecord = Boolean(user?.employee_id);
  const me = user?.employee_id ? { id: user.employee_id, label: user.full_name } : null;

  const own = hasRecord ? (
    <div className="grid gap-6">
      <DocumentsPanel title="My documents" employee={me} />
      <LettersPanel title="My letters" employee={me} />
    </div>
  ) : (
    <Card tier="tier1">
      <EmptyState
        icon={UserX}
        title="Your login is not linked to an employee record"
        description="Documents and letters belong to an employee record. Ask HR to link your login."
      />
    </Card>
  );

  return (
    <PageShell
      title="Documents"
      description="ID proofs, contracts and letters — kept with the employee record."
    >
      {isHr ? (
        <Tabs defaultValue="company">
          <TabsList>
            <TabsTrigger value="company">All employees</TabsTrigger>
            <TabsTrigger value="expiring">Expiring</TabsTrigger>
            <TabsTrigger value="mine">Mine</TabsTrigger>
          </TabsList>
          <TabsContent value="company" className="mt-4">
            <DocumentsPanel title="Employee vault" showEmployee />
          </TabsContent>
          <TabsContent value="expiring" className="mt-4">
            <DocumentsPanel title="Expiring documents" showEmployee expiringOnly />
          </TabsContent>
          <TabsContent value="mine" className="mt-4">
            {own}
          </TabsContent>
        </Tabs>
      ) : (
        own
      )}
    </PageShell>
  );
}

export function LettersView() {
  return (
    <PageShell
      title="Letters"
      description="Issue, approve, sign and verify employment letters. Every letter keeps a fixed, hash-checked copy."
    >
      <LettersPanel manage title="Issued letters" />
    </PageShell>
  );
}

export function TemplatesView() {
  return (
    <PageShell
      title="Letter templates"
      description="Templates with merge fields, approval and signature rules. Edits are versioned."
    >
      <TemplatesPanel />
    </PageShell>
  );
}
