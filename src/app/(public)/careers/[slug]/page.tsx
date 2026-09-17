import { BriefcaseBusiness, CalendarDays, Clock, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import React from "react";

import { CareersJobFilters } from "@/components/careers/CareersJobFilters";
import { experienceRange, firstParam, loadCareersPage } from "@/components/careers/data";
import { PrivacyNotice } from "@/components/careers/PrivacyNotice";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { humanize, safeHref } from "@/components/hiring/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDay } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function queryFrom(search: Record<string, string | string[] | undefined>) {
  const values = {
    department_id: firstParam(search.department_id),
    location_id: firstParam(search.location_id),
    search: firstParam(search.search),
  };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  return { values, query: params.toString() };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const { query } = queryFrom(await searchParams);
  const result = await loadCareersPage(slug, query);
  if (!result.ok) return { title: "Careers" };
  const { branding } = result.data;
  return {
    title: branding.seo_title || `Careers at ${branding.organisation}`,
    description: branding.seo_description || `Open roles at ${branding.organisation}.`,
  };
}

/** The organisation's public careers page: hero, open roles, culture and privacy notice. */
export default async function CareersPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const { values, query } = queryFrom(await searchParams);
  const result = await loadCareersPage(slug, query);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return <ErrorState message={result.detail} />;
  }

  const page = result.data;
  const { branding, culture } = page;
  const logo = safeHref(branding.logo_url);
  const heroImage = safeHref(branding.hero_image_url);
  const hasCulture = culture.shoutouts.length > 0 || culture.clubs.length > 0;
  const filtered = Boolean(query);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={`${branding.organisation} logo`}
              className="size-12 rounded-lg object-contain"
            />
          )}
          <p className="text-sm font-medium text-muted-foreground">{branding.organisation}</p>
        </div>
        <h1 className="font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          {branding.hero_heading || `Careers at ${branding.organisation}`}
        </h1>
        {branding.hero_subheading && (
          <p className="max-w-2xl text-base text-muted-foreground">{branding.hero_subheading}</p>
        )}
        {heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt=""
            className="aspect-[3/1] w-full rounded-2xl object-cover"
          />
        )}
        {branding.about_paragraphs.length > 0 && (
          <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-foreground">
            {branding.about_paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="open-roles" className="space-y-4">
        <h2 id="open-roles" className="font-display text-2xl font-semibold text-foreground">
          Open roles
        </h2>
        <CareersJobFilters
          key={query}
          slug={slug}
          departments={page.filters.departments}
          locations={page.filters.locations}
          initial={values}
        />
        {page.jobs.length === 0 ? (
          <Card tier="tier2">
            <EmptyState
              tier="tier2"
              icon={BriefcaseBusiness}
              title={filtered ? "No roles match these filters" : "No open roles right now"}
              description={
                filtered
                  ? "Try a different department, location or keyword."
                  : `${branding.organisation} has no published openings at the moment. Check back later.`
              }
            />
          </Card>
        ) : (
          <ul className="grid gap-3">
            {page.jobs.map((job) => {
              const experience = experienceRange(job.experience_min_years, job.experience_max_years);
              return (
                <li key={job.code}>
                  <Card tier="tier2" className="gap-3">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        <Link
                          href={`/careers/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(job.code)}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {job.title}
                        </Link>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                      {job.department && (
                        <span className="inline-flex items-center gap-1.5">
                          <BriefcaseBusiness className="size-4" /> {job.department}
                        </span>
                      )}
                      {job.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-4" /> {job.location}
                        </span>
                      )}
                      <Badge variant="secondary">{humanize(job.employment_type)}</Badge>
                      {experience && (
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          <Clock className="size-4" /> {experience}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <Users className="size-4" /> {job.openings}{" "}
                        {job.openings === 1 ? "opening" : "openings"}
                      </span>
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <CalendarDays className="size-4" /> Posted {formatDay(job.posted_on, true)}
                      </span>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {hasCulture && (
        <section aria-labelledby="culture" className="space-y-4">
          <h2 id="culture" className="font-display text-2xl font-semibold text-foreground">
            Life at {branding.organisation}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {culture.shoutouts.length > 0 && (
              <Card tier="tier2">
                <CardHeader>
                  <CardTitle>Recent recognition</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {culture.shoutouts.map((shoutout, index) => (
                      <li key={index} className="space-y-1">
                        <p className="text-sm text-foreground">{shoutout.message}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {shoutout.value && <Badge variant="accent">{shoutout.value}</Badge>}
                          <span>{formatDay(shoutout.given_on, true)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {culture.clubs.length > 0 && (
              <Card tier="tier2">
                <CardHeader>
                  <CardTitle>Clubs and communities</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {culture.clubs.map((club) => (
                      <li key={club.name}>
                        <p className="text-sm font-medium text-foreground">{club.name}</p>
                        {club.description && (
                          <p className="text-sm text-muted-foreground">{club.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="privacy" className="space-y-3 border-t border-border pt-6">
        <h2 id="privacy" className="text-base font-semibold text-foreground">
          How your application data is used
        </h2>
        <PrivacyNotice
          paragraphs={page.privacy_notice_paragraphs}
          retentionDays={page.retention_days}
          version={page.privacy_notice_version}
        />
      </section>
    </div>
  );
}
