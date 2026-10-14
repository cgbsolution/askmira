"use client";

import { EyeOff, Info } from "lucide-react";
import { useState } from "react";

import { SurveyThemesCard } from "@/components/ai/SurveyThemesCard";
import { ErrorState } from "@/components/common/ErrorState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { EnpsResult, SurveyResults } from "@/lib/types/culture";
import { cn } from "@/lib/utils";

const GROUPINGS = [
  { value: "department_key", label: "By department" },
  { value: "location_key", label: "By location" },
  // Nothing finer than a team: a finer slice is one that identifies people.
  { value: "group_key", label: "By team" },
];

function isEnps(overall: SurveyResults["overall"]): overall is EnpsResult {
  return typeof overall === "object" && overall !== null && "promoters" in overall;
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * A heatmap cell's shade: how far a group sits from the overall score, as a
 * share of the scale's range, so the same gap reads the same on any instrument.
 */
function heat(value: number, overall: number | undefined, bounds: [number, number] | undefined): string {
  if (overall === undefined || !bounds) return "";
  const span = bounds[1] - bounds[0];
  if (span <= 0) return "";
  const share = (value - overall) / span;
  if (share >= 0.1) return "bg-mint-200 dark:bg-mint-900/50";
  if (share >= 0.04) return "bg-mint-100 dark:bg-mint-900/25";
  if (share <= -0.1) return "bg-destructive/20";
  if (share <= -0.04) return "bg-destructive/10";
  return "";
}

/**
 * Results for one survey, as anybody allowed to see them sees them.
 *
 * Suppressed groups are listed as suppressed rather than dropped, so the
 * reader knows a group exists and why its number is not there — an absent
 * row reads as "nobody from that team" when it means "too few to show".
 */
export function ResultsSheet({
  survey,
  onOpenChange,
}: {
  survey: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [groupBy, setGroupBy] = useState("department_key");
  const { data, error, isLoading, reload } = useApiQuery<SurveyResults>(
    survey ? `/culture/surveys/${survey.id}/results?group_by=${groupBy}` : null,
  );

  const themes = data && !isEnps(data.overall) ? Object.keys(data.overall) : [];

  return (
    <Sheet open={survey !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{survey?.name}</SheetTitle>
          <SheetDescription>
            {data ? `${data.responses} responses · groups below ${data.min_responses_to_report} are withheld.` : " "}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-6">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : error ? (
            <ErrorState message={error.detail} onRetry={reload} />
          ) : data ? (
            <>
              {data.note && (
                <Alert>
                  <Info />
                  <AlertDescription>{data.note}</AlertDescription>
                </Alert>
              )}

              {isEnps(data.overall) ? (
                <EnpsBlock result={data.overall} />
              ) : themes.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {themes.map((theme) => {
                    const delta = data.movement?.comparable ? data.movement.deltas[theme] : undefined;
                    return (
                      <div key={theme} className="rounded-lg border border-border p-3">
                        <div className="text-xs text-muted-foreground capitalize">{theme.replaceAll("_", " ")}</div>
                        <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                          {fmt((data.overall as Record<string, number>)[theme])}
                        </div>
                        {delta !== undefined && (
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {delta >= 0 ? "+" : ""}
                            {fmt(delta)} since {data.movement?.previous_wave_name}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Alert variant="warning">
                  <EyeOff />
                  <AlertTitle>Not enough responses to report</AlertTitle>
                  <AlertDescription>
                    Fewer than {data.min_responses_to_report} people responded, so nothing is shown — to anyone.
                  </AlertDescription>
                </Alert>
              )}

              {data.movement && !data.movement.comparable && (
                <p className="text-xs text-muted-foreground">{data.movement.note}</p>
              )}

              {data.groups && (
                <section className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">Heatmap</h3>
                    <Select value={groupBy} onValueChange={setGroupBy}>
                      <SelectTrigger className="w-44" aria-label="Group results by">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GROUPINGS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Group</TableHead>
                        {themes.map((theme) => (
                          <TableHead key={theme} className="text-right capitalize">
                            {theme.replaceAll("_", " ")}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-sm font-medium">Everyone</TableCell>
                        {themes.map((theme) => (
                          <TableCell key={theme} className="text-right font-medium tabular-nums">
                            {fmt((data.overall as Record<string, number>)[theme])}
                          </TableCell>
                        ))}
                      </TableRow>
                      {data.groups.map((group) => (
                        <TableRow key={group.key}>
                          <TableCell className="text-sm">
                            {group.key}
                            {!group.visible && (
                              <Badge variant="muted" className="ml-2">
                                <EyeOff /> Withheld
                              </Badge>
                            )}
                          </TableCell>
                          {themes.map((theme) => (
                            <TableCell
                              key={theme}
                              className={cn(
                                "text-right tabular-nums",
                                group.visible &&
                                  group.scores[theme] !== undefined &&
                                  heat(group.scores[theme], (data.overall as Record<string, number>)[theme], data.scale_bounds),
                              )}
                            >
                              {group.visible && group.scores[theme] !== undefined ? fmt(group.scores[theme]) : "—"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {data.scale_bounds && (
                    <p className="text-xs text-muted-foreground">
                      Shaded by distance from everyone&apos;s score on the {data.scale_bounds[0]}–{data.scale_bounds[1]} scale:
                      green is above it, red below; the darker shade is a gap of a tenth of the scale or more, the
                      lighter one of a twenty-fifth. Withheld groups are never shaded.
                    </p>
                  )}
                </section>
              )}
              {survey ? <SurveyThemesCard surveyId={survey.id} /> : null}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EnpsBlock({ result }: { result: EnpsResult }) {
  if (result.suppressed || result.score === null) {
    return (
      <Alert variant="warning">
        <EyeOff />
        <AlertTitle>Not enough responses to report</AlertTitle>
        <AlertDescription>{result.note}</AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{result.question}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="eNPS" value={String(result.score)} />
        <Stat label="Promoters" value={String(result.promoters)} />
        <Stat label="Passives" value={String(result.passives)} />
        <Stat label="Detractors" value={String(result.detractors)} />
      </div>
      <p className="text-xs text-muted-foreground">{result.note}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
