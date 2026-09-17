import { ArrowLeft, BriefcaseBusiness, CalendarDays, Clock, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Script from "next/script";
import React from "react";

import { ApplyForm } from "@/components/careers/ApplyForm";
import { experienceRange, loadJob } from "@/components/careers/data";
import { ErrorState } from "@/components/common/ErrorState";
import { humanize } from "@/components/hiring/labels";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string; code: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, code } = await params;
  const result = await loadJob(slug, code);
  if (!result.ok) return { title: "Job opening" };
  return {
    title: `${result.data.job.title} · ${result.data.organisation}`,
    description: result.data.job.description_paragraphs[0]?.slice(0, 160),
  };
}

/** One public job: description, skills, structured data for search engines, and the apply form. */
export default async function JobPage({ params }: { params: Params }) {
  const { slug, code } = await params;
  const result = await loadJob(slug, code);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return <ErrorState message={result.detail} />;
  }

  const data = result.data;
  const { job } = data;
  const experience = experienceRange(job.experience_min_years, job.experience_max_years);
  // `<` escaped so the JSON can never close the script element early.
  const jsonLd = JSON.stringify(data.structured_data).replace(/</g, "\\u003c");

  return (
    <div className="space-y-8">
      <Script id="job-posting-jsonld" type="application/ld+json">
        {jsonLd}
      </Script>

      <Button asChild variant="ghost" size="sm">
        <Link href={`/careers/${encodeURIComponent(slug)}`}>
          <ArrowLeft /> All roles at {data.organisation}
        </Link>
      </Button>

      <header className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">{data.organisation}</p>
        <h1 className="font-display text-3xl font-semibold leading-tight text-foreground">
          {job.title}
        </h1>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Badge variant="secondary">
            <BriefcaseBusiness /> {humanize(job.employment_type)}
          </Badge>
          {job.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" /> {job.location}
            </span>
          )}
          {experience && (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock className="size-4" /> {experience}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Users className="size-4" /> {job.openings} {job.openings === 1 ? "opening" : "openings"}
          </span>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <CalendarDays className="size-4" /> Posted {formatDay(job.posted_on, true)}
          </span>
        </div>
      </header>

      {job.description_paragraphs.length > 0 && (
        <section aria-labelledby="about-role" className="space-y-3">
          <h2 id="about-role" className="text-lg font-semibold text-foreground">
            About the role
          </h2>
          <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-foreground">
            {job.description_paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </section>
      )}

      {job.skills.length > 0 && (
        <section aria-labelledby="skills" className="space-y-3">
          <h2 id="skills" className="text-lg font-semibold text-foreground">
            Skills
          </h2>
          <ul className="flex flex-wrap gap-2">
            {job.skills.map((skill) => (
              <li key={skill}>
                <Badge variant="outline">{skill}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Apply">
        {data.allow_apply_without_account ? (
          <ApplyForm
            slug={slug}
            code={code}
            organisation={data.organisation}
            noticeVersion={data.privacy_notice_version}
            privacyParagraphs={data.privacy_notice_paragraphs}
            retentionDays={data.retention_days}
            resumeMaxMb={data.document_rules.resume_max_mb}
          />
        ) : (
          <Alert>
            <AlertDescription>
              {data.organisation} is not accepting applications through this page at the moment.
              Please contact their recruiting team directly to apply for this role.
            </AlertDescription>
          </Alert>
        )}
      </section>
    </div>
  );
}
