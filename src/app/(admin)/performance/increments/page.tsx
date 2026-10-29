"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Check, CircleDollarSign, Loader2, Mail, Plus, TrendingUp, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { DataTable } from "@/components/common/data-table/DataTable";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { RequireRole } from "@/components/common/RequireRole";
import { humanize, StatusBadge, useAction } from "@/components/performance/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ADMIN } from "@/lib/access";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type {
  CycleSummary,
  EquitySnapshot,
  Headroom,
  IncrementCandidate,
  IncrementCandidates,
  IncrementCycleDetail,
  IncrementCycleSummary,
  RecommendationResult,
} from "@/lib/types/performance";
import { formatDate, formatDay, toISODate } from "@/lib/utils";
import { DatePicker } from "@/components/common/DatePicker";

const DECIMAL = /^\d+(\.\d{1,2})?$/;

export default function IncrementsPage() {
  const cycles = useApiQuery<IncrementCycleSummary[]>("/performance/cycles");
  const [picked, setPicked] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const cycleId = picked ?? cycles.data?.find((c) => c.status !== "cancelled")?.id ?? null;

  return (
    <PageShell
      title="Increments & promotions"
      description="Recommend within the rating's band, with the budget left and the pay-equity view in front of you."
      actions={
        <RequireRole roles={ADMIN}>
          <Button variant="accent" onClick={() => setCreating(true)}>
            <Plus /> New increment cycle
          </Button>
        </RequireRole>
      }
    >
      {cycles.isLoading && !cycles.data ? (
        <Skeleton className="h-40 w-full" />
      ) : cycles.error ? (
        <Card tier="tier1">
          <ErrorState message={cycles.error.detail} onRetry={cycles.reload} />
        </Card>
      ) : !cycleId ? (
        <DataPanel isEmpty empty={{ icon: TrendingUp, title: "No increment cycles", description: "HR opens an increment cycle with its matrix and budget." }} />
      ) : (
        <>
          <FormField htmlFor="inc-cycle" label="Increment cycle" className="w-80">
            <Select value={cycleId} onValueChange={setPicked}>
              <SelectTrigger id="inc-cycle" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cycles.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <CycleView key={cycleId} cycleId={cycleId} />
        </>
      )}
      {creating && <NewCycleDialog onClose={() => setCreating(false)} onDone={(id) => { setCreating(false); cycles.reload(); setPicked(id); }} />}
    </PageShell>
  );
}

function BudgetLine({ label, state }: { label: string; state: Headroom["company"] }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={state.over_budget ? "text-lg font-semibold text-destructive" : "text-lg font-semibold"}>
        <Money value={state.remaining} /> <span className="text-xs font-normal text-muted-foreground">left</span>
      </p>
      <p className="text-xs text-muted-foreground">
        <Money value={state.consumed} /> of <Money value={state.allocated} /> used
      </p>
    </div>
  );
}

function CycleView({ cycleId }: { cycleId: string }) {
  const detail = useApiQuery<IncrementCycleDetail>(`/performance/cycles/${cycleId}`);
  const candidates = useApiQuery<IncrementCandidates>(`/performance/cycles/${cycleId}/candidates`);
  const [recommending, setRecommending] = useState<IncrementCandidate | null>(null);
  const [deciding, setDeciding] = useState<{ row: IncrementCandidate; approve: boolean } | null>(null);
  const [promoting, setPromoting] = useState<IncrementCandidate | null>(null);
  const [releasing, setReleasing] = useState(false);
  const refresh = () => {
    detail.reload();
    candidates.reload();
  };

  if (detail.isLoading && !detail.data) return <Skeleton className="h-64 w-full" />;
  if (detail.error) return <ErrorState message={detail.error.detail} onRetry={detail.reload} />;
  if (!detail.data) return null;
  const { cycle, bands, viewer } = detail.data;
  const open = cycle.status === "open" || cycle.status === "approvals";

  const columns: ColumnDef<IncrementCandidate>[] = [
    {
      accessorKey: "name",
      header: "Person",
      meta: { text: (row) => [row.name, row.employee_code, row.grade, row.department].filter(Boolean).join(" · ") },
      cell: ({ row }) => (
        <PersonCell
          name={row.original.name}
          subtitle={[row.original.grade, row.original.department].filter(Boolean).join(" · ")}
          size="sm"
        />
      ),
    },
    {
      accessorKey: "rating_label",
      header: "Rating",
      meta: {
        text: (row) =>
          `${row.rating_label ?? "No rating"}${row.band ? ` (${row.band.min}–${row.band.max}%)` : ""}`,
      },
      cell: ({ row }) => (
        <>
          {row.original.rating_label ?? <span className="text-muted-foreground">No rating</span>}
          {row.original.band && (
            <span className="block text-xs text-muted-foreground">
              {row.original.band.min}–{row.original.band.max}%
            </span>
          )}
        </>
      ),
    },
    {
      accessorKey: "current_ctc",
      header: "Current CTC",
      sortingFn: "alphanumeric",
      meta: { className: "text-right tabular-nums", text: (row) => row.current_ctc ?? "No salary" },
      cell: ({ row }) =>
        row.original.current_ctc ? (
          <Money value={row.original.current_ctc} />
        ) : (
          <span className="text-muted-foreground">No salary</span>
        ),
    },
    {
      id: "recommended",
      header: "Recommended",
      accessorFn: (row) => row.recommendation?.recommended_ctc ?? null,
      sortingFn: "alphanumeric",
      meta: {
        className: "text-right tabular-nums",
        text: (row) => {
          const rec = row.recommendation;
          if (!rec) return "—";
          return [
            `${rec.percentage}% · ${rec.recommended_ctc}`,
            !rec.within_band ? "Outside band" : null,
            rec.promotion_to_grade ? `→ ${rec.promotion_to_grade}` : null,
          ]
            .filter(Boolean)
            .join(" · ");
        },
      },
      cell: ({ row }) => {
        const rec = row.original.recommendation;
        return rec ? (
          <>
            {rec.percentage}% · <Money value={rec.recommended_ctc} />
            {!rec.within_band && <Badge variant="warning" className="ml-1">Outside band</Badge>}
            {rec.promotion_to_grade && <Badge variant="accent" className="ml-1">→ {rec.promotion_to_grade}</Badge>}
          </>
        ) : (
          "—"
        );
      },
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => row.recommendation?.status ?? null,
      meta: {
        text: (row) => {
          const rec = row.recommendation;
          return [
            rec ? humanize(rec.status) : "—",
            rec?.requires_escalation ? "Over budget" : null,
            rec?.promotion_applied ? "Promoted" : null,
          ]
            .filter(Boolean)
            .join(" · ");
        },
      },
      cell: ({ row }) => {
        const rec = row.original.recommendation;
        return (
          <>
            {rec ? <StatusBadge status={rec.status} /> : "—"}
            {rec?.requires_escalation && <Badge variant="warning" className="ml-1">Over budget</Badge>}
            {rec?.promotion_applied && <Badge variant="success" className="ml-1">Promoted</Badge>}
          </>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => {
        const candidate = row.original;
        const rec = candidate.recommendation;
        return (
          <div className="flex justify-end gap-1">
            {open && candidate.can_recommend && (
              <Button size="sm" variant={rec ? "ghost" : "outline"} onClick={() => setRecommending(candidate)}>
                {rec ? "Revise" : "Recommend"}
              </Button>
            )}
            {candidate.can_decide && (
              <>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Approve"
                  onClick={() => setDeciding({ row: candidate, approve: true })}
                >
                  <Check />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Reject"
                  onClick={() => setDeciding({ row: candidate, approve: false })}
                >
                  <X />
                </Button>
              </>
            )}
            {candidate.can_promote && (
              <Button size="sm" onClick={() => setPromoting(candidate)}>
                Apply promotion
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {cycle.name} <StatusBadge status={cycle.status} />
          </CardTitle>
          <CardDescription>
            Effective {formatDay(cycle.effective_from, true)}
            {cycle.linked_appraisal_cycle_name && ` · ratings from ${cycle.linked_appraisal_cycle_name}`}
            {` · over budget: ${cycle.overage_mode === "block" ? "refused" : "escalated for approval"}`}
            {cycle.letter_release_on && ` · letters release together on ${formatDay(cycle.letter_release_on, true)}`}
            {cycle.letters_released_at && ` · released ${formatDate(cycle.letters_released_at)}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <BudgetLine label="Company budget" state={detail.data.company_budget} />
            {(candidates.data?.departments ?? []).map((d) => (
              <BudgetLine key={d.department_id ?? "none"} label={`${d.department_name} budget`} state={d.department} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {bands.map((b) => (
              <Badge key={b.rating_label} variant="secondary">
                {b.rating_label}: {b.min_percentage}–{b.max_percentage}% (suggested {b.recommended_percentage}%)
              </Badge>
            ))}
          </div>
          {viewer.can_release && !cycle.letters_released_at && (
            <Button variant="outline" onClick={() => setReleasing(true)}>
              <Mail /> Release letters
            </Button>
          )}
        </CardContent>
      </Card>

      <DataTable
        title="Recommendations"
        description="Current pay comes from each person's salary assignment and the rating from their review."
        columns={columns}
        data={candidates.data?.rows ?? []}
        getRowId={(row) => row.employee_id}
        noun="people"
        exportName="increment-recommendations"
        searchPlaceholder="Search people"
        isLoading={candidates.isLoading && !candidates.data}
        error={candidates.error?.detail}
        onRetry={candidates.reload}
        empty={{ icon: CircleDollarSign, title: "Nobody to recommend for", description: "People in your reporting line appear here." }}
      />

      {recommending && (
        <RecommendDialog
          cycleId={cycleId}
          row={recommending}
          headroom={candidates.data?.departments.find((d) => d.department_id === recommending.department_id)}
          isHr={viewer.is_hr}
          onClose={() => setRecommending(null)}
          onDone={refresh}
        />
      )}
      {deciding && <DecisionDialog {...deciding} onClose={() => setDeciding(null)} onDone={() => { setDeciding(null); refresh(); }} />}
      {promoting && <PromotionDialog row={promoting} onClose={() => setPromoting(null)} onDone={() => { setPromoting(null); refresh(); }} />}
      {releasing && <ReleaseDialog cycleId={cycleId} onClose={() => setReleasing(false)} onDone={() => { setReleasing(false); refresh(); }} />}
    </div>
  );
}

function EquityView({ equity }: { equity: EquitySnapshot }) {
  return (
    <div className="space-y-1 rounded-md bg-muted/60 px-3 py-2 text-xs">
      <p className="font-medium text-foreground">Pay equity at this number</p>
      {equity.compa_ratio && <p>Compa-ratio {equity.compa_ratio.compa_ratio}: {equity.compa_ratio.reading}</p>}
      {equity.parity ? <p>{equity.parity.reading}</p> : null}
      {equity.gender_gap ? <p>{equity.gender_gap.reading}</p> : null}
      {equity.note && <p className="text-muted-foreground">{equity.note}</p>}
    </div>
  );
}

function RecommendDialog({
  cycleId,
  row,
  headroom,
  isHr,
  onClose,
  onDone,
}: {
  cycleId: string;
  row: IncrementCandidate;
  headroom?: Headroom;
  isHr: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const rec = row.recommendation;
  const [percentage, setPercentage] = useState(rec?.percentage ?? row.band?.recommended ?? "");
  const [rating, setRating] = useState(row.rating_label ?? rec?.rating_label ?? "");
  const [ctc, setCtc] = useState("");
  const [justification, setJustification] = useState(rec?.justification ?? "");
  const [promotion, setPromotion] = useState(rec?.promotion_to_grade ?? "");
  const [midpoint, setMidpoint] = useState("");
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const { busy, run } = useAction();
  const outside = row.band && DECIMAL.test(percentage) && (Number(percentage) < Number(row.band.min) || Number(percentage) > Number(row.band.max));
  const needsCtc = !row.current_ctc;
  const valid =
    DECIMAL.test(percentage) &&
    rating.trim() &&
    (!outside || justification.trim()) &&
    (!needsCtc || (isHr && DECIMAL.test(ctc))) &&
    (!midpoint || DECIMAL.test(midpoint));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Increment for {row.name}</DialogTitle>
          <DialogDescription>
            {row.band ? `${row.rating_label} earns ${row.band.min}–${row.band.max}%; ${row.band.recommended}% is the starting point.` : "Enter the rating this recommendation is for."}
          </DialogDescription>
        </DialogHeader>
        {headroom && (
          <Alert variant={headroom.department.over_budget || headroom.company.over_budget ? "destructive" : "default"}>
            <AlertTitle>
              <Money value={headroom.spendable} /> can still be allocated
            </AlertTitle>
            <AlertDescription>{headroom.note}</AlertDescription>
          </Alert>
        )}
        {!row.rating_label && (
          <FormField htmlFor="rc-rating" label="Rating">
            <Input id="rc-rating" maxLength={64} value={rating} onChange={(e) => setRating(e.target.value)} />
          </FormField>
        )}
        {needsCtc && (
          <FormField htmlFor="rc-ctc" label="Current annual CTC" hint={isHr ? "No salary assignment exists; HR may enter it." : "No salary assignment exists. Ask HR to assign a salary first."}>
            <Input id="rc-ctc" inputMode="decimal" disabled={!isHr} value={ctc} onChange={(e) => setCtc(e.target.value)} />
          </FormField>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField htmlFor="rc-pct" label="Increment %">
            <Input id="rc-pct" inputMode="decimal" value={percentage} onChange={(e) => setPercentage(e.target.value)} />
          </FormField>
          <FormField htmlFor="rc-mid" label="Band midpoint" optional hint="For the compa-ratio.">
            <Input id="rc-mid" inputMode="decimal" value={midpoint} onChange={(e) => setMidpoint(e.target.value)} />
          </FormField>
        </div>
        <FormField htmlFor="rc-promo" label="Promote to grade" optional>
          <Input id="rc-promo" maxLength={32} value={promotion} onChange={(e) => setPromotion(e.target.value)} />
        </FormField>
        <FormField htmlFor="rc-just" label="Justification" optional={!outside} hint={outside ? "Required: this is outside the rating's band." : undefined}>
          <Textarea id="rc-just" rows={3} maxLength={4000} value={justification} onChange={(e) => setJustification(e.target.value)} />
        </FormField>
        {result && (
          <div className="space-y-2">
            <Alert variant={result.budget.requires_escalation ? "destructive" : "default"}>
              <AlertTitle>
                Saved: {result.proposal.percentage}% → <Money value={result.proposal.recommended_ctc} />
              </AlertTitle>
              <AlertDescription>{result.budget.message}</AlertDescription>
            </Alert>
            <EquityView equity={result.equity} />
          </div>
        )}
        {!result && rec && <EquityView equity={rec.equity} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {result ? "Done" : "Cancel"}
          </Button>
          <Button
            disabled={!valid || busy !== null}
            onClick={async () => {
              const r = await run<RecommendationResult>("save", () =>
                post<RecommendationResult>("/performance/recommendations", {
                  cycle_id: cycleId,
                  employee_id: row.employee_id,
                  rating_label: rating.trim() || null,
                  current_ctc: needsCtc ? ctc : null,
                  percentage,
                  justification: justification.trim() || null,
                  promotion_to_grade: promotion.trim() || null,
                  band_midpoint: midpoint || null,
                }),
              );
              if (r) {
                setResult(r);
                onDone();
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />} {result ? "Save again" : "Save recommendation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DecisionDialog({ row, approve, onClose, onDone }: { row: IncrementCandidate; approve: boolean; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const { run } = useAction();
  const rec = row.recommendation!;
  return (
    <ConfirmDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={`${approve ? "Approve" : "Reject"} ${row.name}'s increment?`}
      description={`${rec.percentage}% to ${rec.recommended_ctc}${rec.requires_escalation ? ", over budget" : ""}${rec.promotion_to_grade ? `, promotion to ${rec.promotion_to_grade}` : ""}.`}
      confirmLabel={approve ? "Approve" : "Reject"}
      destructive={!approve}
      onConfirm={async () => {
        const r = await run("decide", () =>
          post(`/performance/recommendations/${rec.id}/decision`, { approve, note: note.trim() || null }),
          approve ? "Approved." : "Rejected.",
        );
        if (r === undefined) throw new Error("failed");
        onDone();
      }}
    >
      <EquityView equity={rec.equity} />
      <FormField htmlFor="dc-note" label="Note" optional>
        <Input id="dc-note" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      </FormField>
    </ConfirmDialog>
  );
}

function PromotionDialog({ row, onClose, onDone }: { row: IncrementCandidate; onClose: () => void; onDone: () => void }) {
  const [effective, setEffective] = useState(toISODate(new Date()));
  const { run } = useAction();
  const rec = row.recommendation!;
  return (
    <ConfirmDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={`Promote ${row.name} to ${rec.promotion_to_grade}?`}
      description="Grade, salary revision, position and letter are applied together through the lifecycle cascade, or not at all. A future date is approved now and applied on the day. Payroll is not re-run here."
      confirmLabel="Apply promotion"
      onConfirm={async () => {
        const r = await run("promote", () =>
          post("/performance/promotions", { recommendation_id: rec.id, effective_from: effective }),
          "Promotion applied.",
        );
        if (r === undefined) throw new Error("failed");
        onDone();
      }}
    >
      <FormField htmlFor="pr-eff" label="Effective from" hint="A past date flags arrears from that date.">
        <DatePicker id="pr-eff" value={effective} onChange={setEffective} />
      </FormField>
    </ConfirmDialog>
  );
}

function ReleaseDialog({ cycleId, onClose, onDone }: { cycleId: string; onClose: () => void; onDone: () => void }) {
  const [partial, setPartial] = useState(false);
  const { run } = useAction();
  return (
    <ConfirmDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title="Release this cycle's letters?"
      description="All approved letters go together, and only on or after the release date. Refused while approvals are outstanding unless you release partially on purpose."
      confirmLabel="Release"
      onConfirm={async () => {
        const r = await run(
          "release",
          () =>
            post<{ applied?: { arrears_not_raised?: string[] } }>(
              `/performance/cycles/${cycleId}/release-letters`,
              { force_partial: partial },
            ),
          "Letters released.",
        );
        if (r === undefined) throw new Error("failed");
        // People who moved company since the effective date: the months the
        // other company paid have no arrears raised, and HR is told so.
        const elsewhere = r.applied?.arrears_not_raised ?? [];
        if (elsewhere.length > 0) {
          toast.warning(
            `${elsewhere.length} ${elsewhere.length === 1 ? "person's" : "people's"} arrears need working out by hand`,
            { description: elsewhere.slice(0, 3).join(" "), duration: 20000 },
          );
        }
        onDone();
      }}
    >
      <div className="flex items-start gap-2">
        <Checkbox id="rl-partial" checked={partial} onCheckedChange={(v) => setPartial(v === true)} />
        <Label htmlFor="rl-partial" className="text-sm font-normal">
          Release even though some recommendations are still awaiting approval (they are named on the record)
        </Label>
      </div>
    </ConfirmDialog>
  );
}

interface BandDraft {
  rating_label: string;
  min_percentage: string;
  max_percentage: string;
  recommended_percentage: string;
}

function NewCycleDialog({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const reviewCycles = useApiQuery<CycleSummary[]>("/appraisal/cycles");
  const [name, setName] = useState("");
  const [effective, setEffective] = useState("");
  const [budget, setBudget] = useState("");
  const [mode, setMode] = useState("escalate");
  const [release, setRelease] = useState("");
  const [linked, setLinked] = useState("none");
  const [bands, setBands] = useState<BandDraft[]>([{ rating_label: "", min_percentage: "", max_percentage: "", recommended_percentage: "" }]);
  const { busy, run } = useAction();
  const bandsOk = bands.every(
    (b) =>
      b.rating_label.trim() &&
      [b.min_percentage, b.max_percentage, b.recommended_percentage].every((v) => DECIMAL.test(v)) &&
      Number(b.min_percentage) <= Number(b.recommended_percentage) &&
      Number(b.recommended_percentage) <= Number(b.max_percentage),
  );
  const valid = name.trim() && effective && DECIMAL.test(budget) && bandsOk;
  const update = (i: number, p: Partial<BandDraft>) => setBands((c) => c.map((b, idx) => (idx === i ? { ...b, ...p } : b)));
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New increment cycle</DialogTitle>
          <DialogDescription>The budget is the annual cost of the rises, not the payroll. Name each band after a rating in the linked review cycle.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <FormField htmlFor="ic-name" label="Name" className="col-span-2">
            <Input id="ic-name" maxLength={160} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField htmlFor="ic-eff" label="Effective from">
            <DatePicker id="ic-eff" value={effective} onChange={setEffective} />
          </FormField>
          <FormField htmlFor="ic-budget" label="Budget (₹ per year)">
            <Input id="ic-budget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </FormField>
          <FormField htmlFor="ic-mode" label="Over budget">
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger id="ic-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="escalate">Allow and escalate</SelectItem>
                <SelectItem value="block">Refuse</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="ic-release" label="Letters release on" optional>
            <DatePicker id="ic-release" value={release} onChange={setRelease} />
          </FormField>
          <FormField htmlFor="ic-linked" label="Ratings from" className="col-span-2">
            <Select value={linked} onValueChange={setLinked}>
              <SelectTrigger id="ic-linked" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked review cycle</SelectItem>
                {(reviewCycles.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <p className="text-sm font-medium">Increment matrix</p>
        {bands.map((b, i) => (
          <div key={i} className="grid grid-cols-4 gap-2">
            <FormField htmlFor={`bd-l-${i}`} label="Rating">
              <Input id={`bd-l-${i}`} maxLength={64} value={b.rating_label} onChange={(e) => update(i, { rating_label: e.target.value })} />
            </FormField>
            <FormField htmlFor={`bd-min-${i}`} label="Min %">
              <Input id={`bd-min-${i}`} inputMode="decimal" value={b.min_percentage} onChange={(e) => update(i, { min_percentage: e.target.value })} />
            </FormField>
            <FormField htmlFor={`bd-rec-${i}`} label="Suggested %">
              <Input id={`bd-rec-${i}`} inputMode="decimal" value={b.recommended_percentage} onChange={(e) => update(i, { recommended_percentage: e.target.value })} />
            </FormField>
            <FormField htmlFor={`bd-max-${i}`} label="Max %">
              <Input id={`bd-max-${i}`} inputMode="decimal" value={b.max_percentage} onChange={(e) => update(i, { max_percentage: e.target.value })} />
            </FormField>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setBands((c) => [...c, { rating_label: "", min_percentage: "", max_percentage: "", recommended_percentage: "" }])}>
          <Plus /> Add band
        </Button>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || busy !== null}
            onClick={async () => {
              const r = await run<{ cycle_id: string }>(
                "save",
                () =>
                  post<{ cycle_id: string }>("/performance/cycles", {
                    name: name.trim(),
                    effective_from: effective,
                    budget_total: budget,
                    overage_mode: mode,
                    letter_release_on: release || null,
                    linked_appraisal_cycle_id: linked === "none" ? null : linked,
                    bands: bands.map((b) => ({ ...b, rating_label: b.rating_label.trim() })),
                  }),
                "Increment cycle opened.",
              );
              if (r) onDone(r.cycle_id);
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Open cycle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
