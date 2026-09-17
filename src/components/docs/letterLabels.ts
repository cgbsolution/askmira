import type { LetterCategory, LetterStatus } from "@/lib/types/docs";

type BadgeVariant = "success" | "warning" | "muted" | "outline" | "destructive" | "secondary" | "accent";

export const LETTER_CATEGORY: Record<LetterCategory, string> = {
  offer: "Offer",
  appointment: "Appointment",
  confirmation: "Confirmation",
  transfer: "Transfer",
  promotion: "Promotion",
  relieving: "Relieving",
  experience: "Experience",
  salary_certificate: "Salary certificate",
  warning: "Warning",
  pip: "Improvement plan",
  custom: "Custom",
};

export const LETTER_STATUS: Record<LetterStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "outline" },
  pending_approval: { label: "Awaiting approval", variant: "warning" },
  approved: { label: "Approved", variant: "secondary" },
  sent: { label: "Sent for signature", variant: "accent" },
  signed: { label: "Signed", variant: "success" },
  revoked: { label: "Revoked", variant: "destructive" },
};

export function letterFileName(reference: string, signed = false): string {
  return `${reference.replace(/\//g, "_")}${signed ? "-signed" : ""}.pdf`;
}
