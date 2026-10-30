"use client";

import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { apiMessage } from "@/components/people/labels";
import { SECTION_TITLE, WHY_HR } from "@/components/people/profile/labels";
import {
  ADDRESS_FIELDS,
  BANK_FIELDS,
  EDUCATION_FIELDS,
  EMERGENCY_FIELDS,
  EXPERIENCE_FIELDS,
  FAMILY_FIELDS,
  IDENTITY_FIELDS,
  NOMINEE_FIELDS,
  PERSONAL_FIELDS,
  STATUTORY_FIELDS,
} from "@/components/people/profile/sectionSpecs";
import {
  type FieldSpec,
  type FieldValues,
  SpecFields,
  blankValues,
  fieldErrors,
  toFieldValues,
  toPayload,
} from "@/components/people/profile/SpecFields";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { post, put } from "@/lib/api";
import type {
  ChangeRequest,
  EmployeeProfile,
  EmployeeRecord,
  ProfileSection,
  SectionWrite,
} from "@/lib/types/people";

/** How the dialog saves: straight onto the record, or as a request HR decides. */
export type EditMode = "self-direct" | "self-request" | "hr";

const LIST_SECTIONS: Partial<Record<ProfileSection, { specs: FieldSpec[]; max: number; noun: string }>> = {
  emergency_contacts: { specs: EMERGENCY_FIELDS, max: 5, noun: "contact" },
  family_members: { specs: FAMILY_FIELDS, max: 20, noun: "family member" },
  nominees: { specs: NOMINEE_FIELDS, max: 20, noun: "nominee" },
  education: { specs: EDUCATION_FIELDS, max: 20, noun: "qualification" },
  previous_employment: { specs: EXPERIENCE_FIELDS, max: 20, noun: "employer" },
};

const OBJECT_SECTIONS: Partial<Record<ProfileSection, FieldSpec[]>> = {
  identity: IDENTITY_FIELDS,
  personal: PERSONAL_FIELDS,
  statutory: STATUTORY_FIELDS,
  bank_account: BANK_FIELDS,
};

type Draft = {
  record: FieldValues;
  rows: FieldValues[];
  /**
   * Each row as stored, so a save keeps what the form does not show (a
   * relationship in the old system's words, say). Null for a row added here.
   */
  origins: (Record<string, unknown> | null)[];
  current: FieldValues;
  permanent: FieldValues;
  sameAsCurrent: boolean;
};

function initialDraft(
  section: ProfileSection,
  profile: EmployeeProfile,
  employee: EmployeeRecord,
  mode: EditMode,
): Draft {
  const draft: Draft = {
    record: {},
    rows: [],
    origins: [],
    current: blankValues(ADDRESS_FIELDS),
    permanent: blankValues(ADDRESS_FIELDS),
    sameAsCurrent: profile.addresses.permanent_same_as_current,
  };
  const list = LIST_SECTIONS[section];
  if (list) {
    const stored = profile[section as keyof EmployeeProfile] as unknown as Record<string, unknown>[];
    draft.rows = stored.map((row) => toFieldValues(list.specs, row));
    draft.origins = stored.map((row) => ({ ...row }));
    return draft;
  }
  if (section === "addresses") {
    draft.current = toFieldValues(ADDRESS_FIELDS, profile.addresses.current as never);
    draft.permanent = toFieldValues(ADDRESS_FIELDS, profile.addresses.permanent as never);
    return draft;
  }
  if (section === "identity") {
    draft.record = toFieldValues(IDENTITY_FIELDS, employee as never);
  } else if (section === "personal") {
    draft.record = toFieldValues(PERSONAL_FIELDS, profile.personal as never);
  } else if (section === "statutory") {
    // HR edits identifiers in place. An employee types only what changes; the
    // value on file shows as a hint.
    draft.record =
      mode === "hr" && !profile.statutory.masked
        ? toFieldValues(STATUTORY_FIELDS, {
            ...profile.statutory,
            // The full number when it is on file; a last-four-only record starts blank.
            aadhaar: profile.statutory.aadhaar_full ? (profile.statutory.aadhaar ?? "").replace(/\D/g, "") : null,
          } as never)
        : blankValues(STATUTORY_FIELDS);
  } else if (section === "bank_account") {
    draft.record = {
      ...blankValues(BANK_FIELDS),
      account_holder_name:
        profile.bank_account?.account_holder_name ??
        [employee.first_name, employee.last_name].filter(Boolean).join(" "),
    };
  }
  return draft;
}

function clean(value: string | boolean): string {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/\s/g, "") : "";
}

/**
 * Edit one profile section.
 *
 * Three ways it saves, decided by who is looking and what the section is:
 * the employee's own non-sensitive sections go straight onto the record; their
 * sensitive ones go to HR as a change request with a reason; HR editing
 * somebody else writes directly. The server enforces the same split.
 */
export function SectionEditDialog({
  open,
  onOpenChange,
  section,
  mode,
  profile,
  employee,
  onSaved,
  onRequested,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: ProfileSection | null;
  mode: EditMode;
  profile: EmployeeProfile;
  employee: EmployeeRecord;
  onSaved: (profile: EmployeeProfile) => void;
  onRequested: (request: ChangeRequest) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !section) return;
    setDraft(initialDraft(section, profile, employee, mode));
    setErrors({});
    setReason("");
    setServerError(null);
  }, [open, section, profile, employee, mode]);

  if (!section || !draft) return null;
  const list = LIST_SECTIONS[section];
  const specs = OBJECT_SECTIONS[section];
  const isRequest = mode === "self-request";

  const build = (): { write: SectionWrite | null; found: Record<string, string> } => {
    const found: Record<string, string> = {};
    if (list) {
      draft.rows.forEach((row, index) => {
        for (const [key, message] of Object.entries(fieldErrors(list.specs, row))) {
          found[`${index}.${key}`] = message;
        }
      });
      const data = draft.rows.map((row, index) => {
        const origin = draft.origins[index] ?? {};
        const next: Record<string, unknown> = { ...origin, ...toPayload(list.specs, row) };
        // The old system's word only describes the value it came with.
        if (next.relationship !== origin.relationship) next.relationship_text = null;
        if (next.purpose !== origin.purpose) next.purpose_text = null;
        return next;
      });
      return { write: { section, data } as SectionWrite, found };
    }
    if (section === "addresses") {
      const hasCurrent = Object.values(draft.current).some((v) => typeof v === "string" && v.trim());
      const hasPermanent =
        !draft.sameAsCurrent &&
        Object.values(draft.permanent).some((v) => typeof v === "string" && v.trim());
      if (hasCurrent) {
        for (const [key, message] of Object.entries(fieldErrors(ADDRESS_FIELDS, draft.current))) {
          found[`current.${key}`] = message;
        }
      }
      if (hasPermanent) {
        for (const [key, message] of Object.entries(fieldErrors(ADDRESS_FIELDS, draft.permanent))) {
          found[`permanent.${key}`] = message;
        }
      }
      if (draft.sameAsCurrent && !hasCurrent) {
        found["current.line1"] = "Enter the current address first.";
      }
      const address = (values: FieldValues) => ({ ...toPayload(ADDRESS_FIELDS, values), country_code: "IN" });
      return {
        write: {
          section: "addresses",
          data: {
            current: hasCurrent ? (address(draft.current) as never) : null,
            permanent: hasPermanent ? (address(draft.permanent) as never) : null,
            permanent_same_as_current: draft.sameAsCurrent,
          },
        },
        found,
      };
    }
    if (section === "statutory" && specs) {
      // Only what was typed or changed is sent; the rest of the record stays.
      const data: Record<string, string | null> = {};
      const onFile = profile.statutory;
      for (const spec of specs) {
        const typed = clean(draft.record[spec.key]);
        if (spec.pattern && typed && !spec.pattern.test(typed)) {
          found[spec.key] = spec.patternMessage ?? "Check this value.";
        }
        const current = spec.key === "aadhaar" ? null : (onFile[spec.key as keyof typeof onFile] as string | null);
        if (mode === "hr" && !onFile.masked) {
          if (spec.key === "aadhaar") {
            const fullOnFile = onFile.aadhaar_full ? (onFile.aadhaar ?? "").replace(/\D/g, "") : null;
            if (onFile.aadhaar_full ? (typed || null) !== fullOnFile : typed) data.aadhaar = typed || null;
          } else if ((typed || null) !== (current || null)) {
            data[spec.key] = typed || null;
          }
        } else if (typed) {
          data[spec.key] = typed;
        }
      }
      if (Object.keys(data).length === 0 && Object.keys(found).length === 0) {
        found.pan = "Enter at least one identifier to change.";
      }
      return { write: { section: "statutory", data }, found };
    }
    if (specs) {
      Object.assign(found, fieldErrors(specs, draft.record));
      const data = toPayload(specs, draft.record);
      if (section === "bank_account") {
        data.ifsc = clean(draft.record.ifsc);
        data.account_number = clean(draft.record.account_number);
      }
      return { write: { section, data } as SectionWrite, found };
    }
    return { write: null, found };
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const { write, found } = build();
    if (isRequest && reason.trim().length < 3) found.reason = "Say briefly why this is changing.";
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length || !write) return;

    setIsSaving(true);
    try {
      if (isRequest) {
        const request = await post<ChangeRequest>("/employees/me/change-requests", {
          change: write,
          reason: reason.trim(),
        });
        toast.success("Sent to HR. You will be notified when it is decided.");
        onRequested(request);
      } else {
        const path = mode === "hr" ? `/employees/${employee.id}/profile` : "/employees/me/profile";
        const saved = await put<EmployeeProfile>(path, { change: write });
        toast.success(`${SECTION_TITLE[section]} saved`);
        onSaved(saved);
      }
      onOpenChange(false);
    } catch (error) {
      setServerError(apiMessage(error, "The change could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  const statutoryHints: Record<string, string | undefined> =
    section === "statutory"
      ? {
          pan: profile.statutory.pan ? `On file: ${profile.statutory.pan}` : "Not on file.",
          uan: profile.statutory.uan ? `On file: ${profile.statutory.uan}` : "Not on file.",
          aadhaar: profile.statutory.aadhaar
            ? profile.statutory.aadhaar_full
              ? `On file: ${profile.statutory.aadhaar}`
              : `Only the last four are on file (${profile.statutory.aadhaar.slice(-4)}).`
            : "Not on file.",
          pf_number: profile.statutory.pf_number ? `On file: ${profile.statutory.pf_number}` : "Not on file.",
          esi_number: profile.statutory.esi_number ? `On file: ${profile.statutory.esi_number}` : "Not on file.",
        }
      : {};

  const setRow = (index: number, next: FieldValues) =>
    setDraft({ ...draft, rows: draft.rows.map((row, i) => (i === index ? next : row)) });

  const rowErrors = (index: number) =>
    Object.fromEntries(
      Object.entries(errors)
        .filter(([key]) => key.startsWith(`${index}.`))
        .map(([key, message]) => [key.slice(String(index).length + 1), message]),
    );

  const prefixed = (prefix: string) =>
    Object.fromEntries(
      Object.entries(errors)
        .filter(([key]) => key.startsWith(`${prefix}.`))
        .map(([key, message]) => [key.slice(prefix.length + 1), message]),
    );

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="grid gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>
              {isRequest ? `Request a change: ${SECTION_TITLE[section].toLowerCase()}` : SECTION_TITLE[section]}
            </DialogTitle>
            <DialogDescription>
              {isRequest
                ? `${WHY_HR[section] ?? ""} HR checks it before it changes your record.`
                : mode === "hr"
                  ? `Saved straight onto ${employee.first_name}'s record and written to the audit log.`
                  : "Saved straight onto your record."}
            </DialogDescription>
          </DialogHeader>

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {specs && (
            <SpecFields
              idPrefix={`edit-${section}`}
              specs={specs}
              values={draft.record}
              onChange={(record) => setDraft({ ...draft, record })}
              errors={errors}
              hints={statutoryHints}
            />
          )}

          {section === "addresses" && (
            <div className="grid gap-4">
              <p className="text-sm font-semibold text-foreground">Current address</p>
              <SpecFields
                idPrefix="edit-current"
                specs={ADDRESS_FIELDS}
                values={draft.current}
                onChange={(current) => setDraft({ ...draft, current })}
                errors={prefixed("current")}
              />
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="edit-same-address">Permanent address is the same</Label>
                <Switch
                  id="edit-same-address"
                  checked={draft.sameAsCurrent}
                  onCheckedChange={(sameAsCurrent) => setDraft({ ...draft, sameAsCurrent })}
                />
              </div>
              {!draft.sameAsCurrent && (
                <>
                  <p className="text-sm font-semibold text-foreground">Permanent address</p>
                  <SpecFields
                    idPrefix="edit-permanent"
                    specs={ADDRESS_FIELDS}
                    values={draft.permanent}
                    onChange={(permanent) => setDraft({ ...draft, permanent })}
                    errors={prefixed("permanent")}
                  />
                </>
              )}
            </div>
          )}

          {list && (
            <div className="grid gap-4">
              {draft.rows.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nothing recorded. Add a {list.noun} below, or save to leave it empty.
                </p>
              )}
              {draft.rows.map((row, index) => (
                <div key={index} className="grid gap-3 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      {list.noun.charAt(0).toUpperCase() + list.noun.slice(1)} {index + 1}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          rows: draft.rows.filter((_, i) => i !== index),
                          origins: draft.origins.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <Trash2 /> Remove
                    </Button>
                  </div>
                  <SpecFields
                    idPrefix={`edit-${section}-${index}`}
                    specs={list.specs}
                    values={row}
                    onChange={(next) => setRow(index, next)}
                    errors={rowErrors(index)}
                  />
                </div>
              ))}
              {draft.rows.length < list.max && (
                <Button
                  type="button"
                  variant="outline"
                  className="justify-self-start"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      rows: [...draft.rows, blankValues(list.specs)],
                      origins: [...draft.origins, null],
                    })
                  }
                >
                  <Plus /> Add {list.noun}
                </Button>
              )}
            </div>
          )}

          {isRequest && (
            <FormField htmlFor="edit-reason" label="Reason for the change" error={errors.reason}>
              <Textarea
                id="edit-reason"
                value={reason}
                maxLength={1000}
                placeholder="For example: new PAN card issued, moved house, account closed."
                onChange={(event) => setReason(event.target.value)}
              />
            </FormField>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : isRequest ? <Send /> : null}
              {isRequest ? "Send to HR" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
