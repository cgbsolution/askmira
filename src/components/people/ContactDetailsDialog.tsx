"use client";

import { Loader2 } from "lucide-react";
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
import { patch } from "@/lib/api";
import type { EmployeeRecord } from "@/lib/types/people";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+\-() ]*$/;

/** Self-service: your own display name, personal email and phone. Nothing else. */
export function ContactDetailsDialog({
  open,
  onOpenChange,
  record,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: EmployeeRecord;
  onSaved: (record: EmployeeRecord) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDisplayName(record.display_name ?? "");
    setPersonalEmail(record.personal_email ?? "");
    setPhone(record.phone ?? "");
    setErrors({});
    setServerError(null);
  }, [open, record]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (personalEmail.trim() && !EMAIL.test(personalEmail.trim())) {
      found.personalEmail = "Enter a valid email, or leave it blank.";
    }
    if (!PHONE.test(phone)) found.phone = "Digits, spaces, +, - and brackets only.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setIsSaving(true);
    setServerError(null);
    try {
      const saved = await patch<EmployeeRecord>("/employees/me", {
        display_name: displayName.trim() || null,
        personal_email: personalEmail.trim() || null,
        phone: phone.trim() || null,
      });
      toast.success("Contact details updated");
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      setServerError(apiMessage(error, "Your details could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Edit contact details</DialogTitle>
            <DialogDescription>
              Your role, grade, manager and pay are changed by HR, not here.
            </DialogDescription>
          </DialogHeader>
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          <FormField htmlFor="self-display" label="Display name" optional>
            <Input id="self-display" value={displayName} maxLength={255} onChange={(e) => setDisplayName(e.target.value)} />
          </FormField>
          <FormField htmlFor="self-email" label="Personal email" optional error={errors.personalEmail}>
            <Input id="self-email" type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} />
          </FormField>
          <FormField htmlFor="self-phone" label="Phone" optional error={errors.phone}>
            <Input id="self-phone" type="tel" value={phone} maxLength={32} onChange={(e) => setPhone(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
