"use client";

import { AlertTriangle, FolderPlus, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { post } from "@/lib/api";
import type { ExpenseReport, ReportInput, TravelRequest } from "@/lib/types/expenses";
import { formatDateRange } from "@/lib/utils";

import { errorDetail } from "./shared";

const NONE = "__none";

/** Start a report that groups claims to be approved together. */
export function ReportCreateDialog({
  trips,
  onCreated,
}: {
  trips: TravelRequest[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [tripId, setTripId] = useState(NONE);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const usableTrips = trips.filter((trip) => trip.status !== "cancelled" && trip.status !== "rejected");

  const reset = () => {
    setTitle("");
    setTripId(NONE);
    setError(null);
  };

  const save = async () => {
    if (!title.trim()) {
      setError("Give the report a title.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const body: ReportInput = {
        title: title.trim(),
        travel_request_id: tripId === NONE ? null : tripId,
      };
      const created = await post<ExpenseReport>("/expenses/reports", body);
      toast.success(`Report "${created.title}" created`, {
        description: "Pick it when you add a claim to include that claim.",
      });
      setOpen(false);
      reset();
      onCreated();
    } catch (caught) {
      setError(errorDetail(caught, "Could not create the report."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSaving) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <FolderPlus /> New report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New expense report</DialogTitle>
          <DialogDescription>
            A report groups claims, usually from one trip, so they are submitted and approved together.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="report-title">Title</Label>
            <Input
              id="report-title"
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Client visit, Pune"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="report-trip">
              Trip <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Select value={tripId} onValueChange={setTripId}>
              <SelectTrigger id="report-trip" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not linked to a trip</SelectItem>
                {usableTrips.map((trip) => (
                  <SelectItem key={trip.id} value={trip.id}>
                    {trip.purpose} ({formatDateRange(trip.from_date, trip.to_date)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Create report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
