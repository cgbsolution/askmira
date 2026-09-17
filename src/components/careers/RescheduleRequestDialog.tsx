"use client";

import { Loader2 } from "lucide-react";
import React, { useState } from "react";

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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, post } from "@/lib/api";

type RescheduleResponse = { requested: boolean; recruiter_told: boolean; message: string };

/** The candidate asks the recruiter for a different interview time; nothing moves on its own. */
export function RescheduleRequestDialog({
  token,
  interviewId,
  stageName,
}: {
  token: string;
  interviewId: string;
  stageName: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    const cleaned = reason.trim();
    if (cleaned.length < 5) {
      setError("Tell the recruiter briefly why, in at least 5 characters.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const result = await post<RescheduleResponse>(
        `/public/candidate/${encodeURIComponent(token)}/interviews/${encodeURIComponent(interviewId)}/reschedule-request`,
        { reason: cleaned },
        { skipAuthRedirect: true },
      );
      setMessage(result.message);
      setOpen(false);
      setReason("");
    } catch (caught) {
      setServerError(
        caught instanceof ApiError ? caught.detail : "Your request could not be sent. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            Request a different time
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={submit} noValidate className="space-y-4">
            <DialogHeader>
              <DialogTitle>Request a different time</DialogTitle>
              <DialogDescription>
                Your request for “{stageName}” goes to the recruiter. The interview stays as
                scheduled until they confirm a new time.
              </DialogDescription>
            </DialogHeader>
            <FormField htmlFor={`reschedule-${interviewId}`} label="Reason *" error={error}>
              <Textarea
                id={`reschedule-${interviewId}`}
                value={reason}
                maxLength={1000}
                rows={4}
                aria-invalid={Boolean(error)}
                onChange={(event) => setReason(event.target.value)}
              />
            </FormField>
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Send request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {message && (
        <Alert variant="success">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
