"use client";

import { Armchair, Info, Network, Search, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { EmployeeSummary } from "@/lib/types";
import type { ChartNode, OrgChart } from "@/lib/types/people";

import { POSITION_STATUS, personName } from "../labels";
import { useOrgReference } from "../useOrgReference";
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
}

/**
 * People → Org chart.
 *
 * Two charts, because they answer different questions. Reporting lines — who
 * manages whom — comes from the directory and every role may see it. Positions
 * — the approved seats, including the empty ones — comes from position
 * management, which only HR and managers may read; for everyone else that tab
 * is simply not offered, rather than offered and refused.
 */
export function OrgChartScreen() {
  const { hasRole } = useAuth();
  const canSeePositions = hasRole("tenant_admin", "hr_admin", "hr_ops", "manager");

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

function PeopleChart() {
  const { people, error, isLoading, truncated, reload, limit } = useWholeDirectory();
  const org = useOrgReference();
  const [search, setSearch] = useState("");

  const { roots, orphans, cycles } = useMemo(() => buildPeopleTree(people ?? []), [people]);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term.length < 2 || !people) return new Set<string>();
    return new Set(
      people
        .filter(
          (person) =>
            personName(person).toLowerCase().includes(term) ||
            (person.designation ?? "").toLowerCase().includes(term) ||
            person.employee_code.toLowerCase().includes(term),
        )
        .map((person) => person.id),
    );
  }, [people, search]);

  const forceOpen = useMemo(() => ancestorsOf(roots, matches), [roots, matches]);

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
            ? `${people.length.toLocaleString("en-IN")} active people, ${roots.length} at the top.`
            : undefined
        }
        toolbar={
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a person, title or employee code"
              aria-label="Find a person"
              className="pl-8"
            />
            {search.trim().length >= 2 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {matches.size} match{matches.size === 1 ? "" : "es"}
              </p>
            )}
          </div>
        }
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        isEmpty={(people ?? []).length === 0}
        empty={{ icon: Users, title: "No active people in the directory yet" }}
      >
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
                  subtitle={[node.person.designation, org.departmentName(node.person.department_id)]
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
      </DataPanel>
    </div>
  );
}

function PositionsChart() {
  const { data, error, isLoading, reload } = useApiQuery<OrgChart>("/positions/org-chart");
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
            ? `${data.total_seats} seats, ${data.vacant_seats} vacant, as of ${data.as_of}.`
            : undefined
        }
        toolbar={
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a title, position code or holder"
              aria-label="Find a position"
              className="pl-8"
            />
          </div>
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={roots.length === 0}
        empty={{
          icon: Network,
          title: "No positions defined",
          description: "Positions are created under People → Positions.",
        }}
      >
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
      </DataPanel>
    </div>
  );
}

function toSeatNode(seat: ChartNode): SeatNode {
  return { id: seat.position_id, seat, children: seat.children.map(toSeatNode) };
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
