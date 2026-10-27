"use client";

import { Armchair, Download, Info, List, Network, Printer, Search, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type { ChartNode, OrgChart } from "@/lib/types/people";
import { cn, initials } from "@/lib/utils";

import { EMPLOYMENT_STATUS, NONE, POSITION_STATUS, apiMessage, personName } from "../labels";
import { useOrgReference } from "../useOrgReference";
import { OrgCanvas, type CanvasDrag } from "./OrgCanvas";
import { OrgTree, ancestorsOf, type TreeNode } from "./OrgTree";
import { useWholeDirectory } from "./useWholeDirectory";

interface PersonNode extends TreeNode {
  person: EmployeeSummary;
  children: PersonNode[];
  /** Everyone below, not just direct reports. */
  span: number;
}

interface SeatNode extends TreeNode {
  seat: ChartNode;
  children: SeatNode[];
  /** Every seat below, not just the direct ones. */
  size: number;
}

/**
 * Employees → Org chart.
 *
 * Two charts, because they answer different questions. Reporting lines — who
 * manages whom — comes from the directory and every role may see it. Positions
 * — the approved seats, including the empty ones — comes from position
 * management, which only HR and managers may read; for everyone else that tab
 * is simply not offered, rather than offered and refused.
 *
 * Each chart opens as a canvas of cards (zoom, pan, expand); the list view is
 * the same tree indented, which reads better with a screen reader and prints.
 */
export function OrgChartScreen() {
  const { hasRole } = useAuth();
  const canSeePositions = hasRole("admin", "sub_admin", "manager");

  return (
    <PageShell
      title="Org chart"
      description="Who reports to whom, and — for HR and managers — every approved seat, including the empty ones."
    >
      {canSeePositions ? (
        <Tabs defaultValue="people">
          <TabsList>
            <TabsTrigger value="people">Reporting lines</TabsTrigger>
            <TabsTrigger value="positions">Positions &amp; vacant seats</TabsTrigger>
          </TabsList>
          <TabsContent value="people" className="mt-4">
            <PeopleChart />
          </TabsContent>
          <TabsContent value="positions" className="mt-4">
            <PositionsChart />
          </TabsContent>
        </Tabs>
      ) : (
        <PeopleChart />
      )}
    </PageShell>
  );
}

/** One CSV cell, quoted, and shown rather than run by a spreadsheet. */
function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

type ChartView = "chart" | "list";
const VIEW_KEY = "askmira.org-chart.view";

/** Chart or list, remembered per browser; the list is what prints. */
function useChartView(): [ChartView, (view: ChartView) => void] {
  const [view, setView] = useState<ChartView>("chart");
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "list") setView("list");
    } catch {
      // Storage blocked: the chart is the default.
    }
  }, []);
  const choose = useCallback((next: ChartView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not remembered; it still switches.
    }
  }, []);
  return [view, choose];
}

function ViewToggle({ view, onChange }: { view: ChartView; onChange: (view: ChartView) => void }) {
  return (
    <div
      className="ml-auto flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5"
      role="group"
      aria-label="View"
    >
      <Button
        size="icon-sm"
        variant={view === "chart" ? "secondary" : "ghost"}
        aria-pressed={view === "chart"}
        aria-label="Chart view"
        title="Chart view"
        onClick={() => onChange("chart")}
        className="size-7"
      >
        <Network />
      </Button>
      <Button
        size="icon-sm"
        variant={view === "list" ? "secondary" : "ghost"}
        aria-pressed={view === "list"}
        aria-label="List view"
        title="List view"
        onClick={() => onChange("list")}
        className="size-7"
      >
        <List />
      </Button>
    </div>
  );
}

/** The first match in the order the chart reads, top to bottom. */
function firstMatch(roots: TreeNode[], matches: Set<string>): string | null {
  if (matches.size === 0) return null;
  const queue = [...roots];
  while (queue.length) {
    const node = queue.shift()!;
    if (matches.has(node.id)) return node.id;
    queue.push(...node.children);
  }
  return null;
}

const CARD_BODY = "flex flex-col items-center px-3 pt-4 pb-3 text-center";
const CARD_FOOT =
  "flex min-h-7 items-center justify-center gap-1.5 rounded-b-lg border-t border-border bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground";
const CARD_BADGE = "h-4 px-1.5 text-[10px]";

function PersonCard({
  person,
  team,
  dotted,
}: {
  person: EmployeeSummary;
  team: string;
  dotted: EmployeeSummary | undefined;
}) {
  const name = personName(person);
  const status = person.status !== "active" ? EMPLOYMENT_STATUS[person.status] : null;
  return (
    <>
      <div className={CARD_BODY}>
        <Avatar className="size-12 shadow-sm ring-2 ring-background">
          {person.photo_url && <AvatarImage src={person.photo_url} alt="" draggable={false} />}
          <AvatarFallback className="text-sm">{initials(name)}</AvatarFallback>
        </Avatar>
        <Link
          href={`/people/${person.id}`}
          draggable={false}
          className="mt-2 max-w-full truncate font-display text-[15px] leading-tight font-semibold text-foreground hover:underline"
          title={name}
        >
          {name}
        </Link>
        <p className="mt-0.5 max-w-full truncate text-xs text-foreground/80" title={person.designation ?? undefined}>
          {person.designation || "No title set"}
        </p>
        {team && (
          <p className="max-w-full truncate text-[11px] text-muted-foreground" title={team}>
            {team}
          </p>
        )}
        {dotted && (
          <p className="max-w-full truncate text-[11px] text-muted-foreground" title={`Dotted line to ${personName(dotted)}`}>
            Dotted line to {personName(dotted)}
          </p>
        )}
      </div>
      <div className={CARD_FOOT}>
        <span className="font-mono">{person.employee_code}</span>
        {status && (
          <Badge variant={status.variant} className={CARD_BADGE}>
            {status.label}
          </Badge>
        )}
      </div>
    </>
  );
}

function SeatCard({ seat }: { seat: ChartNode }) {
  const status = POSITION_STATUS[seat.status];
  return (
    <>
      <div className={CARD_BODY}>
        {seat.vacant ? (
          <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
            <Armchair className="size-5" />
          </span>
        ) : (
          <Avatar className="size-12 shadow-sm ring-2 ring-background">
            <AvatarFallback className="text-sm">{initials(seat.holder)}</AvatarFallback>
          </Avatar>
        )}
        <p
          className={cn(
            "mt-2 max-w-full truncate font-display text-[15px] leading-tight font-semibold",
            seat.vacant ? "text-success" : "text-foreground",
          )}
          title={seat.holder ?? undefined}
        >
          {seat.vacant ? "Vacant" : seat.holder}
        </p>
        <p className="mt-0.5 max-w-full truncate text-xs text-foreground/80" title={seat.title}>
          {seat.title}
        </p>
        <p className="max-w-full truncate text-[11px] text-muted-foreground">
          {[seat.department, seat.grade].filter(Boolean).join(" · ")}
        </p>
        {seat.vacant && seat.covering.length > 0 && (
          <p className="max-w-full truncate text-[11px] text-muted-foreground" title={seat.covering.join(", ")}>
            Covered by {seat.covering.join(", ")}
          </p>
        )}
      </div>
      <div className={CARD_FOOT}>
        <span className="font-mono">{seat.code}</span>
        {/* Filled or vacant already shows on the card; frozen or abolished is the news. */}
        {status && (seat.status === "frozen" || seat.status === "abolished") && (
          <Badge variant={status.variant} className={CARD_BADGE}>
            {status.label}
          </Badge>
        )}
        {Number(seat.fte) < 1 && (
          <Badge variant="outline" className={CARD_BADGE}>
            {seat.fte} FTE
          </Badge>
        )}
        {seat.vacant_below > 0 && <span>· {seat.vacant_below} vacant below</span>}
      </div>
    </>
  );
}

interface PendingMove {
  person: EmployeeSummary;
  from: EmployeeSummary | undefined;
  to: EmployeeSummary;
}

function PeopleChart() {
  const { user } = useAuth();
  const { people, error, isLoading, truncated, reload, replace, limit } = useWholeDirectory();
  const org = useOrgReference();
  const [view, setView] = useChartView();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState(NONE);
  const [location, setLocation] = useState(NONE);
  const [pending, setPending] = useState<PendingMove | null>(null);
  // HR moves people by dragging; the API accepts the same two roles.
  const canMove = user?.role === "admin" || user?.role === "sub_admin";

  const { roots, orphans, cycles } = useMemo(() => buildPeopleTree(people ?? []), [people]);
  const byId = useMemo(() => new Map((people ?? []).map((p) => [p.id, p])), [people]);

  const term = search.trim().toLowerCase();
  const filtering = term.length >= 2 || department !== NONE || location !== NONE;
  const matches = useMemo(() => {
    if (!filtering || !people) return new Set<string>();
    return new Set(
      people
        .filter(
          (person) =>
            (term.length < 2 ||
              personName(person).toLowerCase().includes(term) ||
              (person.designation ?? "").toLowerCase().includes(term) ||
              person.employee_code.toLowerCase().includes(term)) &&
            (department === NONE || person.department_id === department) &&
            (location === NONE || person.location_id === location),
        )
        .map((person) => person.id),
    );
  }, [people, term, department, location, filtering]);

  const exportCsv = () => {
    const spans = new Map<string, { direct: number; total: number }>();
    const walk = (node: PersonNode) => {
      spans.set(node.id, { direct: node.children.length, total: node.span });
      node.children.forEach(walk);
    };
    roots.forEach(walk);
    const rows = (people ?? []).filter((p) => !filtering || matches.has(p.id));
    const header = ["Employee code", "Name", "Designation", "Department", "Location", "Manager", "Manager code", "Dotted-line manager", "Direct reports", "Everyone below"];
    const lines = rows.map((p) => {
      const manager = p.manager_id ? byId.get(p.manager_id) : undefined;
      const dotted = p.dotted_line_manager_id ? byId.get(p.dotted_line_manager_id) : undefined;
      const span = spans.get(p.id);
      return [
        p.employee_code,
        personName(p),
        p.designation,
        p.department_id ? org.departmentName(p.department_id) : "",
        p.location_id ? org.locationName(p.location_id) : "",
        manager ? personName(manager) : "",
        manager?.employee_code,
        dotted ? personName(dotted) : "",
        span?.direct ?? 0,
        span?.total ?? 0,
      ]
        .map(csvCell)
        .join(",");
    });
    const blob = new Blob([[header.map(csvCell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "org-chart.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  // The chart is a canvas, so printing goes through the list, which pages properly.
  const print = () => {
    setView("list");
    setTimeout(() => window.print(), 150);
  };

  const forceOpen = useMemo(() => ancestorsOf(roots, matches), [roots, matches]);
  const focusId = useMemo(() => firstMatch(roots, matches), [roots, matches]);

  /** True when `candidate` sits anywhere under `person`: nobody can report to their own report. */
  const isBelow = useCallback(
    (candidate: EmployeeSummary, person: EmployeeSummary) => {
      const seen = new Set<string>();
      let cursor: EmployeeSummary | undefined = candidate;
      while (cursor?.manager_id && !seen.has(cursor.id)) {
        if (cursor.manager_id === person.id) return true;
        seen.add(cursor.id);
        cursor = byId.get(cursor.manager_id);
      }
      return false;
    },
    [byId],
  );

  const moveTo = useCallback(
    async (person: EmployeeSummary, managerId: string | null) => {
      const saved = await patch<EmployeeSummary>(`/employees/${person.id}`, { manager_id: managerId });
      replace(saved);
      return saved;
    },
    [replace],
  );

  const confirmMove = async () => {
    if (!pending) return;
    const { person, from, to } = pending;
    try {
      await moveTo(person, to.id);
    } catch (caught) {
      toast.error(apiMessage(caught, "The reporting line could not be changed."));
      throw caught;
    }
    toast.success(`${personName(person)} now reports to ${personName(to)}.`, {
      action: {
        label: "Undo",
        onClick: () => {
          moveTo(person, from?.id ?? null)
            .then(() =>
              toast.success(
                from
                  ? `${personName(person)} reports to ${personName(from)} again.`
                  : `${personName(person)} is back at the top level.`,
              ),
            )
            .catch((caught) => toast.error(apiMessage(caught, "Could not undo the move.")));
        },
      },
    });
  };

  const drag = useMemo<CanvasDrag<PersonNode> | undefined>(
    () =>
      canMove
        ? {
            // HR's own line is changed by somebody else, as on the profile.
            canDrag: (node) => node.id !== user?.employee_id,
            canDrop: (source, target) =>
              target.id !== source.id &&
              target.id !== source.person.manager_id &&
              !isBelow(target.person, source.person),
            onDrop: (source, target) =>
              setPending({
                person: source.person,
                from: source.person.manager_id ? byId.get(source.person.manager_id) : undefined,
                to: target.person,
              }),
          }
        : undefined,
    [canMove, user?.employee_id, isBelow, byId],
  );

  const teamOf = (person: EmployeeSummary) =>
    [
      person.department_id ? org.departmentName(person.department_id) : null,
      person.location_id ? org.locationName(person.location_id) : null,
    ]
      .filter((part) => part && part !== "—")
      .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      {truncated && (
        <Alert>
          <Info />
          <AlertTitle>Showing the first {limit.toLocaleString("en-IN")} people</AlertTitle>
          <AlertDescription>
            The workspace is larger than the chart loads at once. Search the directory for anyone
            not shown here.
          </AlertDescription>
        </Alert>
      )}
      {(orphans > 0 || cycles > 0) && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Some reporting lines do not resolve</AlertTitle>
          <AlertDescription>
            {orphans > 0 &&
              `${orphans} ${orphans === 1 ? "person reports" : "people report"} to a manager who is not active in the directory, so they are shown at the top level. `}
            {cycles > 0 &&
              `${cycles} ${cycles === 1 ? "person is" : "people are"} in a loop where a manager reports to their own report; fix the manager on their profile.`}
          </AlertDescription>
        </Alert>
      )}

      <DataPanel
        title="Reporting lines"
        description={
          people
            ? `Total: ${people.length.toLocaleString("en-IN")} people, ${roots.length} at the top.${
                canMove && view === "chart" ? " Drag a card onto someone to change who they report to." : ""
              }`
            : undefined
        }
        actions={
          <>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!people?.length}>
              <Download /> Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={print} disabled={!people?.length}>
              <Printer /> Print
            </Button>
          </>
        }
        toolbar={
          <>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a person, title or employee code"
                aria-label="Find a person"
                className="pl-8"
              />
              {filtering && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {matches.size} match{matches.size === 1 ? "" : "es"} highlighted
                </p>
              )}
            </div>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger aria-label="Team" className="w-44">
                <SelectValue placeholder="Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Every team</SelectItem>
                {org.departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger aria-label="Location" className="w-44">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Every location</SelectItem>
                {org.locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ViewToggle view={view} onChange={setView} />
          </>
        }
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        isEmpty={(people ?? []).length === 0}
        empty={{ icon: Users, title: "No active people in the directory yet" }}
      >
        {view === "chart" ? (
          <OrgCanvas
            roots={roots}
            label="Reporting lines"
            looseLabel="No manager and no reports"
            countsOf={(node) => ({ direct: node.children.length, total: node.span })}
            highlight={matches}
            forceOpen={forceOpen}
            focusId={focusId}
            drag={drag}
            renderCard={(node) => (
              <PersonCard
                person={node.person}
                team={teamOf(node.person)}
                dotted={node.person.dotted_line_manager_id ? byId.get(node.person.dotted_line_manager_id) : undefined}
              />
            )}
          />
        ) : (
          <OrgTree
            roots={roots}
            forceOpen={forceOpen}
            highlight={matches}
            renderNode={(node) => (
              <div className="flex items-center justify-between gap-3">
                <Link href={`/people/${node.person.id}`} className="min-w-0 hover:underline">
                  <PersonCell
                    name={personName(node.person)}
                    photoUrl={node.person.photo_url}
                    subtitle={[
                      node.person.designation,
                      org.departmentName(node.person.department_id),
                      node.person.dotted_line_manager_id && byId.get(node.person.dotted_line_manager_id)
                        ? `dotted line to ${personName(byId.get(node.person.dotted_line_manager_id)!)}`
                        : null,
                    ]
                      .filter((part) => part && part !== "—")
                      .join(" · ")}
                    size="sm"
                  />
                </Link>
                {node.children.length > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {node.children.length} direct · {node.span} total
                  </span>
                )}
              </div>
            )}
          />
        )}
      </DataPanel>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Change reporting line?"
        confirmLabel="Move"
        onConfirm={confirmMove}
        description={
          pending ? (
            <>
              <strong className="text-foreground">{personName(pending.person)}</strong> will report to{" "}
              <strong className="text-foreground">{personName(pending.to)}</strong>
              {pending.from ? <> instead of {personName(pending.from)}</> : <> (nobody today)</>}. Their
              own reports move with them. This takes effect today and is kept in their job history and
              the audit log.
            </>
          ) : undefined
        }
      />
    </div>
  );
}

function PositionsChart() {
  const { data, error, isLoading, reload } = useApiQuery<OrgChart>("/positions/org-chart");
  const [view, setView] = useChartView();
  const [search, setSearch] = useState("");

  const roots = useMemo(() => (data?.roots ?? []).map(toSeatNode), [data]);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    const found = new Set<string>();
    if (term.length < 2) return found;
    const walk = (node: SeatNode) => {
      const seat = node.seat;
      if (
        seat.title.toLowerCase().includes(term) ||
        seat.code.toLowerCase().includes(term) ||
        (seat.holder ?? "").toLowerCase().includes(term)
      )
        found.add(node.id);
      node.children.forEach(walk);
    };
    roots.forEach(walk);
    return found;
  }, [roots, search]);

  const forceOpen = useMemo(() => ancestorsOf(roots, matches), [roots, matches]);
  const focusId = useMemo(() => firstMatch(roots, matches), [roots, matches]);

  return (
    <div className="flex flex-col gap-4">
      {data && data.problems.length > 0 && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>The position tree has problems</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {data.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <DataPanel
        title="Positions"
        description={
          data
            ? `Total: ${data.total_seats} seats, ${data.vacant_seats} vacant, as of ${data.as_of}.`
            : undefined
        }
        toolbar={
          <>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a title, position code or holder"
                aria-label="Find a position"
                className="pl-8"
              />
              {search.trim().length >= 2 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {matches.size} match{matches.size === 1 ? "" : "es"} highlighted
                </p>
              )}
            </div>
            <ViewToggle view={view} onChange={setView} />
          </>
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={roots.length === 0}
        empty={{
          icon: Network,
          title: "No positions defined",
          description: "Positions are created under Employees → Positions.",
        }}
      >
        {view === "chart" ? (
          <OrgCanvas
            roots={roots}
            label="Positions"
            looseLabel="Positions with nothing above or below"
            countsOf={(node) => ({ direct: node.children.length, total: node.size })}
            highlight={matches}
            forceOpen={forceOpen}
            focusId={focusId}
            renderCard={(node) => <SeatCard seat={node.seat} />}
          />
        ) : (
          <OrgTree
            roots={roots}
            forceOpen={forceOpen}
            highlight={matches}
            renderNode={(node) => {
              const seat = node.seat;
              const status = POSITION_STATUS[seat.status];
              return (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{seat.title}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{seat.code}</span>
                      {status && <Badge variant={status.variant}>{status.label}</Badge>}
                      {Number(seat.fte) < 1 && <Badge variant="outline">{seat.fte} FTE</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {seat.vacant ? (
                        <span className="inline-flex items-center gap-1">
                          <Armchair className="size-3.5" /> Vacant
                          {seat.covering.length > 0 && ` — covered by ${seat.covering.join(", ")}`}
                        </span>
                      ) : (
                        seat.holder
                      )}
                      {seat.department && ` · ${seat.department}`}
                      {seat.grade && ` · ${seat.grade}`}
                    </div>
                  </div>
                  {seat.vacant_below > 0 && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {seat.vacant_below} vacant below
                    </span>
                  )}
                </div>
              );
            }}
          />
        )}
      </DataPanel>
    </div>
  );
}

function toSeatNode(seat: ChartNode): SeatNode {
  const children = seat.children.map(toSeatNode);
  return {
    id: seat.position_id,
    seat,
    children,
    size: children.reduce((sum, child) => sum + 1 + child.size, 0),
  };
}

/**
 * Reporting lines from `manager_id`.
 *
 * Anyone whose manager is missing from the active directory becomes a root and
 * is counted, as is anyone caught in a loop — both are data problems an admin
 * should see, not something to hide by dropping people from the chart.
 */
function buildPeopleTree(people: EmployeeSummary[]) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const nodes = new Map<string, PersonNode>(
    people.map((person) => [person.id, { id: person.id, person, children: [], span: 0 }]),
  );

  // A person is in a cycle if walking up their managers returns to them.
  const inCycle = new Set<string>();
  for (const person of people) {
    const seen = new Set<string>();
    let cursor: EmployeeSummary | undefined = person;
    while (cursor?.manager_id && byId.has(cursor.manager_id)) {
      if (seen.has(cursor.id)) break;
      seen.add(cursor.id);
      cursor = byId.get(cursor.manager_id);
      if (cursor?.id === person.id) {
        inCycle.add(person.id);
        break;
      }
    }
  }

  const roots: PersonNode[] = [];
  let orphans = 0;
  for (const person of people) {
    const node = nodes.get(person.id)!;
    const managerNode = person.manager_id ? nodes.get(person.manager_id) : undefined;
    if (managerNode && !inCycle.has(person.id)) {
      managerNode.children.push(node);
    } else {
      if (person.manager_id && !managerNode) orphans += 1;
      roots.push(node);
    }
  }

  const byName = (a: PersonNode, b: PersonNode) =>
    personName(a.person).localeCompare(personName(b.person));
  const finish = (node: PersonNode): number => {
    node.children.sort(byName);
    node.span = node.children.reduce((sum, child) => sum + 1 + finish(child), 0);
    return node.span;
  };
  roots.forEach(finish);
  // The largest trees first: the CEO before a contractor with no manager set.
  roots.sort((a, b) => b.span - a.span || byName(a, b));

  return { roots, orphans, cycles: inCycle.size };
}
