"use client";

import { ArrowLeft, Trash2, UserX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { RequireRole } from "@/components/common/RequireRole";
import { CandidateMoveMenu } from "@/components/hiring/CandidateMoveMenu";
import { CandidatePortalLinkDialog } from "@/components/hiring/CandidatePortalLinkDialog";
import {
  CandidateApplications,
  CandidateConsent,
  CandidateDocuments,
  CandidateDownloadButton,
  CandidateDuplicates,
  CandidateHistory,
  CandidateInterviews,
  CandidateOffers,
  CandidateOverview,
  CandidateReferral,
} from "@/components/hiring/CandidateProfileSections";
import { CandidateScores } from "@/components/hiring/CandidateScores";
import { CANDIDATE_STAGE, StatusBadge } from "@/components/hiring/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ADMIN, HR } from "@/lib/access";
import { ApiError, post } from "@/lib/api";
import type { CandidateProfile } from "@/lib/types/hiring";

/** One candidate: their record, interviews, scores, consent and history. */
export default function CandidateProfilePage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : null;
  const { data, error, isLoading, reload } = useApiQuery<CandidateProfile>(
    id ? `/hiring/candidates/${id}` : null,
  );
  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseReason, setEraseReason] = useState("");

  const back = (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/hiring/candidates">
        <ArrowLeft /> Candidates
      </Link>
    </Button>
  );

  if (isLoading && !data) {
    return (
      <PageShell title="Candidate">
        <div className="space-y-4">
          <Skeleton className="h-16 w-80" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell title="Candidate" actions={back}>
        <Card tier="tier1">
          <CardContent>
            {error?.status === 404 ? (
              <EmptyState
                icon={UserX}
                title="This candidate is not visible to you"
                description="They may be on a requisition you are not part of, or the record no longer exists."
              />
            ) : (
              <ErrorState
                message={error?.detail ?? "The candidate could not be loaded."}
                onRetry={error?.status === 403 ? undefined : reload}
              />
            )}
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const profile = data;
  const c = profile.candidate;

  const erase = async () => {
    try {
      const reason = eraseReason.trim();
      await post(
        `/careers/candidates/${c.id}/erase${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`,
      );
      toast.success("Personal data erased");
      setEraseReason("");
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The data could not be erased.");
      throw caught;
    }
  };

  return (
    <PageShell title={c.full_name} description="Candidate profile" actions={back}>
      <Card tier="tier1">
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <PersonCell
              size="lg"
              name={c.full_name}
              subtitle={
                <Link
                  href={`/hiring/candidates?requisition_id=${profile.requisition.id}`}
                  className="hover:underline"
                >
                  {profile.requisition.code} · {profile.requisition.title}
                </Link>
              }
            />
            <StatusBadge map={CANDIDATE_STAGE} value={c.stage} />
          </div>
          <div className="flex flex-wrap gap-2">
            <CandidateMoveMenu
              candidate={c}
              allowedMoves={profile.allowed_moves}
              onMoved={reload}
              size="default"
              variant="default"
            />
            {c.has_resume && (
              <CandidateDownloadButton
                path={`/hiring/candidates/${c.id}/resume`}
                fallbackName="resume.pdf"
                label="Download resume"
              />
            )}
            <RequireRole roles={HR}>
              <CandidatePortalLinkDialog candidateId={c.id} />
            </RequireRole>
            <RequireRole roles={ADMIN}>
              <Button variant="outline" onClick={() => setEraseOpen(true)}>
                <Trash2 /> Erase personal data
              </Button>
            </RequireRole>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="gap-4">
        <div className="no-scrollbar overflow-x-auto">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="interviews">Interviews</TabsTrigger>
            <TabsTrigger value="scores">Scores</TabsTrigger>
            <TabsTrigger value="consent">Consent</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            {profile.viewer_is_hr && <TabsTrigger value="offers">Offers</TabsTrigger>}
            {profile.referral && <TabsTrigger value="referral">Referral</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="overview">
          <CandidateOverview profile={profile} />
        </TabsContent>
        <TabsContent value="applications">
          <DataPanel title="Applications">
            <CandidateApplications profile={profile} />
          </DataPanel>
        </TabsContent>
        <TabsContent value="interviews">
          <DataPanel title="Interviews">
            <CandidateInterviews profile={profile} />
          </DataPanel>
        </TabsContent>
        <TabsContent value="scores">
          <CandidateScores scores={profile.scores} fit={profile.fit_score} />
        </TabsContent>
        <TabsContent value="consent">
          <DataPanel title="Consent" description="What the candidate has agreed to, per purpose.">
            <CandidateConsent profile={profile} />
          </DataPanel>
        </TabsContent>
        <TabsContent value="history">
          <DataPanel title="Stage history">
            <CandidateHistory profile={profile} />
          </DataPanel>
        </TabsContent>
        <TabsContent value="duplicates">
          <DataPanel title="Possible duplicates">
            <CandidateDuplicates profile={profile} />
          </DataPanel>
        </TabsContent>
        <TabsContent value="documents">
          <DataPanel title="Documents">
            <CandidateDocuments profile={profile} />
          </DataPanel>
        </TabsContent>
        {profile.viewer_is_hr && (
          <TabsContent value="offers">
            <DataPanel title="Offers">
              <CandidateOffers profile={profile} />
            </DataPanel>
          </TabsContent>
        )}
        {profile.referral && (
          <TabsContent value="referral">
            <DataPanel title="Referral">
              <CandidateReferral referral={profile.referral} />
            </DataPanel>
          </TabsContent>
        )}
      </Tabs>

      <ConfirmDialog
        open={eraseOpen}
        onOpenChange={setEraseOpen}
        title={`Erase ${c.full_name}'s personal data?`}
        description="An erasure request under the DPDP Act. Their personal data is removed and this cannot be undone. The consent record is kept, so the request itself stays answerable."
        confirmLabel="Erase personal data"
        destructive
        onConfirm={erase}
      >
        <FormField htmlFor="erase-reason" label="Reason" optional hint="Kept in the audit log.">
          <Input
            id="erase-reason"
            maxLength={500}
            placeholder="Candidate requested deletion"
            value={eraseReason}
            onChange={(event) => setEraseReason(event.target.value)}
          />
        </FormField>
      </ConfirmDialog>
    </PageShell>
  );
}
