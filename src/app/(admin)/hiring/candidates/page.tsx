"use client";

import { Search, UserPlus, Users } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { RequireRole } from "@/components/common/RequireRole";
import { CandidateFormDialog } from "@/components/hiring/CandidateFormDialog";
import { PipelineBoard } from "@/components/hiring/PipelineBoard";
import { PipelineList } from "@/components/hiring/PipelineList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useAuth } from "@/context/AuthContext";
import { HR } from "@/lib/access";
import type { Page } from "@/lib/types";
import type { CandidateSummary, RequisitionSummary, TagCount, TalentPool } from "@/lib/types/hiring";

const ALL = "all";
const PAGE_SIZE = 200;

/** Candidate pipeline, by requisition and stage. */
export default function CandidatesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <CandidatesPipeline />
    </Suspense>
  );
}

function CandidatesPipeline() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [requisitionId, setRequisitionId] = useState<string>(
    () => searchParams.get("requisition_id") || ALL,
  );
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [view, setView] = useState<"board" | "list">("board");
  const [tag, setTag] = useState<string>(ALL);
  const [poolId, setPoolId] = useState<string>(ALL);
  const { hasRole } = useAuth();
  const isHr = hasRole(...HR);
  const tags = useApiQuery<TagCount[]>("/hiring/candidate-tags");
  const pools = useApiQuery<TalentPool[]>(isHr ? "/hiring/talent-pools" : null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Follow the URL when another page links here with a different requisition.
  const urlRequisition = searchParams.get("requisition_id") || ALL;
  useEffect(() => {
    setRequisitionId(urlRequisition);
  }, [urlRequisition]);

  const chooseRequisition = (value: string) => {
    setRequisitionId(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) params.delete("requisition_id");
    else params.set("requisition_id", value);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const requisitions = useApiQuery<Page<RequisitionSummary>>("/hiring/requisitions?page=1&page_size=200");
  const requisitionOptions = requisitions.data?.items ?? [];

  const params = new URLSearchParams({ page: "1", page_size: String(PAGE_SIZE) });
  if (requisitionId !== ALL) params.set("requisition_id", requisitionId);
  if (debounced) params.set("search", debounced);
  if (tag !== ALL) params.set("tag", tag);
  if (poolId !== ALL) params.set("pool_id", poolId);
  const { data, error, isLoading, reload } = useApiQuery<Page<CandidateSummary>>(
    `/hiring/candidates?${params.toString()}`,
  );
  const candidates = data?.items ?? [];
  const selected = requisitionOptions.find((option) => option.id === requisitionId);
  const addable = requisitionOptions.filter(
    (option) => option.status === "open" || option.status === "on_hold",
  );

  const totalNote = data
    ? data.total > candidates.length
      ? `Showing ${candidates.length} of ${data.total} candidates. Choose a requisition or search to narrow it.`
      : `${data.total} candidate${data.total === 1 ? "" : "s"}`
    : undefined;

  return (
    <PageShell
      title="Candidates"
      description="Everyone in the pipeline, by requisition and stage. A move to Offer or Hired happens from the offer, never by hand."
      actions={
        <RequireRole roles={HR}>
          <Button variant="accent" onClick={() => setAddOpen(true)}>
            <UserPlus /> Add candidate
          </Button>
        </RequireRole>
      }
    >
      <DataPanel
        title={selected ? `${selected.code} · ${selected.title}` : "All requisitions"}
        description={totalNote}
        actions={
          <Tabs value={view} onValueChange={(next) => setView(next as "board" | "list")}>
            <TabsList>
              <TabsTrigger value="board">Board</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
        }
        toolbar={
          <>
            <Select value={requisitionId} onValueChange={chooseRequisition}>
              <SelectTrigger className="w-72" aria-label="Requisition">
                <SelectValue placeholder={requisitions.isLoading ? "Loading…" : "Requisition"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All requisitions</SelectItem>
                {requisitionOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.code} · {option.title}
                  </SelectItem>
                ))}
                {requisitionId !== ALL && !selected && !requisitions.isLoading && (
                  <SelectItem value={requisitionId}>Requisition from link</SelectItem>
                )}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search candidates"
                placeholder="Name, email, employer or resume words"
                className="w-64 pl-8"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            {(tags.data ?? []).length > 0 && (
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger className="w-44" aria-label="Tag">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Any tag</SelectItem>
                  {(tags.data ?? []).map((row) => (
                    <SelectItem key={row.tag} value={row.tag}>
                      {row.tag} ({row.candidates})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(pools.data ?? []).length > 0 && (
              <Select value={poolId} onValueChange={setPoolId}>
                <SelectTrigger className="w-52" aria-label="Talent pool">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Any talent pool</SelectItem>
                  {(pools.data ?? []).map((pool) => (
                    <SelectItem key={pool.id} value={pool.id}>
                      {pool.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {requisitions.error && (
              <p className="text-xs text-destructive">{requisitions.error.detail}</p>
            )}
          </>
        }
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        isEmpty={candidates.length === 0}
        empty={{
          icon: Users,
          title: debounced ? "No candidates match this search" : "No candidates yet",
          description: debounced
            ? "Try other words: names, emails, employers and resume text are all searched."
            : "Candidates appear here when they apply on the careers page, are referred, or are added by HR.",
        }}
      >
        {view === "board" ? (
          <PipelineBoard candidates={candidates} onMoved={reload} />
        ) : (
          <PipelineList candidates={candidates} onMoved={reload} />
        )}
      </DataPanel>

      <CandidateFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        requisitions={addable}
        requisitionId={addable.some((option) => option.id === requisitionId) ? requisitionId : null}
        onCreated={() => reload()}
      />
    </PageShell>
  );
}
