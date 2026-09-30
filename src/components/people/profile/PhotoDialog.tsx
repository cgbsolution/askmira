"use client";

import { Loader2, Trash2, Upload } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { apiMessage } from "@/components/people/labels";
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
import { Input } from "@/components/ui/input";
import { api, del } from "@/lib/api";
import type { EmployeeRecord } from "@/lib/types/people";

const MAX_BYTES = 5 * 1024 * 1024;

/** Upload or remove a profile photo. Yours, or — for HR — somebody else's. */
export function PhotoDialog({
  open,
  onOpenChange,
  employee,
  isSelf,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeRecord;
  isSelf: boolean;
  onSaved: (employee: EmployeeRecord) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setError(null);
  }, [open]);

  const path = isSelf ? "/employees/me/photo" : `/employees/${employee.id}/photo`;

  const upload = async () => {
    if (!file) {
      setError("Choose a PNG or JPEG image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("The image is larger than 5 MB.");
      return;
    }
    const form = new FormData();
    form.set("file", file);
    setIsSaving(true);
    setError(null);
    try {
      const saved = await api<EmployeeRecord>(path, { method: "PUT", body: form, timeout: 60_000 });
      toast.success("Photo updated");
      onSaved(saved);
      onOpenChange(false);
    } catch (caught) {
      setError(apiMessage(caught, "The photo could not be uploaded."));
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const saved = await del<EmployeeRecord>("/employees/me/photo");
      toast.success("Photo removed");
      onSaved(saved);
      onOpenChange(false);
    } catch (caught) {
      setError(apiMessage(caught, "The photo could not be removed."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile photo</DialogTitle>
          <DialogDescription>
            PNG or JPEG up to 5 MB. Colleagues see it beside the name in the directory.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <FormField htmlFor="photo-file" label="Image">
          <Input
            id="photo-file"
            type="file"
            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </FormField>
        <DialogFooter className="sm:justify-between">
          {isSelf && employee.photo_url ? (
            <Button variant="ghost" disabled={isSaving} onClick={() => void remove()}>
              <Trash2 /> Remove photo
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={isSaving} onClick={() => void upload()}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Upload />}
              Upload
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
