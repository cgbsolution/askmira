"use client";

import { Loader2, Paperclip } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError, downloadFile } from "@/lib/api";

/**
 * Open a leave request's supporting document. The download goes through the
 * API, which checks the viewer may see it and records that they did.
 */
export function LeaveDocumentButton({
  requestId,
  compact = false,
}: {
  requestId: string;
  compact?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const open = async () => {
    setIsLoading(true);
    try {
      await downloadFile(`/leave/requests/${requestId}/document`, "leave-document");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not open the document.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon-sm" : "sm"}
      disabled={isLoading}
      onClick={() => void open()}
      aria-label="Open the supporting document"
    >
      {isLoading ? <Loader2 className="animate-spin" /> : <Paperclip />}
      {!compact && "Document"}
    </Button>
  );
}
