"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { Money } from "@/components/common/Money";
import {
  APPLICATION_STATUS,
  CANDIDATE_STAGE,
  formatDateTime,
  humanize,
  INTERVIEW_MODE,
  INTERVIEW_STATUS,
  OFFER_STATUS,
  REFERRAL_STATUS,
  StatusBadge,
} from "@/components/hiring/labels";
import { sourceLabel } from "@/components/hiring/PipelineBoard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ApiError, downloadFile } from "@/lib/api";
import type { CandidateProfile, ReferralStatus } from "@/lib/types/hiring";
import { formatDate } from "@/lib/utils";

type Profile = CandidateProfile;

/** A status as its badge reads, for the search and the CSV. */
function statusLabel<K extends string>(map: Record<K, [string, unknown]>, value: K): string {
  return map[value]?.[0] ?? humanize(value);
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm break-words text-foreground">{children}</div>
    </div>
  );
}

/** A download button that shows progress and reports a refusal verbatim. */
export function CandidateDownloadButton({
  path,
  fallbackName,
  label,
  variant = "outline",
}: {
  path: string;
  fallbackName: string;
  label: string;
  variant?: "outline" | "ghost";
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadFile(path, fallbackName);
        } catch (caught) {
          toast.error(caught instanceof ApiError ? caught.detail : "The file could not be downloaded.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Download />}
      {label}
    </Button>
  );
}

/** Contact, experience, salary (HR only), source and resume text. */
export function CandidateOverview({ profile }: { profile: Profile }) {
  const c = profile.candidate;
  const former = c.former_employee;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      {former && (
        <Alert variant={former.is_rehire_eligible === false ? "destructive" : "default"} className="lg:col-span-2">
          <AlertTitle>
            Worked here before ({former.employee_code}
            {former.date_of_exit ? `, left ${former.date_of_exit}` : ""})
          </AlertTitle>
          <AlertDescription>
            {former.is_rehire_eligible === false
              ? `Marked not eligible for rehire: ${former.rehire_note ?? "no reason recorded"}.`
              : former.is_rehire_eligible === true
                ? "Marked eligible for rehire."
                : "No rehire decision was recorded when they left."}
          </AlertDescription>
        </Alert>
      )}
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Fact label="Email">{c.email}</Fact>
          <Fact label="Phone">{c.phone ?? "—"}</Fact>
          <Fact label="Current company">{c.current_company ?? "—"}</Fact>
          <Fact label="Experience">
            <span className="tabular-nums">
              {c.total_experience_years !== null ? `${c.total_experience_years} years` : "—"}
            </span>
          </Fact>
          <Fact label="Notice period">
            <span className="tabular-nums">
              {c.notice_period_days !== null ? `${c.notice_period_days} days` : "—"}
            </span>
          </Fact>
          <Fact label="Source">{sourceLabel(c.source)}</Fact>
          {c.salary_hidden ? (
            <p className="col-span-2 text-xs text-muted-foreground">
              Salary details are visible to HR only.
            </p>
          ) : (
            <>
              <Fact label="Current CTC">
                <Money value={c.current_ctc} />
              </Fact>
              <Fact label="Expected CTC">
                <Money value={c.expected_ctc} />
              </Fact>
            </>
          )}
          <Fact label="Added">{formatDateTime(c.created_at)}</Fact>
          {c.converted_employee_id && (
            <Fact label="Employee record">
              <Link
                href={`/people/${c.converted_employee_id}`}
                className="text-primary hover:underline"
              >
                Open employee profile
              </Link>
            </Fact>
          )}
        </CardContent>
      </Card>

      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Resume text</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {c.resume_note && <p className="text-xs text-muted-foreground">{c.resume_note}</p>}
          {c.resume_text ? (
            <ScrollArea className="h-80 rounded-md border border-border">
              <p className="whitespace-pre-wrap p-3 font-mono text-xs text-foreground">
                {c.resume_text}
              </p>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground">No resume text is available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type ApplicationRow = Profile["applications"][number];

const APPLICATION_COLUMNS: ColumnDef<ApplicationRow>[] = [
  {
    accessorKey: "requisition_title",
    header: "Requisition",
    meta: { text: (row) => `${row.requisition_title ?? "—"} ${row.requisition_code ?? ""}`.trim() },
    cell: ({ row }) => (
      <>
        <span className="font-medium text-foreground">{row.original.requisition_title ?? "—"}</span>
        <p className="font-mono text-xs text-muted-foreground">{row.original.requisition_code ?? ""}</p>
      </>
    ),
  },
  {
    accessorKey: "source",
    header: "Source",
    meta: { text: (row) => sourceLabel(row.source) },
    cell: ({ row }) => sourceLabel(row.original.source),
  },
  {
    accessorKey: "applied_at",
    header: "Applied",
    meta: { text: (row) => formatDateTime(row.applied_at) },
    cell: ({ row }) => formatDateTime(row.original.applied_at),
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: {
      text: (row) =>
        `${statusLabel(APPLICATION_STATUS, row.status)}${row.purged ? " · Personal data erased" : ""}`,
    },
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        <StatusBadge map={APPLICATION_STATUS} value={row.original.status} />
        {row.original.purged && <Badge variant="muted">Personal data erased</Badge>}
      </div>
    ),
  },
  {
    accessorKey: "matched_on",
    header: "Matched to this person",
    meta: {
      cellClassName: "text-sm",
      text: (row) =>
        row.matched_on
          ? [`On ${humanize(row.matched_on)}`, row.match_reason].filter(Boolean).join(" · ")
          : "New person",
    },
    cell: ({ row }) =>
      row.original.matched_on ? (
        <>
          <span className="text-foreground">On {humanize(row.original.matched_on)}</span>
          {row.original.match_reason && (
            <p className="text-xs text-muted-foreground">{row.original.match_reason}</p>
          )}
        </>
      ) : (
        <span className="text-muted-foreground">New person</span>
      ),
  },
];

export function CandidateApplications({ profile }: { profile: Profile }) {
  return (
    <DataTable
      columns={APPLICATION_COLUMNS}
      data={profile.applications}
      noun="applications"
      exportName="candidate-applications"
      bordered={false}
      searchPlaceholder="Search applications"
      empty={{ icon: FileText, title: "No applications on record" }}
    />
  );
}

type InterviewRow = Profile["interviews"][number];

const INTERVIEW_COLUMNS: ColumnDef<InterviewRow>[] = [
  {
    accessorKey: "stage_name",
    header: "Stage",
    meta: { cellClassName: "font-medium" },
    cell: ({ row }) => row.original.stage_name ?? "—",
  },
  {
    accessorKey: "scheduled_start",
    header: "When",
    meta: { text: (row) => formatDateTime(row.scheduled_start) },
    cell: ({ row }) => formatDateTime(row.original.scheduled_start),
  },
  {
    accessorKey: "mode",
    header: "Mode",
    meta: { text: (row) => INTERVIEW_MODE[row.mode] ?? humanize(row.mode) },
    cell: ({ row }) => INTERVIEW_MODE[row.original.mode] ?? humanize(row.original.mode),
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { text: (row) => statusLabel(INTERVIEW_STATUS, row.status) },
    cell: ({ row }) => <StatusBadge map={INTERVIEW_STATUS} value={row.original.status} />,
  },
  {
    accessorKey: "feedback_submitted",
    header: "Feedback",
    meta: {
      className: "text-right tabular-nums",
      text: (row) => `${row.feedback_submitted} of ${row.panel_size}`,
    },
    cell: ({ row }) => (
      <>
        {row.original.feedback_submitted} of {row.original.panel_size}
      </>
    ),
  },
  {
    id: "actions",
    header: "",
    enableHiding: false,
    meta: { className: "text-right", text: false },
    cell: ({ row }) => (
      <Button size="sm" variant="ghost" asChild>
        <Link href={`/hiring/interviews?interview=${row.original.id}`}>Open</Link>
      </Button>
    ),
  },
];

export function CandidateInterviews({ profile }: { profile: Profile }) {
  return (
    <DataTable
      columns={INTERVIEW_COLUMNS}
      data={profile.interviews}
      noun="interviews"
      exportName="candidate-interviews"
      bordered={false}
      searchPlaceholder="Search interviews"
      empty={{
        icon: FileText,
        title: "No interviews scheduled",
        description: "Interviews are scheduled from the Interviews page.",
      }}
    />
  );
}

const CONSENT_VARIANT = {
  not_recorded: ["Not recorded", "muted"],
  granted: ["Granted", "success"],
  withdrawn: ["Withdrawn", "destructive"],
} as const;

type ConsentRow = Profile["consent"]["purposes"][number];

const CONSENT_COLUMNS: ColumnDef<ConsentRow>[] = [
  {
    accessorKey: "purpose",
    header: "Purpose",
    cell: ({ row }) => humanize(row.original.purpose),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const [label, variant] = CONSENT_VARIANT[row.original.status] ?? [humanize(row.original.status), "outline"];
      return <Badge variant={variant}>{label}</Badge>;
    },
  },
  {
    accessorKey: "recorded_at",
    header: "Recorded",
    cell: ({ row }) => formatDateTime(row.original.recorded_at),
  },
  {
    accessorKey: "notice_version",
    header: "Notice version",
    cell: ({ row }) => row.original.notice_version ?? "—",
  },
];

export function CandidateConsent({ profile }: { profile: Profile }) {
  return (
    <div className="space-y-3">
      <DataTable
        variant="plain"
        bordered={false}
        columns={CONSENT_COLUMNS}
        data={profile.consent.purposes}
        getRowId={(purpose) => purpose.purpose}
      />
      {profile.consent.note && (
        <p className="px-5 pb-4 text-xs text-muted-foreground">{profile.consent.note}</p>
      )}
    </div>
  );
}

export function CandidateHistory({ profile }: { profile: Profile }) {
  if (profile.stage_history.length === 0) {
    return <EmptyState icon={FileText} title="No stage changes yet" />;
  }
  return (
    <ol className="space-y-0 p-5">
      {profile.stage_history.map((entry, index) => (
        <li key={`${entry.occurred_at}-${index}`} className="relative border-l border-border pb-5 pl-5 last:pb-0">
          <span className="absolute top-1.5 -left-1 size-2 rounded-full bg-primary" />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {entry.from_stage ? (
              <>
                <StatusBadge map={CANDIDATE_STAGE} value={entry.from_stage} />
                <span className="text-muted-foreground">→</span>
              </>
            ) : null}
            <StatusBadge map={CANDIDATE_STAGE} value={entry.to_stage} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateTime(entry.occurred_at)}
            {entry.by ? ` · ${entry.by}` : ""}
          </p>
          {entry.reason && <p className="mt-1 whitespace-pre-line text-sm text-foreground">{entry.reason}</p>}
        </li>
      ))}
    </ol>
  );
}

export function CandidateDuplicates({ profile }: { profile: Profile }) {
  const { duplicates } = profile;
  if (duplicates.count === 0 && duplicates.ambiguous_matches.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No possible duplicates"
        description="No other candidate record matches this person."
      />
    );
  }
  return (
    <div className="space-y-4 p-5">
      <p className="text-sm text-foreground">
        <span className="font-semibold tabular-nums">{duplicates.count}</span> other record
        {duplicates.count === 1 ? "" : "s"} may be this person.
      </p>
      {profile.viewer_is_hr && duplicates.records.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {duplicates.records.map((record) => (
            <li key={record.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <Link href={`/hiring/candidates/${record.id}`} className="text-sm font-medium hover:underline">
                {record.full_name}
              </Link>
              <StatusBadge map={CANDIDATE_STAGE} value={record.stage} />
            </li>
          ))}
        </ul>
      )}
      {duplicates.ambiguous_matches.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Applications matched with doubt</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {duplicates.ambiguous_matches.map((match) => (
              <li key={match.application_id}>{match.reason ?? "No reason recorded."}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function fileSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CandidateDocuments({ profile }: { profile: Profile }) {
  if (profile.documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents uploaded"
        description="Documents the candidate uploads through their portal appear here."
      />
    );
  }
  return (
    <ul className="divide-y divide-border">
      {profile.documents.map((document) => (
        <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{document.file_name}</p>
            <p className="text-xs text-muted-foreground">
              {humanize(document.category)} · <span className="tabular-nums">{fileSize(document.size_bytes)}</span> ·{" "}
              {formatDateTime(document.uploaded_at)}
            </p>
          </div>
          <CandidateDownloadButton
            path={`/hiring/candidates/${profile.candidate.id}/documents/${document.id}`}
            fallbackName={document.file_name}
            label="Download"
          />
        </li>
      ))}
    </ul>
  );
}

type OfferRow = Profile["offers"][number];

const OFFER_COLUMNS: ColumnDef<OfferRow>[] = [
  {
    accessorKey: "code",
    header: "Offer",
    cell: ({ row }) => (
      <Link href={`/hiring/offers?offer=${row.original.id}`} className="font-mono text-sm hover:underline">
        {row.original.code}
      </Link>
    ),
  },
  { accessorKey: "designation", header: "Designation" },
  {
    accessorKey: "status",
    header: "Status",
    meta: { text: (row) => statusLabel(OFFER_STATUS, row.status) },
    cell: ({ row }) => <StatusBadge map={OFFER_STATUS} value={row.original.status} />,
  },
  {
    accessorKey: "ctc_annual",
    header: "Annual CTC",
    // A decimal string: compared as a number, not letter by letter.
    sortingFn: "alphanumeric",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.ctc_annual} />,
  },
  {
    accessorKey: "joining_date",
    header: "Joining",
    meta: { text: (row) => formatDate(row.joining_date) },
    cell: ({ row }) => formatDate(row.original.joining_date),
  },
];

export function CandidateOffers({ profile }: { profile: Profile }) {
  return (
    <DataTable
      columns={OFFER_COLUMNS}
      data={profile.offers}
      noun="offers"
      exportName="candidate-offers"
      bordered={false}
      searchPlaceholder="Search offers"
      empty={{ icon: FileText, title: "No offers for this candidate" }}
    />
  );
}

export function CandidateReferral({ referral }: { referral: NonNullable<Profile["referral"]> }) {
  return (
    <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
      <Fact label="Referred by">{referral.referrer ?? "—"}</Fact>
      <Fact label="Status">
        <StatusBadge map={REFERRAL_STATUS} value={referral.status as ReferralStatus} />
      </Fact>
      <Fact label="Submitted">{formatDateTime(referral.submitted_at)}</Fact>
    </div>
  );
}
