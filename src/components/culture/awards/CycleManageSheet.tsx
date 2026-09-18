"use client";

import { Crown, Info, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post, put } from "@/lib/api";
import type { AwardCycle, AwardCycleStatus, Standings } from "@/lib/types/culture";

import { apiDetail } from "../cultureShared";
import { CYCLE_STATUS } from "./cycleStatus";

/** The moves a cycle may make from each state — mirrors `_TRANSITIONS` in awards_portal. */
const NEXT: Record<AwardCycleStatus, { to: AwardCycleStatus; label: string; destructive?: boolean }[]> = {
  draft: [
    { to: "nominations_open", label: "Open nominations" },
    { to: "cancelled", label: "Cancel cycle", destructive: true },
  ],
  nominations_open: [
    { to: "jury_scoring", label: "Close nominations, start scoring" },
    { to: "cancelled", label: "Cancel cycle", destructive: true },
  ],
  jury_scoring: [
    { to: "decided", label: "Mark decided" },
    { to: "nominations_open", label: "Reopen nominations" },
    { to: "cancelled", label: "Cancel cycle", destructive: true },
  ],
  decided: [
    { to: "announced", label: "Announce winners" },
    { to: "jury_scoring", label: "Back to scoring" },
  ],
  announced: [],
  cancelled: [],
};

/**
 * HR's view of one cycle: the standings, winner declaration and the status moves.
 *
 * Standings show jury spread and who has not scored yet, because a winner
 * declared while two of five jurors are outstanding is a result the jury did
 * not reach. Announcing posts each winner to the feed.
 */
export function CycleManageSheet({
  cycle,
  onOpenChange,
  onChanged,
}: {
  cycle: AwardCycle | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const standings = useApiQuery<Standings>(cycle ? `/culture/award-cycles/${cycle.id}/standings` : null);
  const [moving, setMoving] = useState<{ to: AwardCycleStatus; label: string; destructive?: boolean } | null>(null);
  const [declaring, setDeclaring] = useState<string | null>(null);

  const status = standings.data?.status ?? cycle?.status ?? "draft";

  const move = async () => {
    if (!cycle || !moving) return;
    try {
      await put(`/culture/award-cycles/${cycle.id}/status`, { status: moving.to });
      toast.success(`${moving.label}: done.`);
      standings.reload();
      onChanged();
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not change the cycle."));
      throw caught;
    }
  };

  const declare = async (nominationId: string) => {
    setDeclaring(nominationId);
    try {
      await post("/culture/award-results", { nomination_id: nominationId });
      toast.success("Winner recorded. It is posted to the feed when the cycle is announced.");
      standings.reload();
      onChanged();
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not declare the winner."));
    } finally {
      setDeclaring(null);
    }
  };

  return (
    <Sheet open={cycle !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {cycle?.programme_name} — {cycle?.label}
          </SheetTitle>
          <SheetDescription>
            <Badge variant={CYCLE_STATUS[status].variant}>{CYCLE_STATUS[status].label}</Badge>{" "}
            {cycle && `${cycle.juror_count} juror${cycle.juror_count === 1 ? "" : "s"}`}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-6">
          {NEXT[status].length > 0 && (
            <div className="flex flex-wrap gap-2">
              {NEXT[status].map((option) => (
                <Button
                  key={option.to}
                  size="sm"
                  variant={option.destructive ? "outline" : "default"}
                  className={option.destructive ? "text-destructive" : undefined}
                  onClick={() => setMoving(option)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          )}

          {standings.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : standings.error ? (
            <ErrorState message={standings.error.detail} onRetry={standings.reload} />
          ) : standings.data ? (
            <>
              <Alert>
                <Info />
                <AlertTitle>At least {standings.data.minimum_jurors} jurors per nomination</AlertTitle>
                <AlertDescription>{standings.data.note}</AlertDescription>
              </Alert>
              {standings.data.categories.map((category) => (
                <section key={category.category_key} className="grid gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {category.category_name ?? category.category_key}
                    {category.tied && (
                      <Badge variant="warning" className="ml-2">
                        Tied
                      </Badge>
                    )}
                  </h3>
                  {category.note && <p className="text-xs text-muted-foreground">{category.note}</p>}
                  {category.ranked.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No scored nominations yet.</p>
                  ) : (
                    <ol className="grid gap-2">
                      {category.ranked.map((row, index) => {
                        const nomination = standings.data!.nominations[row.nomination_id];
                        const leading = category.leading.includes(row.nomination_id);
                        const outstanding = nomination?.outstanding_jurors ?? [];
                        return (
                          <li
                            key={row.nomination_id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <span className="text-muted-foreground tabular-nums">{index + 1}.</span>
                                {nomination?.nominee.name ?? row.nominee_id}
                                {nomination?.won && (
                                  <Badge variant="success">
                                    <Crown /> Winner
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Mean {row.mean_score.toFixed(2)} from {row.juror_count} juror
                                {row.juror_count === 1 ? "" : "s"} · spread {row.spread.toFixed(1)}
                                {outstanding.length > 0 && ` · waiting on ${outstanding.length}`}
                              </div>
                            </div>
                            {leading && !nomination?.won && (status === "jury_scoring" || status === "decided") && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={declaring !== null}
                                onClick={() => declare(row.nomination_id)}
                              >
                                {declaring === row.nomination_id && <Loader2 className="animate-spin" />} Declare winner
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {category.awaiting_jury.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {category.awaiting_jury.length} nomination{category.awaiting_jury.length === 1 ? "" : "s"} not
                      yet scored by enough jurors.
                    </p>
                  )}
                </section>
              ))}
            </>
          ) : null}
        </div>

        <ConfirmDialog
          open={moving !== null}
          onOpenChange={(open) => !open && setMoving(null)}
          title={`${moving?.label ?? ""}?`}
          description={
            moving?.to === "announced"
              ? "Each winner is posted to the company feed. This cannot be taken back."
              : moving?.to === "cancelled"
                ? "The cycle ends with no winners. Nominations are kept but cannot be scored."
                : "Nominators and jurors see the new state straight away."
          }
          confirmLabel={moving?.label ?? "Confirm"}
          destructive={moving?.destructive}
          onConfirm={move}
        />
      </SheetContent>
    </Sheet>
  );
}
