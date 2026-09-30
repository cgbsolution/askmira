"use client";

import React from "react";

import { AssetAssignmentTable } from "@/components/assets/AssetAssignmentTable";
import { DocumentEntrySections } from "@/components/docs/DocumentEntrySections";

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
  return <AssetAssignmentTable employeeId={employeeId} employeeName={employeeName} />;
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
    <div className="flex flex-col gap-4">
      <DocumentEntrySections employee={{ id: employeeId, label: employeeName }} withCompany={false} />
    </div>
  );
}
