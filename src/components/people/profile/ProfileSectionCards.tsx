"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  BadgeCheck,
  Banknote,
  Briefcase,
  Clock,
  GraduationCap,
  HeartHandshake,
  Home,
  IdCard,
  Pencil,
  Phone,
  Send,
  Users,
} from "lucide-react";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { Money } from "@/components/common/Money";
import { DetailItem } from "@/components/people/StatusBadges";
import {
  EDUCATION_LEVEL,
  FAMILY_GENDER,
  MARITAL_STATUS,
  NOMINEE_PURPOSE,
  RELATIONSHIP,
  SECTION_TITLE,
} from "@/components/people/profile/labels";
import type { EditMode } from "@/components/people/profile/SectionEditDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { stateName } from "@/lib/states";
import type {
  Address,
  EmployeeProfile,
  EmployeeRecord,
  FamilyMember,
  Nominee,
  NomineePurpose,
  ProfileSection,
} from "@/lib/types/people";
import { formatDay } from "@/lib/utils";

function day(value: string | null | undefined): string | null {
  return value ? formatDay(value, true) : null;
}

/** How the viewer may change a section, or null when they cannot. */
export function editModeFor(
  profile: EmployeeProfile,
  section: ProfileSection,
  isSelf: boolean,
): EditMode | null {
  if (profile.direct_sections.includes(section)) return isSelf ? "self-direct" : "hr";
  if (profile.request_sections.includes(section)) return "self-request";
  return null;
}

export type OnEdit = (section: ProfileSection, mode: EditMode) => void;

function SectionCard({
  section,
  profile,
  isSelf,
  onEdit,
  icon: Icon,
  title,
  description,
  tier = "tier1",
  children,
}: {
  section: ProfileSection;
  profile: EmployeeProfile;
  isSelf: boolean;
  onEdit: OnEdit;
  icon: React.ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
  tier?: "tier1" | "tier2";
  children: React.ReactNode;
}) {
  const mode = editModeFor(profile, section, isSelf);
  const pending = profile.pending_requests.find((request) => request.section === section);
  return (
    // min-w-0: a wide table scrolls inside the card instead of widening the page.
    <Card tier={tier} className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-brand-600" /> {title ?? SECTION_TITLE[section]}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <CardAction className="flex items-center gap-2">
          {pending && (
            <Badge variant="warning">
              <Clock /> Change waiting for HR
            </Badge>
          )}
          {mode === "self-request" ? (
            <Button size="sm" variant="outline" disabled={Boolean(pending)} onClick={() => onEdit(section, mode)}>
              <Send /> Request change
            </Button>
          ) : mode ? (
            <Button size="sm" variant="outline" onClick={() => onEdit(section, mode)}>
              <Pencil /> Edit
            </Button>
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Nothing({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** The parts an address brought in from another HR system may be missing. */
function addressGaps(address: Address): string[] {
  return [
    address.city ? null : "city",
    address.state_code ? null : "state",
    address.pincode ? null : "PIN code",
  ].filter((part): part is string => part !== null);
}

/** A relationship, with the old system's word when it is none of ours. */
function relation(code: keyof typeof RELATIONSHIP, asTyped?: string | null): string {
  return asTyped && code === "other" ? `${RELATIONSHIP[code]} (${asTyped})` : RELATIONSHIP[code];
}

function yesNo(value: boolean | null | undefined): string | null {
  return value === true ? "Yes" : value === false ? "No" : null;
}

function AddressBlock({ label, address }: { label: string; address: Address | null }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      {address ? (
        <div className="mt-0.5 text-sm font-medium text-foreground">
          <p>{address.line1}</p>
          {address.line2 && <p>{address.line2}</p>}
          {(address.city || address.district) && (
            <p>{[address.city, address.district].filter(Boolean).join(", ")}</p>
          )}
          {(address.state_code || address.pincode) && (
            <p>
              {address.state_code ? stateName(address.state_code) : null} {address.pincode}
            </p>
          )}
          {addressGaps(address).length > 0 && (
            <p className="mt-1 text-xs font-normal text-muted-foreground">
              {`No ${addressGaps(address).join(", ")} on record. Edit to add.`}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-0.5 text-sm text-muted-foreground">Not recorded</p>
      )}
    </div>
  );
}

// ── Cards ──────────────────────────────────────────────────────────────────

export function IdentityCard({
  profile,
  employee,
  isSelf,
  onEdit,
}: {
  profile: EmployeeProfile;
  employee: EmployeeRecord;
  isSelf: boolean;
  onEdit: OnEdit;
}) {
  return (
    <SectionCard section="identity" profile={profile} isSelf={isSelf} onEdit={onEdit} icon={IdCard}>
      <div className="grid gap-4 sm:grid-cols-3">
        <DetailItem label="First name">{employee.first_name}</DetailItem>
        <DetailItem label="Last name">{employee.last_name}</DetailItem>
        <DetailItem label="Date of birth">{day(employee.date_of_birth)}</DetailItem>
      </div>
    </SectionCard>
  );
}

export function PersonalCard({
  profile,
  isSelf,
  onEdit,
}: {
  profile: EmployeeProfile;
  isSelf: boolean;
  onEdit: OnEdit;
}) {
  const p = profile.personal;
  return (
    <SectionCard section="personal" profile={profile} isSelf={isSelf} onEdit={onEdit} icon={Users}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailItem label="Father's name">{p.father_name}</DetailItem>
        <DetailItem label="Spouse's name">{p.spouse_name}</DetailItem>
        <DetailItem label="Marital status">{p.marital_status ? MARITAL_STATUS[p.marital_status] : null}</DetailItem>
        <DetailItem label="Blood group">{p.blood_group}</DetailItem>
        <DetailItem label="Nationality">{p.nationality}</DetailItem>
        <DetailItem label="Alternate phone">{p.alternate_phone}</DetailItem>
      </div>
    </SectionCard>
  );
}

export function AddressesCard({
  profile,
  isSelf,
  onEdit,
}: {
  profile: EmployeeProfile;
  isSelf: boolean;
  onEdit: OnEdit;
}) {
  const a = profile.addresses;
  return (
    <SectionCard
      section="addresses"
      profile={profile}
      isSelf={isSelf}
      onEdit={onEdit}
      icon={Home}
      description="The state decides Professional Tax and appears on Form 16 and PF KYC."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <AddressBlock label="Current address" address={a.current} />
        {a.permanent_same_as_current && a.current ? (
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Permanent address</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">Same as current address</p>
          </div>
        ) : (
          <AddressBlock label="Permanent address" address={a.permanent} />
        )}
      </div>
    </SectionCard>
  );
}

export function EmergencyContactsCard({
  profile,
  isSelf,
  onEdit,
}: {
  profile: EmployeeProfile;
  isSelf: boolean;
  onEdit: OnEdit;
}) {
  const rows = profile.emergency_contacts;
  return (
    <SectionCard section="emergency_contacts" profile={profile} isSelf={isSelf} onEdit={onEdit} icon={Phone}>
      {rows.length === 0 ? (
        <Nothing>No emergency contact on record. Add at least one person to call.</Nothing>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((contact, index) => (
            <div key={index} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{contact.name}</p>
                {contact.is_primary && <Badge variant="secondary">Primary</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {relation(contact.relationship, contact.relationship_text)}
              </p>
              {contact.phone ? (
                <p className="mt-1 text-sm tabular-nums">{contact.phone}</p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">No mobile number on record</p>
              )}
              {contact.alternate_phone && <p className="text-sm tabular-nums">{contact.alternate_phone}</p>}
              {contact.landline && <p className="text-sm tabular-nums">Landline {contact.landline}</p>}
              {contact.email && <p className="truncate text-sm">{contact.email}</p>}
              {contact.address && <p className="mt-1 text-sm text-muted-foreground">{contact.address}</p>}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

const FAMILY_COLUMNS: ColumnDef<FamilyMember>[] = [
  {
    accessorKey: "name",
    header: "Name",
    meta: { cellClassName: "font-medium" },
    cell: ({ row }) => [row.original.title, row.original.name].filter(Boolean).join(" "),
  },
  {
    accessorKey: "relationship",
    header: "Relationship",
    cell: ({ row }) => relation(row.original.relationship, row.original.relationship_text),
  },
  {
    accessorKey: "date_of_birth",
    header: "Date of birth",
    cell: ({ row }) => day(row.original.date_of_birth) ?? "—",
  },
  {
    accessorKey: "gender",
    header: "Gender",
    cell: ({ row }) => (row.original.gender ? FAMILY_GENDER[row.original.gender] : "—"),
  },
  {
    accessorKey: "phone",
    header: "Phone",
    meta: { cellClassName: "tabular-nums" },
    cell: ({ row }) => row.original.phone ?? "—",
  },
  {
    accessorKey: "is_dependent",
    header: "Dependant",
    cell: ({ row }) => (row.original.is_dependent ? "Yes" : "No"),
  },
  {
    id: "more",
    header: "More",
    meta: { className: "min-w-56", cellClassName: "min-w-56 max-w-96 whitespace-normal" },
    cell: ({ row }) => {
      const m = row.original;
      const parts = [
        m.occupation,
        m.blood_group ? `Blood group ${m.blood_group}` : null,
        m.nationality,
        m.marital_status,
        m.marriage_date ? `Married ${day(m.marriage_date)}` : null,
        yesNo(m.health_insurance) ? `Health insurance: ${yesNo(m.health_insurance)}` : null,
        m.insurance_number ? `Insurance no. ${m.insurance_number}` : null,
        m.remarks,
      ].filter(Boolean);
      return parts.length ? <span className="text-xs text-muted-foreground">{parts.join(" · ")}</span> : "—";
    },
  },
];

export function FamilyCard({
  profile,
  isSelf,
  onEdit,
}: {
  profile: EmployeeProfile;
  isSelf: boolean;
  onEdit: OnEdit;
}) {
  const rows = profile.family_members;
  return (
    <SectionCard section="family_members" profile={profile} isSelf={isSelf} onEdit={onEdit} icon={Users}>
      {rows.length === 0 ? (
        <Nothing>No family members recorded.</Nothing>
      ) : (
        <DataTable
          variant="plain"
          columns={FAMILY_COLUMNS}
          data={rows}
          getRowId={(_member, index) => String(index)}
          noun="family members"
        />
      )}
    </SectionCard>
  );
}

const NOMINEE_COLUMNS: ColumnDef<Nominee>[] = [
  { accessorKey: "name", header: "Nominee", meta: { cellClassName: "font-medium" } },
  {
    accessorKey: "relationship",
    header: "Relationship",
    cell: ({ row }) => relation(row.original.relationship, row.original.relationship_text),
  },
  {
    accessorKey: "date_of_birth",
    header: "Date of birth",
    cell: ({ row }) => day(row.original.date_of_birth) ?? "—",
  },
  {
    accessorKey: "guardian_name",
    header: "Guardian",
    cell: ({ row }) => row.original.guardian_name ?? "—",
  },
  {
    id: "contact",
    header: "Contact",
    meta: { className: "min-w-48", cellClassName: "min-w-48 max-w-80 whitespace-normal" },
    cell: ({ row }) => {
      const n = row.original;
      const parts = [n.phone, n.address, n.city, n.country, n.remarks].filter(Boolean);
      return parts.length ? <span className="text-xs text-muted-foreground">{parts.join(" · ")}</span> : "—";
    },
  },
  {
    accessorKey: "share_percent",
    header: "Share",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) =>
      row.original.share_percent ? (
        `${row.original.share_percent}%`
      ) : (
        <Badge variant="warning">Not stated</Badge>
      ),
  },
];

export function NomineesCard({
  profile,
  isSelf,
  onEdit,
}: {
  profile: EmployeeProfile;
  isSelf: boolean;
  onEdit: OnEdit;
}) {
  const rows = profile.nominees;
  const purposes = Array.from(new Set(rows.map((row) => row.purpose))) as NomineePurpose[];
  return (
    <SectionCard
      section="nominees"
      profile={profile}
      isSelf={isSelf}
      onEdit={onEdit}
      icon={HeartHandshake}
      description={
        rows.some((row) => !row.share_percent)
          ? "Shares total 100% for each purpose. A share not stated in the imported record must be entered before Form 2 or Form F is printed."
          : "Shares total 100% for each purpose."
      }
    >
      {rows.length === 0 ? (
        <Nothing>No nominees declared for PF, pension, gratuity or insurance.</Nothing>
      ) : (
        <div className="grid min-w-0 gap-4">
          {purposes.map((purpose) => (
            <div key={purpose} className="min-w-0">
              <p className="mb-2 text-sm font-semibold text-foreground">
                {NOMINEE_PURPOSE[purpose]}
                {(() => {
                  // The old system's word, where the heading does not already say it.
                  const words = Array.from(
                    new Set(
                      rows
                        .filter((row) => row.purpose === purpose && row.purpose_text)
                        .map((row) => row.purpose_text as string),
                    ),
                  ).filter((word) => !NOMINEE_PURPOSE[purpose].toLowerCase().includes(word.toLowerCase()));
                  return words.length ? ` (${words.join(", ")})` : "";
                })()}
              </p>
              <DataTable
                variant="plain"
                columns={NOMINEE_COLUMNS}
                data={rows.filter((row) => row.purpose === purpose)}
                getRowId={(_nominee, index) => String(index)}
                noun="nominees"
              />
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export function EducationCard({
  profile,
  isSelf,
  onEdit,
}: {
  profile: EmployeeProfile;
  isSelf: boolean;
  onEdit: OnEdit;
}) {
  const rows = profile.education;
  return (
    <SectionCard section="education" profile={profile} isSelf={isSelf} onEdit={onEdit} icon={GraduationCap}>
      {rows.length === 0 ? (
        <Nothing>No qualifications recorded.</Nothing>
      ) : (
        <ul className="grid gap-3">
          {rows.map((row, index) => (
            <li key={index} className="rounded-lg border border-border p-3">
              <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                <span>
                  {row.qualification}
                  {row.stream ? ` · ${row.stream}` : ""}
                  {row.specialisation ? `, ${row.specialisation}` : ""}
                </span>
                {row.is_highest && <Badge variant="secondary">Highest</Badge>}
              </p>
              <p className="text-sm text-muted-foreground">
                {[row.institution ?? "Institution not on record", row.board_or_university].filter(Boolean).join(" · ")}
              </p>
              <p className="text-xs text-muted-foreground">
                {[
                  row.course ?? EDUCATION_LEVEL[row.level],
                  row.nature_of_course,
                  row.status,
                  row.from_date || row.to_date
                    ? `${day(row.from_date) ?? "?"} to ${day(row.to_date) ?? "?"}`
                    : row.start_year || row.end_year
                      ? `${row.start_year ?? "?"}–${row.end_year ?? "?"}`
                      : null,
                  row.year ? `Year ${row.year}` : null,
                  row.date_of_passing ? `Passed ${day(row.date_of_passing)}` : null,
                  row.percentage ? `${row.percentage}%` : null,
                  row.grade ? `Grade ${row.grade}` : null,
                  row.duration ? `Duration ${row.duration}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {row.remarks && <p className="text-xs text-muted-foreground">{row.remarks}</p>}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function ExperienceCard({
  profile,
  isSelf,
  onEdit,
}: {
  profile: EmployeeProfile;
  isSelf: boolean;
  onEdit: OnEdit;
}) {
  const rows = profile.previous_employment;
  return (
    <SectionCard section="previous_employment" profile={profile} isSelf={isSelf} onEdit={onEdit} icon={Briefcase}>
      {rows.length === 0 ? (
        <Nothing>No previous employers recorded.</Nothing>
      ) : (
        <ul className="grid gap-3">
          {rows.map((row, index) => (
            <li key={index} className="rounded-lg border border-border p-3">
              <p className="font-medium text-foreground">{row.employer}</p>
              <p className="text-sm text-muted-foreground">
                {[row.designation, row.location].filter(Boolean).join(" · ")}
              </p>
              <p className="text-xs text-muted-foreground">
                {day(row.from_date)} to {day(row.to_date)}
                {row.reason_for_leaving ? ` · ${row.reason_for_leaving}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function StatutoryCard({
  profile,
  isSelf,
  onEdit,
}: {
  profile: EmployeeProfile;
  isSelf: boolean;
  onEdit: OnEdit;
}) {
  const s = profile.statutory;
  return (
    <SectionCard
      section="statutory"
      profile={profile}
      isSelf={isSelf}
      onEdit={onEdit}
      icon={IdCard}
      description={
        s.aadhaar && !s.aadhaar_full
          ? "Only the last four Aadhaar digits were ever saved for this person, so the full number is not on file yet: type it with Edit, or upload your employee Excel again in Onboarding → Add employees to fill it in for everyone."
          : "Seen only by this person and HR."
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailItem label="PAN">
          {s.pan ? <span className="font-mono">{s.pan}</span> : <span className="text-destructive">Not on file</span>}
        </DetailItem>
        <DetailItem label="Aadhaar">
          {s.aadhaar ? (
            s.aadhaar_full ? (
              <span className="font-mono">{s.aadhaar}</span>
            ) : (
              <span>
                Ends in <span className="font-mono">{s.aadhaar.slice(-4)}</span>
                <span className="text-muted-foreground"> · full number not on file</span>
              </span>
            )
          ) : null}
        </DetailItem>
        <DetailItem label="UAN">{s.uan ? <span className="font-mono">{s.uan}</span> : null}</DetailItem>
        <DetailItem label="PF member id">{s.pf_number ? <span className="font-mono">{s.pf_number}</span> : null}</DetailItem>
        <DetailItem label="ESI number">{s.esi_number ? <span className="font-mono">{s.esi_number}</span> : null}</DetailItem>
      </div>
    </SectionCard>
  );
}

export function BankCard({
  profile,
  isSelf,
  onEdit,
}: {
  profile: EmployeeProfile;
  isSelf: boolean;
  onEdit: OnEdit;
}) {
  const account = profile.bank_account;
  return (
    <SectionCard
      section="bank_account"
      profile={profile}
      isSelf={isSelf}
      onEdit={onEdit}
      icon={Banknote}
      description={
        "The account salary is credited to. Seen only by this person and HR."
      }
    >
      {account ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="Account number">
            <span className="font-mono">{account.account_number || account.account_number_masked}</span>
          </DetailItem>
          <DetailItem label="IFSC">
            <span className="font-mono">{account.ifsc}</span>
          </DetailItem>
          <DetailItem label="Bank">{account.bank_name}</DetailItem>
          <DetailItem label="Account holder">{account.account_holder_name}</DetailItem>
          <DetailItem label="Verification">
            {account.verified_at ? (
              <Badge variant="success">
                <BadgeCheck /> Verified {day(account.verified_at.slice(0, 10))}
              </Badge>
            ) : (
              <Badge variant="muted">Not verified</Badge>
            )}
          </DetailItem>
        </div>
      ) : (
        <EmptyState
          icon={Banknote}
          title="No salary account on record"
          description={
            isSelf
              ? "Request one so your salary can be credited."
              : "Add one here or under Payroll → Bank files."
          }
          className="py-6"
        />
      )}
    </SectionCard>
  );
}

/** What the offer carried in. HR only; the fit score stays with its signals in Hiring. */
export function HiringSnapshotCard({ snapshot }: { snapshot: Record<string, unknown> }) {
  const text = (key: string) => (snapshot[key] === null || snapshot[key] === undefined ? null : String(snapshot[key]));
  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Briefcase className="size-4 text-brand-600" /> From the offer
        </CardTitle>
        <CardDescription>
          Visible to HR only. The candidate&apos;s fit score is shown with its signals on the candidate
          record in Hiring, not here.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailItem label="Offer">{text("offer_code")}</DetailItem>
        <DetailItem label="Source">{text("source")}</DetailItem>
        <DetailItem label="Notice period at offer">
          {text("notice_period_days_at_offer") ? `${text("notice_period_days_at_offer")} days` : null}
        </DetailItem>
        <DetailItem label="Expected CTC">
          {text("expected_ctc") ? <Money value={text("expected_ctc")} /> : null}
        </DetailItem>
        <DetailItem label="CTC at offer (previous employer)">
          {text("current_ctc_at_offer") ? <Money value={text("current_ctc_at_offer")} /> : null}
        </DetailItem>
      </CardContent>
    </Card>
  );
}

/** Gaps the record itself shows, each saying what it blocks. */
export function MissingAlert({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null;
  return (
    <Alert variant="warning">
      <AlertTitle>Some things are missing from this record</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
