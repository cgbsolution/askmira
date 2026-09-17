"use client";

import { Trash2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { Button } from "@/components/ui/button";
import { ApiError, post } from "@/lib/api";

interface PurgeResult {
  applications_past_retention: number;
  candidates_purged: number;
}

/**
 * The retention rule, and a way to run the purge now rather than waiting for
 * the scheduled run. The purge cannot be undone.
 */
export function CareersSiteRetention({ retentionDays }: { retentionDays: number | null }) {
  const [confirm, setConfirm] = useState(false);

  const purge = async () => {
    try {
      const result = await post<PurgeResult>("/careers/purge-expired");
      toast.success("Retention purge finished", {
        description: `${result.applications_past_retention} applications past retention; ${result.candidates_purged} candidates purged.`,
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not run the purge.");
      throw error;
    }
  };

  return (
    <DataPanel
      title="Retention"
      description={
        retentionDays !== null
          ? `Applicants' resumes and documents are purged once their retention period has passed. New applications are kept for ${retentionDays} days.`
          : "Applicants' resumes and documents are purged once their retention period has passed. Save the configuration to set the period."
      }
      actions={
        <Button variant="destructive" size="sm" onClick={() => setConfirm(true)}>
          <Trash2 /> Run retention purge now
        </Button>
      }
    >
      <p className="px-5 py-4 text-sm text-muted-foreground">
        Each application keeps the retention period that was in force when it arrived, so
        changing the period does not shorten or extend existing ones. People who became
        employees, and people with a newer application still inside its period, are not purged.
      </p>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Run the retention purge now?"
        description="Applicant resumes and documents past the retention period are deleted. This cannot be undone."
        confirmLabel="Purge now"
        destructive
        onConfirm={purge}
      />
    </DataPanel>
  );
}
