"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ApiError, del, patch, post } from "@/lib/api";
import { INDIAN_STATES } from "@/lib/states";
import type { WelcomeEmail } from "@/lib/types/admin";

export interface Issued {
  title: string;
  email: string;
  password: string;
  /** For a new admin: what became of their welcome email. */
  welcome?: WelcomeEmail | null;
}

const COMPANY_TYPES: Record<string, string> = {
  private_limited: "Private limited company",
  public_limited: "Public limited company",
  llp: "Limited liability partnership (LLP)",
  partnership: "Partnership firm",
  proprietorship: "Sole proprietorship",
  opc: "One person company (OPC)",
  trust_society: "Trust or society",
  government: "Government or PSU",
  other: "Other",
};

const SIZES = ["1-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"];

const MODULES: Record<string, { label: string; on: boolean }> = {
  core_hr: { label: "Core HR", on: true },
  leave: { label: "Leave & attendance", on: true },
  payroll: { label: "Payroll", on: true },
  culture: { label: "Culture", on: true },
  hiring: { label: "Hiring", on: true },
  analytics: { label: "Analytics", on: false },
  benefits: { label: "Benefits", on: false },
  rewards: { label: "Rewards", on: false },
};

const EMPTY = {
  company_name: "",
  legal_name: "",
  workspace: "",
  company_type: "private_limited",
  industry: "",
  company_size: "",
  website: "",
  contact_email: "",
  contact_phone: "",
  pan: "",
  tan: "",
  gstin: "",
  cin: "",
  pf_registration_no: "",
  esi_registration_no: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state_code: "",
  pincode: "",
  admin_full_name: "",
  admin_email: "",
  admin_phone: "",
  admin_designation: "",
};

type Fields = typeof EMPTY;

/** A company's details as the platform API returns them, for editing. */
export interface CompanyDetails {
  company_name: string;
  legal_name: string | null;
  company_type: string | null;
  industry: string | null;
  company_size: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  pan: string | null;
  tan: string | null;
  gstin: string | null;
  cin: string | null;
  pf_registration_no: string | null;
  esi_registration_no: string | null;
  registered_address: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_code: string | null;
  pincode: string | null;
  modules: Record<string, boolean>;
}

export interface EditTarget {
  id: string;
  workspace: string;
  logo_url: string | null;
  details: CompanyDetails;
}

function fieldsFrom(target: EditTarget): Fields {
  const d = target.details;
  return {
    ...EMPTY,
    company_name: d.company_name ?? "",
    legal_name: d.legal_name ?? "",
    workspace: target.workspace,
    company_type: d.company_type ?? "private_limited",
    industry: d.industry ?? "",
    company_size: d.company_size ?? "",
    website: d.website ?? "",
    contact_email: d.contact_email ?? "",
    contact_phone: d.contact_phone ?? "",
    pan: d.pan ?? "",
    tan: d.tan ?? "",
    gstin: d.gstin ?? "",
    cin: d.cin ?? "",
    pf_registration_no: d.pf_registration_no ?? "",
    esi_registration_no: d.esi_registration_no ?? "",
    address_line1: d.address_line1 ?? "",
    address_line2: d.address_line2 ?? "",
    city: d.city ?? "",
    state_code: d.state_code ?? "",
    pincode: d.pincode ?? "",
  };
}

const ADMIN_FIELDS: (keyof Fields)[] = ["admin_full_name", "admin_email", "admin_phone", "admin_designation"];

const REQUIRED: (keyof Fields)[] = [
  "company_name",
  "legal_name",
  "pan",
  "address_line1",
  "city",
  "state_code",
  "pincode",
  "admin_full_name",
  "admin_email",
  "admin_phone",
];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * New organisation — everything the platform needs to set a company up.
 *
 * Its legal identity becomes its first legal entity, its registered office its
 * first location, and its admin the first login. The server checks the GSTIN
 * against the PAN and the office's state, so a typo is caught here rather than
 * in the first payroll run.
 */
const DEFAULT_MODULES: Record<string, boolean> = Object.fromEntries(
  Object.entries(MODULES).map(([key, m]) => [key, m.on]),
);

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
  editing = null,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (issued: Issued) => void;
  /** Edit this company instead of creating one. */
  editing?: EditTarget | null;
  onSaved?: () => void;
}) {
  const isEdit = editing !== null;
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [modules, setModules] = useState<Record<string, boolean>>(DEFAULT_MODULES);
  const [logo, setLogo] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  // Each time the dialog opens: a blank form to create, or the company's details to edit.
  useEffect(() => {
    if (!open) return;
    setLogo(null);
    setRemoveLogo(false);
    if (editing) {
      setFields(fieldsFrom(editing));
      setModules({ ...DEFAULT_MODULES, ...editing.details.modules });
    } else {
      setFields(EMPTY);
      setModules(DEFAULT_MODULES);
    }
  }, [open, editing]);

  const set = (key: keyof Fields) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));
  const upper = (key: keyof Fields) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setFields((current) => ({ ...current, [key]: event.target.value.toUpperCase() }));

  const missing = REQUIRED.filter((key) => !(isEdit && ADMIN_FIELDS.includes(key)) && !fields[key].trim());

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      // Only what changed; the server merges it with what is on file and checks the whole.
      const original = fieldsFrom(editing);
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields) as [keyof Fields, string][]) {
        if (ADMIN_FIELDS.includes(key)) continue;
        if (value.trim() !== original[key].trim()) body[key] = value.trim() === "" ? null : value.trim();
      }
      const changedModules = Object.fromEntries(
        Object.entries(modules).filter(([key, on]) => Boolean(editing.details.modules[key]) !== on),
      );
      if (Object.keys(changedModules).length) body.modules = changedModules;
      if (Object.keys(body).length) await patch(`/platform/workspaces/${editing.id}`, body);
      if (removeLogo && !logo) await del(`/platform/workspaces/${editing.id}/logo`);
      if (logo) {
        const form = new FormData();
        form.set("file", logo);
        await post(`/platform/workspaces/${editing.id}/logo`, form);
      }
      toast.success("Company details saved.");
      onOpenChange(false);
      onSaved?.();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not save the changes.");
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { modules };
      for (const [key, value] of Object.entries(fields)) {
        const trimmed = value.trim();
        body[key] = trimmed === "" ? null : trimmed;
      }
      body.company_type = fields.company_type;
      const result = await post<{
        workspace: { id: string; name: string };
        admin: { email: string; temporary_password: string };
        welcome_email: WelcomeEmail | null;
      }>("/platform/workspaces", body);

      if (logo) {
        const form = new FormData();
        form.set("file", logo);
        try {
          await post(`/platform/workspaces/${result.workspace.id}/logo`, form);
        } catch (caught) {
          toast.error(
            `${result.workspace.name} was created, but the logo was not saved: ${
              caught instanceof ApiError ? caught.detail : "try again from the list"
            }`,
          );
        }
      }
      onOpenChange(false);
      setFields(EMPTY);
      setLogo(null);
      onCreated?.({
        title: `${result.workspace.name} is ready`,
        email: result.admin.email,
        password: result.admin.temporary_password,
        welcome: result.welcome_email,
      });
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not create the organisation.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${editing?.details.company_name}` : "New organisation"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Changes are checked as a whole — a new GSTIN against the PAN and the office's state — and recorded in the company's audit trail."
              : "Creates the workspace, its legal entity and registered office, and its first admin. You get a temporary password to give the admin; they choose their own at first sign-in."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          <Section title="Company">
            <FormField label="Display name" htmlFor="ws-company" required hint="Shown on the sign-in page.">
              <Input id="ws-company" value={fields.company_name} onChange={set("company_name")} />
            </FormField>
            <FormField label="Legal name" htmlFor="ws-legal" required hint="As registered, for payslips and filings.">
              <Input id="ws-legal" value={fields.legal_name} onChange={set("legal_name")} />
            </FormField>
            <FormField label="Company type" htmlFor="ws-type" required>
              <Select
                value={fields.company_type}
                onValueChange={(value) => setFields((current) => ({ ...current, company_type: value }))}
              >
                <SelectTrigger id="ws-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COMPANY_TYPES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label="Workspace address"
              htmlFor="ws-slug"
              optional
              hint="Lowercase letters, digits and hyphens. Made from the name if empty."
            >
              <Input
                id="ws-slug"
                value={fields.workspace}
                onChange={(event) => setFields((current) => ({ ...current, workspace: event.target.value.toLowerCase() }))}
              />
            </FormField>
            <FormField label="Industry" htmlFor="ws-industry" optional>
              <Input id="ws-industry" value={fields.industry} onChange={set("industry")} />
            </FormField>
            <FormField label="Company size" htmlFor="ws-size" optional>
              <Select
                value={fields.company_size}
                onValueChange={(value) => setFields((current) => ({ ...current, company_size: value }))}
              >
                <SelectTrigger id="ws-size" className="w-full">
                  <SelectValue placeholder="Employees" />
                </SelectTrigger>
                <SelectContent>
                  {SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size} employees
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Website" htmlFor="ws-web" optional>
              <Input id="ws-web" value={fields.website} onChange={set("website")} placeholder="company.com" />
            </FormField>
            <FormField label="Logo" htmlFor="ws-logo" optional hint="PNG or JPEG, up to 1 MB. Shown on their sign-in page.">
              <div className="grid gap-2">
                {isEdit && editing?.logo_url && !removeLogo && !logo ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editing.logo_url} alt="" className="max-h-10 max-w-[140px] object-contain" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setRemoveLogo(true)}>
                      Remove
                    </Button>
                  </div>
                ) : null}
                <Input
                  id="ws-logo"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(event) => setLogo(event.target.files?.[0] ?? null)}
                />
              </div>
            </FormField>
            <FormField label="Company email" htmlFor="ws-cemail" optional>
              <Input id="ws-cemail" type="email" value={fields.contact_email} onChange={set("contact_email")} />
            </FormField>
            <FormField label="Company phone" htmlFor="ws-cphone" optional>
              <Input id="ws-cphone" value={fields.contact_phone} onChange={set("contact_phone")} />
            </FormField>
          </Section>

          <Separator />

          <Section title="Statutory identity" hint="Payroll, TDS returns and PF/ESI filings read these.">
            <FormField label="PAN" htmlFor="ws-pan" required>
              <Input id="ws-pan" value={fields.pan} onChange={upper("pan")} maxLength={10} placeholder="AAACA1234B" />
            </FormField>
            <FormField label="TAN" htmlFor="ws-tan" optional>
              <Input id="ws-tan" value={fields.tan} onChange={upper("tan")} maxLength={10} placeholder="BLRA12345C" />
            </FormField>
            <FormField
              label="GSTIN"
              htmlFor="ws-gstin"
              optional
              hint="For the registered office's state. Checked against the PAN."
            >
              <Input id="ws-gstin" value={fields.gstin} onChange={upper("gstin")} maxLength={15} />
            </FormField>
            <FormField label="CIN or LLPIN" htmlFor="ws-cin" optional>
              <Input id="ws-cin" value={fields.cin} onChange={upper("cin")} maxLength={21} />
            </FormField>
            <FormField label="PF establishment code" htmlFor="ws-pf" optional>
              <Input id="ws-pf" value={fields.pf_registration_no} onChange={upper("pf_registration_no")} />
            </FormField>
            <FormField label="ESI code" htmlFor="ws-esi" optional>
              <Input id="ws-esi" value={fields.esi_registration_no} onChange={set("esi_registration_no")} />
            </FormField>
          </Section>

          <Separator />

          <Section title="Registered office" hint="Becomes their first location; its state decides Professional Tax.">
            <FormField label="Address line 1" htmlFor="ws-a1" required>
              <Input id="ws-a1" value={fields.address_line1} onChange={set("address_line1")} />
            </FormField>
            <FormField label="Address line 2" htmlFor="ws-a2" optional>
              <Input id="ws-a2" value={fields.address_line2} onChange={set("address_line2")} />
            </FormField>
            <FormField label="City" htmlFor="ws-city" required>
              <Input id="ws-city" value={fields.city} onChange={set("city")} />
            </FormField>
            <FormField label="State" htmlFor="ws-state" required>
              <Select
                value={fields.state_code}
                onValueChange={(value) => setFields((current) => ({ ...current, state_code: value }))}
              >
                <SelectTrigger id="ws-state" className="w-full">
                  <SelectValue placeholder="Choose a state" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((state) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="PIN code" htmlFor="ws-pin" required>
              <Input id="ws-pin" inputMode="numeric" maxLength={6} value={fields.pincode} onChange={set("pincode")} />
            </FormField>
          </Section>

          <Separator />

          {isEdit ? null : (
          <Section title="Their first admin" hint="Signs in with this email or mobile number.">
            <FormField label="Full name" htmlFor="ws-admin-name" required>
              <Input id="ws-admin-name" value={fields.admin_full_name} onChange={set("admin_full_name")} />
            </FormField>
            <FormField label="Designation" htmlFor="ws-admin-title" optional>
              <Input id="ws-admin-title" value={fields.admin_designation} onChange={set("admin_designation")} />
            </FormField>
            <FormField
              label="Work email"
              htmlFor="ws-admin-email"
              required
              hint="An email can sign in to only one organisation."
            >
              <Input id="ws-admin-email" type="email" value={fields.admin_email} onChange={set("admin_email")} />
            </FormField>
            <FormField label="Mobile number" htmlFor="ws-admin-phone" required>
              <Input id="ws-admin-phone" inputMode="tel" value={fields.admin_phone} onChange={set("admin_phone")} />
            </FormField>
          </Section>
          )}

          <Separator />

          <section className="grid gap-3">
            <h3 className="text-sm font-semibold text-foreground">Modules</h3>
            <div className="grid gap-3 sm:grid-cols-4">
              {Object.entries(MODULES).map(([key, module]) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`ws-module-${key}`}
                    checked={modules[key]}
                    onCheckedChange={(checked) => setModules((current) => ({ ...current, [key]: checked === true }))}
                  />
                  <Label htmlFor={`ws-module-${key}`} className="font-normal">
                    {module.label}
                  </Label>
                </div>
              ))}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={isEdit ? save : create} disabled={saving || missing.length > 0}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? "Save changes" : "Create organisation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
