"use client";

import React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReferralProgramme, ShareChannel } from "@/lib/types/hiring";

export const SHARE_CHANNELS: { value: ShareChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "email", label: "Email" },
  { value: "copy", label: "Copied link" },
];

/** Pick how a referral was (or will be) shared. `none` means not said. */
export function ReferralChannelSelect({
  id,
  value,
  onChange,
  allowNone = false,
}: {
  id: string;
  value: ShareChannel | "none";
  onChange: (value: ShareChannel | "none") => void;
  allowNone?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as ShareChannel | "none")}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Choose a channel" />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="none">Not specified</SelectItem>}
        {SHARE_CHANNELS.map((channel) => (
          <SelectItem key={channel.value} value={channel.value}>
            {channel.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Pick one of several running programmes. Rendered only when there is a choice. */
export function ReferralProgrammeSelect({
  id,
  programmes,
  value,
  onChange,
}: {
  id: string;
  programmes: ReferralProgramme[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Choose a programme" />
      </SelectTrigger>
      <SelectContent>
        {programmes.map((programme) => (
          <SelectItem key={programme.id} value={programme.id}>
            {programme.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
