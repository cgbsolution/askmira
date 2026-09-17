"use client";

import { UserPlus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { BoardFormDialog } from "@/components/hiring/BoardFormDialog";
import {
  ReferralChannelSelect,
  ReferralProgrammeSelect,
} from "@/components/hiring/ReferralChannelSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, post } from "@/lib/api";
import type { OpenRole, ReferralProgramme, ReferResult, ShareChannel } from "@/lib/types/hiring";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+()\-\s]{6,32}$/;

type Errors = Partial<Record<"programme" | "name" | "email" | "phone", string>>;

/**
 * Refer somebody into one open role, in your own name.
 *
 * The server decides eligibility and duplicates; a refusal (400) is shown
 * exactly as it was given, and the success toast says whether somebody else
 * referred this person first.
 */
export function ReferralFormDialog({
  role,
  programmes,
  onReferred,
}: {
  role: OpenRole;
  programmes: ReferralProgramme[];
  onReferred: () => void;
}) {
  const single = programmes.length === 1 ? programmes[0].id : "";
  const [programmeId, setProgrammeId] = useState(single);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<ShareChannel | "none">("none");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const reset = () => {
    setProgrammeId(single);
    setName("");
    setEmail("");
    setPhone("");
    setChannel("none");
    setNote("");
    setErrors({});
  };

  const submit = async (): Promise<boolean> => {
    const next: Errors = {};
    if (!programmeId) next.programme = "Choose a programme.";
    if (!name.trim()) next.name = "Enter the candidate's name.";
    if (!email.trim()) next.email = "Enter the candidate's email.";
    else if (!EMAIL.test(email.trim())) next.email = "This does not look like an email address.";
    if (phone.trim() && !PHONE.test(phone.trim())) {
      next.phone = "Use digits, spaces, +, ( ) or - only (6 to 32 characters).";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return false;

    try {
      const result = await post<ReferResult>("/recruiting/refer", {
        programme_id: programmeId,
        requisition_id: role.id,
        candidate_name: name.trim(),
        candidate_email: email.trim(),
        candidate_phone: phone.trim() || null,
        channel: channel === "none" ? null : channel,
        note: note.trim() || null,
      });
      if (result.duplicate.is_duplicate) {
        toast.warning(`Referral recorded for ${result.role.title}`, {
          description:
            "This person had already been referred by someone else, so the referral is marked as a duplicate.",
        });
      } else {
        toast.success(`Referral submitted for ${result.role.title}`, {
          description:
            result.eligibility.message ??
            "Nobody had referred this person before, so you are recorded as the referrer.",
        });
      }
      onReferred();
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not submit the referral.");
      return false;
    }
  };

  return (
    <BoardFormDialog
      trigger={
        <Button size="sm">
          <UserPlus /> Refer someone
        </Button>
      }
      title={`Refer someone for ${role.title}`}
      description={`${role.code}${role.department ? ` · ${role.department}` : ""}. The referral is made in your name.`}
      submitLabel="Submit referral"
      onSubmit={submit}
      onClosed={reset}
    >
      {programmes.length > 1 && (
        <FormField htmlFor="refer-programme" label="Programme" error={errors.programme}>
          <ReferralProgrammeSelect
            id="refer-programme"
            programmes={programmes}
            value={programmeId}
            onChange={setProgrammeId}
          />
        </FormField>
      )}
      <FormField htmlFor="refer-name" label="Candidate name" error={errors.name}>
        <Input
          id="refer-name"
          value={name}
          maxLength={255}
          required
          onChange={(event) => setName(event.target.value)}
        />
      </FormField>
      <FormField htmlFor="refer-email" label="Candidate email" error={errors.email}>
        <Input
          id="refer-email"
          type="email"
          value={email}
          maxLength={320}
          required
          onChange={(event) => setEmail(event.target.value)}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="refer-phone" label="Phone" optional error={errors.phone}>
          <Input
            id="refer-phone"
            type="tel"
            value={phone}
            maxLength={32}
            onChange={(event) => setPhone(event.target.value)}
          />
        </FormField>
        <FormField htmlFor="refer-channel" label="How you reached them" optional>
          <ReferralChannelSelect id="refer-channel" value={channel} onChange={setChannel} allowNone />
        </FormField>
      </div>
      <FormField htmlFor="refer-note" label="Note for the recruiter" optional>
        <Textarea
          id="refer-note"
          value={note}
          rows={3}
          maxLength={1000}
          onChange={(event) => setNote(event.target.value)}
        />
      </FormField>
    </BoardFormDialog>
  );
}
