"use client";

import { ExternalLink, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import React, { useMemo, useState } from "react";

import { DatePicker } from "@/components/common/DatePicker";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { CompanionCardView } from "@/components/companion/CompanionCards";
import type { CompanionCard } from "@/components/companion/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { HR, roleAllows } from "@/lib/access";

type Product = "expense" | "interview";

interface ViewConfig {
  title: string;
  description: string;
  /** Statuses the page may narrow to; none = no status filter. */
  statuses?: string[];
  search?: string;
  dates?: boolean;
  /** Totals: HR may switch between their own and the whole company. */
  scopeToggle?: boolean;
}

const BRAND: Record<Product, string> = { expense: "ExpenseGenie", interview: "AnytimeHire" };

const VIEWS: Record<Product, Record<string, ViewConfig>> = {
  expense: {
    mine: {
      title: "My claims",
      description: "Your expense claims in ExpenseGenie, as they stand there now.",
      statuses: ["pending", "approved", "rejected", "draft"],
      search: "Title, category or person",
      dates: true,
    },
    approvals: {
      title: "Waiting for me",
      description: "Claims in ExpenseGenie waiting for your approval. Approve or reject them in ExpenseGenie.",
      search: "Title, category or person",
      dates: true,
    },
    company: {
      title: "Company claims",
      description: "Everyone's expense claims in ExpenseGenie. For HR.",
      statuses: ["pending", "approved", "rejected", "draft"],
      search: "Title, category or person",
      dates: true,
    },
    totals: {
      title: "Totals",
      description: "Expense totals in ExpenseGenie by status and category, and approved claims not yet paid.",
      statuses: ["pending", "approved", "rejected", "draft"],
      dates: true,
      scopeToggle: true,
    },
  },
  interview: {
    overview: {
      title: "Hiring overview",
      description: "Jobs, candidates and interviews in AnytimeHire at a glance.",
    },
    jobs: {
      title: "Jobs",
      description: "Jobs in AnytimeHire with their openings, applicants and interviews held. Open a job to see its candidates and their résumés.",
      statuses: ["open", "draft", "inactive", "finished"],
      search: "Job title or department",
    },
    candidates: {
      title: "Candidates",
      description: "Candidates in AnytimeHire. Open a row to see the job's candidates and résumés there.",
      statuses: ["applied", "interview", "offered", "selected", "hired", "rejected"],
      search: "Candidate name or job title",
    },
    interviews: {
      title: "Interviews",
      description: "Interviews in AnytimeHire, the next 14 days unless you pick dates.",
      search: "Candidate name or job title",
      dates: true,
    },
  },
};

const ALL = "all";

/**
 * A linked product's records as a portal page (Expenses or Hiring when the
 * workspace uses ExpenseGenie or AnytimeHire). Read live from the product as
 * the person signed in; nothing is copied into AskMira. The work itself —
 * filing, approving, scheduling — happens in the product.
 */
export function LinkedProductView({ product, view }: { product: string; view: string }) {
  const config = (VIEWS as Record<string, Record<string, ViewConfig>>)[product]?.[view];
  const { user } = useAuth();
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [scope, setScope] = useState<"mine" | "company">("mine");

  const path = useMemo(() => {
    if (!config) return null;
    const params = new URLSearchParams();
    if (status !== ALL) params.set("status", status);
    if (applied) params.set("query", applied);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (config.scopeToggle && scope === "company") params.set("scope", "company");
    const query = params.toString();
    return `/products/${product}/views/${view}${query ? `?${query}` : ""}`;
  }, [config, product, view, status, applied, from, to, scope]);

  const { data, error, isLoading, reload } = useApiQuery<{ cards: CompanionCard[] }>(path);

  if (!config) {
    return (
      <PageShell title="Not found">
        <ErrorState message="There is no such page." />
      </PageShell>
    );
  }
  const brand = BRAND[product as Product];
  const isHr = roleAllows(user, HR);

  return (
    <PageShell
      title={config.title}
      description={config.description}
      tier={product === "expense" ? "tier1" : "tier2"}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={reload} disabled={isLoading}>
            <RefreshCw /> Refresh
          </Button>
          <Button asChild>
            <Link href={`/launch/${product}`} target="_blank" rel="noopener">
              <ExternalLink /> Open {brand}
            </Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        {config.statuses || config.search || config.dates || (config.scopeToggle && isHr) ? (
          <Card tier={product === "expense" ? "tier1" : "tier2"}>
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              {config.scopeToggle && isHr ? (
                <FormField label="Whose" htmlFor="linked-scope" className="w-40">
                  <Select value={scope} onValueChange={(value) => setScope(value as "mine" | "company")}>
                    <SelectTrigger id="linked-scope">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mine">Mine</SelectItem>
                      <SelectItem value="company">Whole company</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              ) : null}
              {config.statuses ? (
                <FormField label="Status" htmlFor="linked-status" className="w-40">
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="linked-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All</SelectItem>
                      {config.statuses.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value.charAt(0).toUpperCase() + value.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              ) : null}
              {config.dates ? (
                <>
                  <FormField label="From" htmlFor="linked-from" className="w-44">
                    <DatePicker id="linked-from" value={from} onChange={setFrom} />
                  </FormField>
                  <FormField label="To" htmlFor="linked-to" className="w-44">
                    <DatePicker id="linked-to" value={to} onChange={setTo} />
                  </FormField>
                </>
              ) : null}
              {config.search ? (
                <form
                  className="flex flex-1 items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setApplied(search.trim());
                  }}
                >
                  <FormField label="Search" htmlFor="linked-search" className="min-w-48 flex-1">
                    <Input
                      id="linked-search"
                      value={search}
                      placeholder={config.search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </FormField>
                  <Button type="submit" variant="outline">
                    <Search /> Search
                  </Button>
                </form>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {isLoading && !data ? (
          <Skeleton className="h-64 w-full" />
        ) : error ? (
          <ErrorState message={error.detail} onRetry={reload} />
        ) : (
          (data?.cards ?? []).map((card, index) => <CompanionCardView key={index} card={card} />)
        )}
      </div>
    </PageShell>
  );
}
