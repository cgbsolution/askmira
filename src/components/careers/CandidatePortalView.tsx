"use client";

import { CalendarClock, ExternalLink, FileText, LinkIcon, MessageCircle, SearchX } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DocumentUploadForm } from "@/components/careers/DocumentUploadForm";
import { PortalBackgroundChecks } from "@/components/careers/PortalBackgroundChecks";
import { PortalOffers } from "@/components/careers/PortalOffers";
import { PublicMessage } from "@/components/careers/PublicMessage";
import { RescheduleRequestDialog } from "@/components/careers/RescheduleRequestDialog";
import { usePublicQuery } from "@/components/careers/usePublicQuery";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import {
  APPLICATION_STATUS,
  INTERVIEW_MODE,
  StatusBadge,
  formatLocalWallClock,
  humanize,
  safeHref,
} from "@/components/hiring/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ApiError, post } from "@/lib/api";
import type { CandidatePortal } from "@/lib/types/hiring";
import { formatDay } from "@/lib/utils";

/** The candidate's own WhatsApp choice. Only they can turn it on. */
function WhatsAppChoice({
  token,
  whatsapp,
  onChanged,
}: {
  token: string;
  whatsapp: CandidatePortal["whatsapp"];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!whatsapp.phone_on_file) return null;

  const toggle = async (optIn: boolean) => {
    setBusy(true);
    try {
      await post(`/public/candidate/${encodeURIComponent(token)}/whatsapp`, { opt_in: optIn });
      toast.success(optIn ? "WhatsApp updates are on." : "WhatsApp updates are off.");
      onChanged();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-6">
        <MessageCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">Updates on WhatsApp</p>
          <p className="text-xs text-muted-foreground">
            Interview times, changes and decisions also sent to your phone. Email continues either way.
          </p>
        </div>
        <Switch
          aria-label="Updates on WhatsApp"
          checked={whatsapp.opted_in}
          disabled={busy}
          onCheckedChange={(on) => void toggle(on)}
        />
      </CardContent>
    </Card>
  );
}

/** The candidate's own view: applications, interviews, documents — behind a one-time link token. */
export function CandidatePortalView({ token }: { token: string }) {
  const { data, error, isLoading, reload } = usePublicQuery<CandidatePortal>(
    `/public/candidate/${encodeURIComponent(token)}`,
  );

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error && !data) {
    if (error.status === 404 || error.status === 410) {
      return (
        <PublicMessage
          icon={error.status === 410 ? LinkIcon : SearchX}
          title={error.status === 410 ? "This link has expired" : "This link is not valid"}
          detail={error.detail}
        />
      );
    }
    return <ErrorState message={error.detail} onRetry={reload} />;
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Hello, {data.candidate.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your applications with {data.organisation}
        </p>
      </header>

      {data.whatsapp && <WhatsAppChoice token={token} whatsapp={data.whatsapp} onChanged={reload} />}

      <PortalOffers token={token} candidateName={data.candidate.name} />
      <PortalBackgroundChecks token={token} candidateName={data.candidate.name} />

      <Card tier="tier2">
        <CardHeader>
          <CardTitle>Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {data.applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applications are on record for you.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.applications.map((application, index) => (
                <li key={index} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{application.role}</p>
                    <StatusBadge map={APPLICATION_STATUS} value={application.status} />
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Applied on {formatDay(application.applied_on, true)}
                  </p>
                  {application.status_note && (
                    <p className="text-sm text-muted-foreground">{application.status_note}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card tier="tier2">
        <CardHeader>
          <CardTitle>Upcoming interviews</CardTitle>
        </CardHeader>
        <CardContent>
          {data.interviews.length === 0 ? (
            <EmptyState
              tier="tier2"
              icon={CalendarClock}
              title="No interviews scheduled"
              description="When the recruiter schedules an interview with you, it will appear here."
              className="py-6"
            />
          ) : (
            <ul className="space-y-4">
              {data.interviews.map((interview) => {
                const link = safeHref(interview.location_or_link);
                return (
                  <li key={interview.id} className="space-y-2 rounded-lg border border-border p-4">
                    <p className="font-medium text-foreground">{interview.stage_name}</p>
                    <p className="text-sm text-foreground tabular-nums">
                      {formatLocalWallClock(interview.start_local)}{" "}
                      <span className="text-muted-foreground">({interview.timezone})</span>
                    </p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {interview.duration_minutes} minutes · {INTERVIEW_MODE[interview.mode] ?? humanize(interview.mode)}
                    </p>
                    {link ? (
                      <Button asChild variant="default" size="sm">
                        <a href={link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink /> Join interview
                        </a>
                      </Button>
                    ) : interview.location_or_link && interview.mode === "in_person" ? (
                      <p className="text-sm text-muted-foreground">Location: {interview.location_or_link}</p>
                    ) : null}
                    {interview.preparation_notes && (
                      <div className="rounded-md bg-muted/50 p-3 text-sm text-foreground">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">How to prepare</p>
                        <p className="whitespace-pre-line">{interview.preparation_notes}</p>
                      </div>
                    )}
                    {interview.can_request_reschedule && (
                      <RescheduleRequestDialog
                        token={token}
                        interviewId={interview.id}
                        stageName={interview.stage_name}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card tier="tier2">
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Documents you have shared with {data.organisation}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {data.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have not uploaded any documents yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.documents.map((document, index) => (
                <li key={index} className="flex items-center gap-3 py-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{document.file_name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {humanize(document.category)} · uploaded {formatDay(document.uploaded_on, true)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">Upload a document</p>
            <DocumentUploadForm token={token} rules={data.document_rules} onUploaded={reload} />
          </div>
        </CardContent>
      </Card>

      {data.retention_note && (
        <p className="text-xs text-muted-foreground">{data.retention_note}</p>
      )}
    </div>
  );
}
