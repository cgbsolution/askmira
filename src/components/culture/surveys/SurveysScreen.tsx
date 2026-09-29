"use client";

import { BarChart3, ClipboardList, Loader2, Lock, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { MySurvey, SurveyStatus, SurveySummary } from "@/lib/types/culture";
import { formatDate } from "@/lib/utils";

import { apiDetail } from "../cultureShared";
import { ActionPlansTab } from "./ActionPlansTab";
import { NewSurveyDialog } from "./NewSurveyDialog";
import { RespondDialog } from "./RespondDialog";
import { ResultsSheet } from "./ResultsSheet";

const STATUS: Record<SurveyStatus, { label: string; variant: "outline" | "success" | "secondary" }> = {
  draft: { label: "Scheduled", variant: "outline" },
  open: { label: "Open", variant: "success" },
  closed: { label: "Closed", variant: "secondary" },
};

/**
 * Culture → Surveys.
 *
 * Answers are stored with no respondent column and the fact of responding is
 * stored separately, so nobody — HR included — can join the two. Results for
 * any group below the reporting threshold are withheld for every viewer:
 * there is no privileged view, because a bypass for one role is how a manager
 * eventually works out who said what.
 */
export function SurveysScreen() {
  const { hasRole } = useAuth();
  const isHr = hasRole("tenant_admin", "hr_admin", "hr_ops");
  const isManager = hasRole("tenant_admin", "hr_admin", "hr_ops", "manager");

  const mine = useApiQuery<MySurvey[]>("/culture/surveys/mine");
  const all = useApiQuery<SurveySummary[]>(isHr ? "/culture/surveys" : null);

  const [answering, setAnswering] = useState<MySurvey | null>(null);
  const [results, setResults] = useState<{ id: string; name: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState<SurveySummary | null>(null);
  const [resurveying, setResurveying] = useState(false);

  const close = async () => {
    if (!closing) return;
    try {
      await post(`/culture/surveys/${closing.id}/close`);
      toast.success(`${closing.name} closed.`);
      all.reload();
      mine.reload();
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not close the survey."));
      throw caught;
    }
  };

  const resurvey = async () => {
    setResurveying(true);
    try {
      const outcome = await post<{ created: number }>("/culture/surveys/resurvey-run");
      const created = outcome.created;
      toast.success(created ? `${created} follow-up wave${created === 1 ? "" : "s"} scheduled.` : "No follow-up waves were due.");
      all.reload();
    } catch (caught) {
      toast.error(apiDetail(caught, "The re-survey run did not complete."));
    } finally {
      setResurveying(false);
    }
  };

  return (
    <PageShell
      tier="tier2"
      title="Surveys"
      description="Say how it really is. Your answers cannot be connected to you — not by your manager, and not by HR."
    >
      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My surveys</TabsTrigger>
          {isManager && <TabsTrigger value="plans">Action plans</TabsTrigger>}
          {isHr && <TabsTrigger value="manage">Manage surveys</TabsTrigger>}
        </TabsList>

        <TabsContent value="mine" className="mt-4 flex flex-col gap-4">
          <Alert>
            <Lock />
            <AlertTitle>How anonymity works here</AlertTitle>
            <AlertDescription>
              Your answers are stored with no link to you. A separate record notes only that you
              responded, so you are not reminded again. Results for any group smaller than the
              reporting threshold are never shown to anyone.
            </AlertDescription>
          </Alert>

          <DataPanel
            tier="tier2"
            title="Surveys for you"
            isLoading={mine.isLoading}
            error={mine.error?.detail ?? null}
            onRetry={mine.reload}
            isEmpty={(mine.data ?? []).length === 0}
            empty={{ icon: ClipboardList, title: "No surveys for you right now" }}
          >
            <ul className="divide-y divide-border">
              {(mine.data ?? []).map((survey) => (
                <li key={survey.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{survey.name}</span>
                      <Badge variant={STATUS[survey.status].variant}>{STATUS[survey.status].label}</Badge>
                      {survey.has_responded && <Badge variant="success">You responded</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(survey.opens_on)} – {formatDate(survey.closes_on)}
                      {survey.instrument && ` · ${survey.instrument.items.length} questions`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {survey.is_open_now && !survey.has_responded && survey.instrument && (
                      <Button size="sm" onClick={() => setAnswering(survey)}>
                        Answer
                      </Button>
                    )}
                    {survey.status === "closed" && (
                      <Button size="sm" variant="outline" onClick={() => setResults({ id: survey.id, name: survey.name })}>
                        <BarChart3 /> Results
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </DataPanel>
        </TabsContent>

        {isManager && (
          <TabsContent value="plans" className="mt-4">
            <ActionPlansTab
              surveys={
                // HR can see every survey; a manager plans against the ones they were part of.
                isHr
                  ? (all.data ?? []).map((row) => ({ id: row.id, name: row.name }))
                  : (mine.data ?? []).filter((row) => row.status === "closed").map((row) => ({ id: row.id, name: row.name }))
              }
            />
          </TabsContent>
        )}

        {isHr && (
          <TabsContent value="manage" className="mt-4">
            <DataPanel
              tier="tier2"
              title="All surveys"
              actions={
                <>
                  <Button size="sm" variant="outline" onClick={resurvey} disabled={resurveying}>
                    {resurveying ? <Loader2 className="animate-spin" /> : <RefreshCw />} Schedule due re-surveys
                  </Button>
                  <Button size="sm" onClick={() => setCreating(true)}>
                    <Plus /> New survey
                  </Button>
                </>
              }
              isLoading={all.isLoading}
              error={all.error?.detail ?? null}
              onRetry={all.reload}
              isEmpty={(all.data ?? []).length === 0}
              empty={{ icon: ClipboardList, title: "No surveys yet" }}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Survey</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead className="text-right">Responded</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(all.data ?? []).map((survey) => {
                    const rate = survey.invited > 0 ? Math.round((survey.responded / survey.invited) * 100) : null;
                    return (
                      <TableRow key={survey.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">{survey.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {survey.instrument_name ?? "No instrument"} · reported from {survey.min_responses_to_report} responses
                            {survey.resurvey_interval_days && ` · repeats after ${survey.resurvey_interval_days} days`}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(survey.opens_on)} – {formatDate(survey.closes_on)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {survey.responded} / {survey.invited}
                          {rate !== null && <div className="text-xs text-muted-foreground">{rate}%</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS[survey.status].variant}>{STATUS[survey.status].label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setResults({ id: survey.id, name: survey.name })}>
                              Results
                            </Button>
                            {survey.status === "open" && (
                              <Button size="sm" variant="outline" onClick={() => setClosing(survey)}>
                                Close
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </DataPanel>
          </TabsContent>
        )}
      </Tabs>

      <RespondDialog
        survey={answering}
        onOpenChange={(open) => !open && setAnswering(null)}
        onDone={() => {
          mine.reload();
          all.reload();
        }}
      />
      <ResultsSheet survey={results} onOpenChange={(open) => !open && setResults(null)} />
      <NewSurveyDialog open={creating} onOpenChange={setCreating} onCreated={all.reload} />
      <ConfirmDialog
        open={closing !== null}
        onOpenChange={(open) => !open && setClosing(null)}
        title={`Close ${closing?.name ?? ""}?`}
        description="No further responses are accepted. Results are then final."
        confirmLabel="Close survey"
        onConfirm={close}
      />
    </PageShell>
  );
}
