"use client";

import { FolderPlus, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import type { PoolAddResult, TalentPool } from "@/lib/types/hiring";

/**
 * HR: keep a candidate in a talent pool. Only a candidate who agreed to be
 * kept for future roles is admitted; a refusal says so in the dialog.
 */
export function AddToPoolDialog({ candidateId, candidateName }: { candidateId: string; candidateName: string }) {
  const [open, setOpen] = useState(false);
  const pools = useApiQuery<TalentPool[]>(open ? "/hiring/talent-pools" : null);
  const [poolId, setPoolId] = useState("");
  const [note, setNote] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    setRefusal(null);
    try {
      const result = await post<PoolAddResult>(`/hiring/talent-pools/${poolId}/members`, {
        candidate_ids: [candidateId],
        note: note.trim() || undefined,
      });
      if (result.refused.length > 0) {
        setRefusal(result.refused[0].reason);
        return;
      }
      toast.success(`${candidateName} added to the pool.`);
      setOpen(false);
      setNote("");
      setPoolId("");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The candidate could not be added.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FolderPlus /> Add to talent pool
      </Button>
      <Dialog open={open} onOpenChange={(next) => !isSaving && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keep {candidateName} for later</DialogTitle>
            <DialogDescription>Only candidates who agreed to be kept for future roles can be added.</DialogDescription>
          </DialogHeader>
          {refusal && (
            <Alert variant="warning">
              <AlertDescription>{refusal}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4">
            <FormField htmlFor="pool-choice" label="Talent pool">
              <Select value={poolId} onValueChange={setPoolId}>
                <SelectTrigger id="pool-choice" className="w-full">
                  <SelectValue placeholder={pools.isLoading ? "Loading…" : "Choose a pool"} />
                </SelectTrigger>
                <SelectContent>
                  {(pools.data ?? []).map((pool) => (
                    <SelectItem key={pool.id} value={pool.id}>
                      {pool.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {!pools.isLoading && (pools.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No pools yet. Create one under Hiring, Talent pools.</p>
            )}
            <FormField htmlFor="pool-note" label="Why keep them" optional>
              <Textarea id="pool-note" rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isSaving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={isSaving || !poolId} onClick={() => void save()}>
              {isSaving && <Loader2 className="animate-spin" />} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
