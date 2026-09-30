"use client";

import { PackagePlus } from "lucide-react";
import React, { useState } from "react";

import { EmployeeAssetsCard } from "@/components/assets/EmployeeAssetsCard";
import { HandOverDialog } from "@/components/assets/HandOverDialog";
import { DocumentsPanel } from "@/components/docs/DocumentsPanel";
import { Button } from "@/components/ui/button";

/**
 * Assets handed to one person, and the hand-over action — the onboarding
 * "asset assignment" step, done where HR is onboarding them.
 */
export function JoinerAssets({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  const [handingOver, setHandingOver] = useState(false);
  const [version, setVersion] = useState(0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setHandingOver(true)}>
          <PackagePlus /> Hand over an asset
        </Button>
      </div>
      {/* Keyed so a hand-over re-reads the card. */}
      <EmployeeAssetsCard key={version} employeeId={employeeId} />
      <HandOverDialog
        employeeId={employeeId}
        employeeName={employeeName}
        open={handingOver}
        onOpenChange={setHandingOver}
        onDone={() => setVersion((current) => current + 1)}
      />
    </div>
  );
}

/**
 * One person's document vault with HR's entry form — issue and expiry dates
 * and the soft copy — the onboarding "document entry" step.
 */
export function JoinerDocuments({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  return (
    <DocumentsPanel
      title={`${employeeName}'s documents`}
      employee={{ id: employeeId, label: employeeName }}
    />
  );
}
