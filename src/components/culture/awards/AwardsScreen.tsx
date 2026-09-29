"use client";

import { Award, Gavel, Plus, Trophy, Vote } from "lucide-react";
import { useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { AwardCycle, AwardProgramme, AwardResult } from "@/lib/types/culture";
import { formatDate } from "@/lib/utils";

import { CYCLE_STATUS } from "./cycleStatus";
import { CycleManageSheet } from "./CycleManageSheet";
import { JuryDialog } from "./JuryDialog";
import { NominateDialog } from "./NominateDialog";
import { NewCycleDialog, NewProgrammeDialog } from "./ProgrammeDialogs";

/**
 * Culture → Awards.
 *
 * Anyone may nominate while a window is open, with a citation — a name with no
 * case attached is a vote. Jurors score each nomination against the criteria
 * without seeing who nominated it or, until they submit, what the others gave:
 * both are anchoring, and anchoring is how awards become popularity contests.
 */
export function AwardsScreen() {
  const { hasRole, user } = useAuth();
  const isHr = hasRole("tenant_admin", "hr_admin", "hr_ops");

  const cycles = useApiQuery<AwardCycle[]>("/culture/award-cycles");
  const results = useApiQuery<AwardResult[]>("/culture/award-results");
  const programmes = useApiQuery<AwardProgramme[]>(isHr ? "/culture/award-programmes" : null);

  const [nominating, setNominating] = useState<AwardCycle | null>(null);
  const [scoring, setScoring] = useState<AwardCycle | null>(null);
  const [managing, setManaging] = useState<AwardCycle | null>(null);
  const [newProgramme, setNewProgramme] = useState(false);
  const [newCycle, setNewCycle] = useState(false);

  const visibleCycles = (cycles.data ?? []).filter(
    (cycle) => isHr || (cycle.status !== "draft" && cycle.status !== "cancelled"),
  );

  return (
    <PageShell
      tier="tier2"
      title="Awards"
      description="Nominate people for the work that deserves more than a thank-you, and see who won."
    >
      <Tabs defaultValue="cycles">
        <TabsList>
          <TabsTrigger value="cycles">Award cycles</TabsTrigger>
          <TabsTrigger value="winners">Winners</TabsTrigger>
          {isHr && <TabsTrigger value="programmes">Programmes</TabsTrigger>}
        </TabsList>

        <TabsContent value="cycles" className="mt-4">
          <DataPanel
            tier="tier2"
            title="Award cycles"
            actions={
              isHr ? (
                <Button size="sm" onClick={() => setNewCycle(true)} disabled={(programmes.data ?? []).length === 0}>
                  <Plus /> Open a cycle
                </Button>
              ) : undefined
            }
            isLoading={cycles.isLoading}
            error={cycles.error?.detail ?? null}
            onRetry={cycles.reload}
            isEmpty={visibleCycles.length === 0}
            empty={{ icon: Award, title: "No award cycles running", description: "When nominations open, they appear here." }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Nominations</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleCycles.map((cycle) => {
                  const status = CYCLE_STATUS[cycle.status];
                  return (
                    <TableRow key={cycle.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {cycle.programme_name} — {cycle.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {cycle.categories.map((category) => category.name).join(" · ")}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(cycle.nominations_open_on)} – {formatDate(cycle.nominations_close_on)}
                        <div className="text-xs text-muted-foreground">
                          {cycle.nomination_count} nomination{cycle.nomination_count === 1 ? "" : "s"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {cycle.is_juror && (
                          <Badge variant="outline" className="ml-1">
                            You are on the jury
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {cycle.status === "nominations_open" && cycle.window_state === "open" && user?.employee_id && (
                            <Button size="sm" onClick={() => setNominating(cycle)}>
                              <Vote /> Nominate
                            </Button>
                          )}
                          {cycle.is_juror && cycle.status === "jury_scoring" && (
                            <Button size="sm" variant="outline" onClick={() => setScoring(cycle)}>
                              <Gavel /> Score
                            </Button>
                          )}
                          {isHr && (
                            <Button size="sm" variant="outline" onClick={() => setManaging(cycle)}>
                              Manage
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

        <TabsContent value="winners" className="mt-4">
          <DataPanel
            tier="tier2"
            title="Winners"
            isLoading={results.isLoading}
            error={results.error?.detail ?? null}
            onRetry={results.reload}
            isEmpty={(results.data ?? []).length === 0}
            empty={{ icon: Trophy, title: "No awards announced yet" }}
          >
            <ul className="divide-y divide-border">
              {(results.data ?? []).map((result) => (
                <li key={result.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <PersonCell
                      name={result.employee.name}
                      photoUrl={result.employee.photo_url}
                      subtitle={`${result.programme_name}${result.category_name ? ` — ${result.category_name}` : ""}`}
                    />
                    <p className="mt-2 text-sm whitespace-pre-line text-foreground">{result.citation}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {formatDate(result.awarded_on)}
                    {!result.announced_at && (
                      <div>
                        <Badge variant="outline">Not yet announced</Badge>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </DataPanel>
        </TabsContent>

        {isHr && (
          <TabsContent value="programmes" className="mt-4">
            <DataPanel
              tier="tier2"
              title="Programmes"
              description="A programme defines the categories and the criteria jurors score against. Cycles run it."
              actions={
                <Button size="sm" onClick={() => setNewProgramme(true)}>
                  <Plus /> New programme
                </Button>
              }
              isLoading={programmes.isLoading}
              error={programmes.error?.detail ?? null}
              onRetry={programmes.reload}
              isEmpty={(programmes.data ?? []).length === 0}
              empty={{ icon: Award, title: "No programmes yet" }}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Programme</TableHead>
                    <TableHead>Cadence</TableHead>
                    <TableHead>Categories</TableHead>
                    <TableHead>Criteria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(programmes.data ?? []).map((programme) => (
                    <TableRow key={programme.id} className={programme.is_active ? undefined : "opacity-60"}>
                      <TableCell>
                        <div className="font-medium text-foreground">{programme.name}</div>
                        {programme.description && (
                          <div className="max-w-md text-xs text-muted-foreground">{programme.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm capitalize">{programme.cadence.replace("_", " ")}</TableCell>
                      <TableCell className="text-xs">{programme.categories.map((c) => c.name).join(", ")}</TableCell>
                      <TableCell className="text-xs">
                        {programme.criteria.map((c) => `${c.name}${c.weight && c.weight > 1 ? ` ×${c.weight}` : ""}`).join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataPanel>
          </TabsContent>
        )}
      </Tabs>

      <NominateDialog cycle={nominating} onOpenChange={(open) => !open && setNominating(null)} onDone={cycles.reload} />
      <JuryDialog cycle={scoring} onOpenChange={(open) => !open && setScoring(null)} />
      <CycleManageSheet
        cycle={managing}
        onOpenChange={(open) => !open && setManaging(null)}
        onChanged={() => {
          cycles.reload();
          results.reload();
        }}
      />
      <NewProgrammeDialog open={newProgramme} onOpenChange={setNewProgramme} onCreated={programmes.reload} />
      <NewCycleDialog
        open={newCycle}
        programmes={(programmes.data ?? []).filter((programme) => programme.is_active)}
        onOpenChange={setNewCycle}
        onCreated={cycles.reload}
      />
    </PageShell>
  );
}
