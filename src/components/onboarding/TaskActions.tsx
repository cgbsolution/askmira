"use client";

import { Check, Download, FileText, Loader2, ShieldCheck, Upload, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { documentTypeLabel } from "@/components/onboarding/shared";
import { apiErrorMessage, InlineProblem, toastApiError } from "@/components/payroll-ops/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { downloadFile, post } from "@/lib/api";
import type { OnboardingTask } from "@/lib/types/onboarding";

/** The vault takes PDF, PNG and JPEG, checked again from the bytes on the server. */
const ACCEPT = "application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg";
const MAX_BYTES = 10 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * What the caller can do with one task, as the API said (`can_complete`):
 * upload the document, give the acknowledgement, or mark it done with a note.
 */
export function TaskActions({
  task,
  onChanged,
  size = "sm",
}: {
  task: OnboardingTask;
  onChanged: (task: OnboardingTask) => void;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);

  if (!task.can_complete) return null;

  const label =
    task.task_type === "document_upload"
      ? "Upload"
      : task.task_type === "acknowledge_policy"
        ? "Acknowledge"
        : "Mark done";
  const Icon =
    task.task_type === "document_upload"
      ? Upload
      : task.task_type === "acknowledge_policy"
        ? ShieldCheck
        : Check;

  return (
    <>
      <Button
        size={size}
        variant={task.is_overdue ? "accent" : "default"}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Icon /> {label}
      </Button>
      {open && (
        <CompleteTaskDialog
          task={task}
          onClose={() => setOpen(false)}
          onDone={(next) => {
            setOpen(false);
            onChanged(next);
          }}
        />
      )}
    </>
  );
}

function CompleteTaskDialog({
  task,
  onClose,
  onDone,
}: {
  task: OnboardingTask;
  onClose: () => void;
  onDone: (task: OnboardingTask) => void;
}) {
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const isUpload = task.task_type === "document_upload";
  const isAck = task.task_type === "acknowledge_policy";
  const blocked = (isUpload && (!file || Boolean(fileProblem))) || (isAck && !accepted);

  const submit = async () => {
    setTouched(true);
    if (blocked) return;
    setIsBusy(true);
    setError(null);
    try {
      let next: OnboardingTask;
      if (isUpload && file) {
        const form = new FormData();
        form.append("file", file);
        next = await post<OnboardingTask>(`/onboarding/tasks/${task.id}/document`, form);
        toast.success(`${task.title}: uploaded`);
      } else {
        next = await post<OnboardingTask>(`/onboarding/tasks/${task.id}/complete`, {
          note: note.trim() || null,
        });
        toast.success(isAck ? "Acknowledged" : `${task.title}: done`);
      }
      onDone(next);
    } catch (caught) {
      setError(apiErrorMessage(caught, "This could not be saved."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && !isBusy && onClose()}>
      <DialogContent className="sm:max-w-md" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
          <DialogDescription>
            {isUpload
              ? `A PDF, PNG or JPEG, up to 10 MB. It is filed in the document vault under ${documentTypeLabel(task.document_type).toLowerCase()}, where HR verifies it.`
              : isAck
                ? "Only you can give this acknowledgement. It is recorded with your name and the time."
                : "Mark this task done. A note helps whoever reads the checklist next."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {task.description && (
            <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              {task.description}
            </p>
          )}

          {isUpload && (
            <FormField
              htmlFor="onboarding-upload"
              label="File"
              error={
                fileProblem ?? (touched && !file ? "Choose the file to upload." : null)
              }
            >
              {file ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatBytes(file.size)}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove file"
                    disabled={isBusy}
                    onClick={() => {
                      setFile(null);
                      setFileProblem(null);
                      setInputKey((current) => current + 1);
                    }}
                  >
                    <X />
                  </Button>
                </div>
              ) : (
                <Input
                  key={inputKey}
                  id="onboarding-upload"
                  type="file"
                  accept={ACCEPT}
                  disabled={isBusy}
                  onChange={(event) => {
                    const chosen = event.target.files?.[0] ?? null;
                    setFile(chosen);
                    setFileProblem(
                      chosen && chosen.size > MAX_BYTES
                        ? `This file is ${formatBytes(chosen.size)}; the limit is 10 MB.`
                        : null,
                    );
                  }}
                />
              )}
            </FormField>
          )}

          {isAck && (
            <div className="flex items-start gap-3 rounded-md border border-border p-3">
              <Checkbox
                id="onboarding-ack"
                checked={accepted}
                disabled={isBusy}
                aria-invalid={touched && !accepted}
                onCheckedChange={(value) => setAccepted(value === true)}
              />
              <Label htmlFor="onboarding-ack" className="text-sm leading-snug font-normal">
                I have read and understood this, and I accept it.
              </Label>
            </div>
          )}

          {!isUpload && (
            <FormField htmlFor="onboarding-note" label="Note" optional>
              <Textarea
                id="onboarding-note"
                rows={3}
                maxLength={2000}
                value={note}
                disabled={isBusy}
                onChange={(event) => setNote(event.target.value)}
              />
            </FormField>
          )}

          {touched && isAck && !accepted && (
            <InlineProblem>Tick the box to give the acknowledgement.</InlineProblem>
          )}
          {error && <InlineProblem>{error}</InlineProblem>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={() => void submit()}>
            {isBusy && <Loader2 className="animate-spin" />}
            {isUpload ? "Upload" : isAck ? "Acknowledge" : "Mark done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The file a document task collected, downloaded through the API. */
export function TaskDocumentButton({ task }: { task: OnboardingTask }) {
  const [isBusy, setIsBusy] = useState(false);
  if (!task.document_id) return null;
  return (
    <Button
      variant="link"
      size="sm"
      className="h-auto px-0"
      disabled={isBusy}
      onClick={async (event) => {
        event.stopPropagation();
        setIsBusy(true);
        try {
          await downloadFile(
            `/onboarding/tasks/${task.id}/document`,
            task.document_title ?? task.title,
          );
        } catch (caught) {
          toastApiError(caught, "The document could not be downloaded.");
        } finally {
          setIsBusy(false);
        }
      }}
    >
      {isBusy ? <Loader2 className="animate-spin" /> : <Download />}
      {task.document_title ?? "Uploaded document"}
    </Button>
  );
}
