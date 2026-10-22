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
import { RaiseHelpdeskTicketDialog } from "@/components/products/helpdesk/RaiseHelpdeskTicketDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { HR, roleAllows } from "@/lib/access";

type Product = "expense" | "interview" | "helpdesk";

interface ViewConfig {
  title: string;
  description: string;
  /** Statuses the page may narrow to; none = no status filter. */
  statuses?: string[];
  search?: string;
  dates?: boolean;
  /** Totals: HR may switch between their own and the whole company. */
  scopeToggle?: boolean;
  /** The page has a Raise a ticket button (CGB Helpdesk). */
  raise?: boolean;
}

const BRAND: Record<Product, string> = {
  expense: "ExpenseGenie",
  interview: "AnytimeHire",
  helpdesk: "CGB Helpdesk",
};

const TICKET_STATUSES = ["new", "open", "in_progress", "hold", "closed"];

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
      title: "Job openings",
      description: "Job openings in AnytimeHire with their openings, applicants and interviews held. Open a job to see its candidates and their résumés.",
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
  helpdesk: {
    tickets: {
      title: "My tickets",
      description:
        "Your IT tickets in CGB Helpdesk, as they stand there now. Open one to read the replies and answer.",
      statuses: TICKET_STATUSES,
      search: "Subject or category",
      dates: true,
      raise: true,
    },
    overview: {
      title: "Helpdesk overview",
      description: "Your tickets by status and the assets you hold. IT staff also see their queues.",
    },
    assigned: {
      title: "Assigned to me",
      description: "Tickets CGB Helpdesk has assigned to you. Work them in CGB Helpdesk; reply here or there.",
      statuses: TICKET_STATUSES,
      search: "Subject, category or person",
      dates: true,
    },
    queue: {
      title: "Unassigned queue",
      description: "The company's tickets nobody has picked up yet. Pick them up in CGB Helpdesk.",
      statuses: TICKET_STATUSES,
      search: "Subject, category or person",
      dates: true,
    },
    all: {
      title: "All tickets",
      description: "Every ticket raised by the company's people in CGB Helpdesk. For helpdesk admins.",
      statuses: TICKET_STATUSES,
      search: "Subject, category or person",
      dates: true,
    },
    assets: {
      title: "My assets",
      description: "The laptops, monitors and other assets CGB Helpdesk shows as yours now.",
    },
    register: {
      title: "Asset register",
      description: "The company's assets in CGB Helpdesk and who holds each. For IT and HR.",
      statuses: ["in_use", "spare", "retired"],
      search: "Asset code, type or model",
    },
  },
};

/** "in_progress" → "In progress". */
const optionLabel = (value: string) => {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const ALL = "all";

/**
 * A linked product's records as a portal page (Expenses, Hiring, Helpdesk or
 * Assets when the workspace uses ExpenseGenie, AnytimeHire or CGB Helpdesk).
 * Read live from the product as the person signed in; nothing is copied into
 * AskMira. The work itself — filing, approving, scheduling, fixing — happens in
 * the product; a helpdesk ticket can also be raised and answered from here.
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
          {config.raise ? <RaiseHelpdeskTicketDialog /> : null}
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
                          {optionLabel(value)}
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
