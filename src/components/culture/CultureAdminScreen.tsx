"use client";

import { CircleCheck, CircleSlash, Gem, Loader2, Pencil, Plus, Repeat, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { put } from "@/lib/api";
import type { ClubParticipation, CompanyValue, ValueAnalytics } from "@/lib/types/culture";

import { apiDetail } from "./cultureShared";

interface LoopRow {
  theme: string;
  plans: number;
  items: number;
  items_done: number;
  acted: boolean;
  movement: number | null;
  reading: string;
}

interface Loop {
  as_of: string;
  themes: LoopRow[];
  open_plans: number;
  overdue_plans: number;
  note: string;
}

interface Posture {
  enforced: string[];
  not_built: string[];
}

/**
 * Culture → Culture admin.
 *
 * The values everything else is tagged against, whether they show up in what
 * people actually recognise, whether survey feedback was acted on, and a plain
 * statement of what this module enforces and what it does not.
 */
export function CultureAdminScreen() {
  return (
    <PageShell
      tier="tier2"
      title="Culture admin"
      description="Company values, whether they are lived, and whether survey feedback was acted on."
    >
      <SectionNav section="culture" />
      <Tabs defaultValue="values">
        <TabsList>
          <TabsTrigger value="values">Values</TabsTrigger>
          <TabsTrigger value="analytics">Values in practice</TabsTrigger>
          <TabsTrigger value="loop">Survey follow-through</TabsTrigger>
          <TabsTrigger value="clubs">Club participation</TabsTrigger>
          <TabsTrigger value="posture">What is enforced</TabsTrigger>
        </TabsList>
        <TabsContent value="values" className="mt-4">
          <ValuesTab />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab />
        </TabsContent>
        <TabsContent value="loop" className="mt-4">
          <LoopTab />
        </TabsContent>
        <TabsContent value="clubs" className="mt-4">
          <ParticipationTab />
        </TabsContent>
        <TabsContent value="posture" className="mt-4">
          <PostureTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function ValuesTab() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("tenant_admin", "hr_admin");
  const { data, error, isLoading, reload } = useApiQuery<CompanyValue[]>("/culture/values?include_inactive=true");
  const [editing, setEditing] = useState<CompanyValue | "new" | null>(null);

  const rows = [...(data ?? [])].sort((a, b) => a.display_order - b.display_order);

  return (
    <>
      <DataPanel
        tier="tier2"
        title="Company values"
        description="Each needs a description: a one-word value gets tagged by whoever guesses hardest, and the analytics then measure the guessing."
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus /> Add value
            </Button>
          ) : undefined
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{ icon: Gem, title: "No values defined", description: "Recognition can be tagged with a value once one exists." }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Value</TableHead>
              <TableHead>What it means here</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className={row.is_active ? undefined : "opacity-60"}>
                <TableCell>
                  <div className="font-medium text-foreground">
                    {row.icon && <span className="mr-1" aria-hidden>{row.icon}</span>}
                    {row.name}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">{row.code}</div>
                </TableCell>
                <TableCell className="max-w-md text-sm text-muted-foreground">{row.description}</TableCell>
                <TableCell>
                  <Badge variant={row.is_active ? "secondary" : "outline"}>{row.is_active ? "Active" : "Retired"}</Badge>
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <Button variant="ghost" size="icon" aria-label={`Edit ${row.name}`} onClick={() => setEditing(row)}>
                      <Pencil />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
      <ValueDialog editing={editing} onOpenChange={(open) => !open && setEditing(null)} onSaved={reload} />
    </>
  );
}

function toCode(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function ValueDialog({
  editing,
  onOpenChange,
  onSaved,
}: {
  editing: CompanyValue | "new" | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const existing = editing && editing !== "new" ? editing : null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [order, setOrder] = useState("0");
  const [active, setActive] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setName(existing?.name ?? "");
    setDescription(existing?.description ?? "");
    setIcon(existing?.icon ?? "");
    setOrder(String(existing?.display_order ?? 0));
    setActive(existing?.is_active ?? true);
  }, [editing, existing]);

  const code = existing?.code ?? toCode(name);

  const submit = async () => {
    setIsBusy(true);
    try {
      await put("/culture/values", {
        code,
        name: name.trim(),
        description: description.trim(),
        icon: icon.trim() || null,
        display_order: Number(order) || 0,
        is_active: active,
      });
      toast.success("Value saved.");
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not save the value."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={editing !== null} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${existing.name}` : "Add a value"}</DialogTitle>
          <DialogDescription>
            Retire a value rather than deleting it: past recognition stays tagged with it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-[1fr_88px] gap-3">
            <FormField htmlFor="value-name" label="Name" hint={existing ? undefined : code ? `Code: ${code}` : undefined}>
              <Input id="value-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Own the outcome" />
            </FormField>
            <FormField htmlFor="value-icon" label="Emoji" optional>
              <Input id="value-icon" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
            </FormField>
          </div>
          <FormField
            htmlFor="value-description"
            label="What it looks like in practice"
            hint="Concrete enough that two people would tag the same shoutout the same way."
          >
            <Textarea id="value-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="value-order" label="Display order">
              <Input id="value-order" inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g, ""))} />
            </FormField>
            <div className="flex items-center gap-3 self-end pb-2">
              <Switch id="value-active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="value-active" className="text-sm font-normal">
                Active
              </Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || !name.trim() || !description.trim() || !code}>
            {isBusy && <Loader2 className="animate-spin" />} Save value
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnalyticsTab() {
  const { data, error, isLoading, reload } = useApiQuery<ValueAnalytics>("/culture/values/analytics");
  const sources = Object.keys(data?.coverage.totals ?? {});

  return (
    <div className="flex flex-col gap-4">
      {data && data.unlived.length > 0 && (
        <Alert variant="warning">
          <CircleSlash />
          <AlertTitle>Values nobody is recognised for</AlertTitle>
          <AlertDescription>
            {data.unlived.map((row) => row.name).join(", ")}. Either the value is not lived, or it is too vague to tag —
            both are worth knowing.
          </AlertDescription>
        </Alert>
      )}
      <DataPanel
        tier="tier2"
        title="Values in practice"
        description={data?.coverage.note}
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data?.coverage.values ?? []).length === 0}
        empty={{ icon: Gem, title: "No values to analyse" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Value</TableHead>
              {sources.map((source) => (
                <TableHead key={source} className="text-right capitalize">
                  {source.replaceAll("_", " ")}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.coverage.values ?? []).map((row) => (
              <TableRow key={row.code}>
                <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                {sources.map((source) => {
                  const share = row.share[source];
                  return (
                    <TableCell key={source} className="text-right tabular-nums">
                      {row.counts[source] ?? 0}
                      {share !== null && share !== undefined && (
                        <span className="ml-1 text-xs text-muted-foreground">({Math.round(share * 100)}%)</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
    </div>
  );
}

function LoopTab() {
  const { data, error, isLoading, reload } = useApiQuery<Loop>("/culture/action-plans/loop");

  return (
    <div className="flex flex-col gap-4">
      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Open plans" value={data.open_plans} />
          <Metric label="Overdue plans" value={data.overdue_plans} />
        </div>
      )}
      <DataPanel
        tier="tier2"
        title="Did feedback lead to action — and did it move?"
        description={data?.note}
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data?.themes ?? []).length === 0}
        empty={{ icon: Repeat, title: "No themes to report", description: "Themes appear once a survey has results and a plan." }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Theme</TableHead>
              <TableHead className="text-right">Plans</TableHead>
              <TableHead className="text-right">Items done</TableHead>
              <TableHead>Acted</TableHead>
              <TableHead className="text-right">Movement</TableHead>
              <TableHead>Reading</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.themes ?? []).map((row) => (
              <TableRow key={row.theme}>
                <TableCell className="font-medium text-foreground capitalize">{row.theme.replaceAll("_", " ")}</TableCell>
                <TableCell className="text-right tabular-nums">{row.plans}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.items_done} / {row.items}
                </TableCell>
                <TableCell>
                  {row.acted ? (
                    <Badge variant="success">
                      <CircleCheck /> Yes
                    </Badge>
                  ) : (
                    <Badge variant="outline">No</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.movement === null ? "—" : `${row.movement >= 0 ? "+" : ""}${row.movement.toFixed(2)}`}
                </TableCell>
                <TableCell className="max-w-sm text-sm text-muted-foreground">{row.reading}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
    </div>
  );
}

function ParticipationTab() {
  const { data, error, isLoading, reload } = useApiQuery<ClubParticipation>("/culture/clubs/participation");

  return (
    <DataPanel
      tier="tier2"
      title="Club participation"
      description="In aggregate only. Who joined which club is not something this screen, or HR, can see."
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={!data}
      empty={{ icon: Users, title: "No clubs yet" }}
    >
      {data && (
        <div className="grid gap-4 p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Active clubs" value={data.active_clubs} />
            <Metric label="People in at least one" value={data.distinct_members} />
            <Metric label="Memberships" value={data.total_memberships} />
            <Metric
              label="Participation"
              value={data.participation_rate === null ? "—" : `${Math.round(data.participation_rate * 100)}%`}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {data.public_clubs} public, {data.private_clubs} private, out of {data.active_headcount} active people.{" "}
            {data.note}
          </p>
        </div>
      )}
    </DataPanel>
  );
}

function PostureTab() {
  const { data, error, isLoading, reload } = useApiQuery<Posture>("/culture/posture");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DataPanel tier="tier2" title="Enforced" isLoading={isLoading} error={error?.detail ?? null} onRetry={reload}>
        <ul className="grid gap-2 p-5 text-sm">
          {(data?.enforced ?? []).map((line) => (
            <li key={line} className="flex gap-2">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-foreground" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </DataPanel>
      <DataPanel tier="tier2" title="Not built" isLoading={isLoading} error={error?.detail ?? null} onRetry={reload}>
        <ul className="grid gap-2 p-5 text-sm">
          {(data?.not_built ?? []).map((line) => (
            <li key={line} className="flex gap-2">
              <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">{line}</span>
            </li>
          ))}
        </ul>
      </DataPanel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card tier="tier2" className="py-4">
      <CardContent className="px-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}
