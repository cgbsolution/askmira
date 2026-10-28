"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { GENDER, NONE, apiMessage, fromSelect } from "@/components/people/labels";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { patch } from "@/lib/api";
import type { EmployeeRecord, Gender } from "@/lib/types/people";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+\-() ]*$/;

/**
 * Display name, personal email and phone (and, for HR, gender).
 *
 * `asHr` edits somebody else's record straight away through HR's update; without
 * it this is self-service on your own record, where gender is not offered.
 */
export function ContactDetailsDialog({
  open,
  onOpenChange,
  record,
  onSaved,
  asHr = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: EmployeeRecord;
  onSaved: (record: EmployeeRecord) => void;
  asHr?: boolean;
}) {
  const [displayName, setDisplayName] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<string>(NONE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDisplayName(record.display_name ?? "");
    setPersonalEmail(record.personal_email ?? "");
    setPhone(record.phone ?? "");
    setGender(record.gender ?? NONE);
    setErrors({});
    setServerError(null);
  }, [open, record]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    const found: Record<string, string> = {};
    if (personalEmail.trim() && !EMAIL.test(personalEmail.trim())) {
      found.personalEmail = "Enter a valid email, or leave it blank.";
    }
    if (!PHONE.test(phone)) found.phone = "Digits, spaces, +, - and brackets only.";
    setErrors(found);
    if (Object.keys(found).length) return;

    // Only what changed is sent: an odd value already on file (an imported email,
    // say) must not block saving a different field, and the audit row stays exact.
    const next: Record<string, unknown> = {
      display_name: displayName.trim() || null,
      personal_email: personalEmail.trim() || null,
      phone: phone.trim() || null,
    };
    if (asHr) next.gender = fromSelect(gender) as Gender | null;
    const body = Object.fromEntries(
      Object.entries(next).filter(
        ([key, value]) => value !== ((record as unknown as Record<string, unknown>)[key] ?? null),
      ),
    );
    if (Object.keys(body).length === 0) {
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    setServerError(null);
    try {
      const saved = await patch<EmployeeRecord>(
        asHr ? `/employees/${record.id}` : "/employees/me",
        body,
      );
      toast.success("Contact details updated");
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      setServerError(apiMessage(error, "The contact details could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  const first = record.display_name || record.first_name;

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Edit contact details</DialogTitle>
            <DialogDescription>
              {asHr
                ? `Saved straight onto ${first}'s record and written to the audit log.`
                : "Your role, grade, manager and pay are changed by HR, not here."}
            </DialogDescription>
          </DialogHeader>
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          <FormField htmlFor="contact-display" label="Display name" optional>
            <Input id="contact-display" value={displayName} maxLength={255} onChange={(e) => setDisplayName(e.target.value)} />
          </FormField>
          <FormField htmlFor="contact-email" label="Personal email" optional error={errors.personalEmail}>
            <Input id="contact-email" type="email" value={personalEmail} maxLength={255} onChange={(e) => {
                setPersonalEmail(e.target.value);
                setErrors(({ personalEmail: _gone, ...rest }) => rest);
              }}
            />
          </FormField>
          <FormField htmlFor="contact-phone" label="Phone" optional error={errors.phone}>
            <Input
              id="contact-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              maxLength={32}
              onChange={(e) => {
                const next = e.target.value;
                // Letters never land in the box; a pasted number keeps its digits.
                setPhone(PHONE.test(next) ? next : next.replace(/[^0-9+\-() ]/g, ""));
              }}
            />
          </FormField>
          {asHr && (
            <FormField htmlFor="contact-gender" label="Gender" optional>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger id="contact-gender" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not recorded</SelectItem>
                  {(Object.keys(GENDER) as Gender[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {GENDER[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
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
