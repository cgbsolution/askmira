"use client";

import { CircleCheck, CircleSlash, Database, Download, Handshake, Loader2, Plus, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, downloadFile, put, post } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

interface SchemaColumn {
  name: string;
  description: string;
  sensitivity: "public" | "hr_only" | "payroll_only";
}

interface SchemaDocument {
  schema_version: string;
  entities: { name: string; description: string; change_key: string | null; columns: SchemaColumn[] }[];
  stability: string;
}

interface Connection {
  connection_id: string;
  name: string;
  entity: string;
  destination: "postgres_role" | "object_storage";
  destination_ref: string;
  export_role: string;
  schema_version: string;
  last_watermark: string | null;
  is_active: boolean;
}

interface ExportRun {
  export_run_id: string;
  entity: string;
  kind: string;
  destination: string;
  destination_ref: string;
  role: string;
  started_at: string;
  row_count: number;
  fields: string[];
  field_count: number;
  withheld_fields: string[];
  carries_payroll_data: boolean;
  status: string;
}

interface Posture {
  enforced: string[];
  not_built: string[];
}

const DESTINATION_LABEL = { postgres_role: "Read-only Postgres role", object_storage: "Object storage bucket" };
const EXPORT_ROLES = [
  { value: "employee", label: "Employee — public fields only" },
  { value: "manager", label: "Manager — public fields only" },
  { value: "sub_admin", label: "Sub-admin — adds HR fields" },
  { value: "admin", label: "Admin — adds payroll fields" },
];

function detail(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/**
 * Reports → BI connector.
 *
 * A BI connector is the largest quantity of personal data that leaves this
 * system, on a schedule, unattended. So a connection is defined against a
 * published schema (never raw tables) and a role that decides which fields go,
 * and every export — with its exact field list — is on the record here for the
 * person who reads it after an incident.
 */
export function BiConnectorScreen() {
  return (
    <PageShell title="BI connector" description="What your BI tool may read, where it goes, and the record of every export.">
      <Tabs defaultValue="connections">
        <TabsList>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="history">Export history</TabsTrigger>
          <TabsTrigger value="schema">Published schema</TabsTrigger>
          <TabsTrigger value="benchmark">Benchmarking</TabsTrigger>
        </TabsList>
        <TabsContent value="connections" className="mt-4">
          <ConnectionsTab />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab />
        </TabsContent>
        <TabsContent value="schema" className="mt-4">
          <SchemaTab />
        </TabsContent>
        <TabsContent value="benchmark" className="mt-4">
          <BenchmarkTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function ConnectionsTab() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const { data, error, isLoading, reload } = useApiQuery<Connection[]>("/bi/connections");
  const posture = useApiQuery<Posture>("/bi/posture");
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const download = async (row: Connection) => {
    setExporting(row.connection_id);
    try {
      await downloadFile(`/bi/connections/${row.connection_id}/export-file`, `${row.entity}.csv`);
      toast.success("Exported. The run and its field list are in the export history.");
    } catch (caught) {
      toast.error(detail(caught, "The export failed."));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {posture.data && posture.data.not_built.length > 0 && (
        <Alert variant="warning">
          <CircleSlash />
          <AlertTitle>What the connector does not do yet</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {posture.data.not_built.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <DataPanel
        title="Connections"
        actions={
          isAdmin ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> New connection
            </Button>
          ) : undefined
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data ?? []).length === 0}
        empty={{ icon: Database, title: "No connections", description: "Nothing leaves AskMira through the connector until one is set up." }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Connection</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Exports as</TableHead>
              <TableHead>Last export up to</TableHead>
              {isAdmin && <TableHead className="text-right">Export</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((row) => (
              <TableRow key={row.connection_id} className={row.is_active ? undefined : "opacity-60"}>
                <TableCell>
                  <div className="font-medium text-foreground">{row.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {row.entity} · schema {row.schema_version}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {DESTINATION_LABEL[row.destination]}
                  <div className="max-w-xs truncate font-mono text-xs text-muted-foreground" title={row.destination_ref}>
                    {row.destination_ref}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{row.export_role}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{row.last_watermark ? formatDateTime(row.last_watermark) : "Never exported"}</TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={exporting !== null || !row.is_active} onClick={() => download(row)}>
                      {exporting === row.connection_id ? <Loader2 className="animate-spin" /> : <Download />} Full CSV
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      {posture.data && (
        <DataPanel title="Enforced">
          <ul className="grid gap-2 p-5 text-sm">
            {posture.data.enforced.map((line) => (
              <li key={line} className="flex gap-2">
                <CircleCheck className="mt-0.5 size-4 shrink-0" />
                {line}
              </li>
            ))}
          </ul>
        </DataPanel>
      )}

      <ConnectionDialog open={creating} onOpenChange={setCreating} onCreated={reload} />
    </div>
  );
}

function ConnectionDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [role, setRole] = useState("sub_admin");
  const schema = useApiQuery<SchemaDocument>(open ? "/bi/schema" : null);
  const [name, setName] = useState("");
  const [entity, setEntity] = useState("");
  const [destination, setDestination] = useState<"postgres_role" | "object_storage">("postgres_role");
  const [destinationRef, setDestinationRef] = useState("");
  const [narrow, setNarrow] = useState(false);
  const [fields, setFields] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setRole("sub_admin");
    setDestination("postgres_role");
    setDestinationRef("");
    setNarrow(false);
    setFields([]);
  }, [open]);

  useEffect(() => {
    if (schema.data && !entity) setEntity(schema.data.entities[0]?.name ?? "");
  }, [schema.data, entity]);

  const columns = schema.data?.entities.find((row) => row.name === entity)?.columns ?? [];

  const submit = async () => {
    setIsBusy(true);
    try {
      await post("/bi/connections", {
        name: name.trim(),
        entity_name: entity,
        destination,
        destination_ref: destinationRef.trim(),
        export_role: role,
        field_names: narrow ? fields : null,
      });
      toast.success("Connection created and validated.");
      onCreated();
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "The connection was refused."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New BI connection</DialogTitle>
          <DialogDescription>
            It is validated now — an entity outside the published schema, or a field the role may not see, is refused
            here rather than on the first scheduled run.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="bi-name" label="Name" className="sm:col-span-2">
            <Input id="bi-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Power BI — headcount" />
          </FormField>
          <FormField htmlFor="bi-entity" label="What it reads">
            <Select value={entity} onValueChange={(next) => { setEntity(next); setFields([]); }}>
              <SelectTrigger id="bi-entity" className="w-full">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {(schema.data?.entities ?? []).map((row) => (
                  <SelectItem key={row.name} value={row.name}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="bi-role" label="Export with the access of" hint="Decides which fields leave. Choose the least that answers the question.">
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="bi-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_ROLES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="bi-destination" label="Delivered to">
            <Select value={destination} onValueChange={(next) => setDestination(next as typeof destination)}>
              <SelectTrigger id="bi-destination" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="postgres_role">{DESTINATION_LABEL.postgres_role}</SelectItem>
                <SelectItem value="object_storage">{DESTINATION_LABEL.object_storage}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            htmlFor="bi-ref"
            label={destination === "postgres_role" ? "Role name" : "Bucket URI"}
            hint="Recorded on every export: 'to where' is half of what the audit row is for."
          >
            <Input id="bi-ref" value={destinationRef} onChange={(e) => setDestinationRef(e.target.value)} className="font-mono text-xs" />
          </FormField>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch id="bi-narrow" checked={narrow} onCheckedChange={setNarrow} />
            <Label htmlFor="bi-narrow" className="text-sm font-normal">
              Send only the fields I pick (otherwise every field the role may see)
            </Label>
          </div>
          {narrow && (
            <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-md border border-border p-3 sm:col-span-2">
              {columns.map((column) => (
                <div key={column.name} className="flex items-start gap-2">
                  <Checkbox
                    id={`bi-field-${column.name}`}
                    checked={fields.includes(column.name)}
                    onCheckedChange={() =>
                      setFields(fields.includes(column.name) ? fields.filter((item) => item !== column.name) : [...fields, column.name])
                    }
                  />
                  <Label htmlFor={`bi-field-${column.name}`} className="text-sm font-normal">
                    <span className="font-mono">{column.name}</span>
                    {column.sensitivity !== "public" && (
                      <Badge variant="warning" className="ml-2">
                        {column.sensitivity === "payroll_only" ? "Payroll" : "HR"}
                      </Badge>
                    )}
                    <span className="block text-xs text-muted-foreground">{column.description}</span>
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || !name.trim() || !entity || !destinationRef.trim() || (narrow && fields.length === 0)}>
            {isBusy && <Loader2 className="animate-spin" />} Create connection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryTab() {
  const { data, error, isLoading, reload } = useApiQuery<ExportRun[]>("/bi/export-runs?limit=200");

  return (
    <DataPanel
      title="Export history"
      description="Every export, with the exact fields that left and the ones withheld."
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={(data ?? []).length === 0}
      empty={{ icon: Database, title: "Nothing has been exported" }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>What</TableHead>
            <TableHead>To</TableHead>
            <TableHead className="text-right">Rows</TableHead>
            <TableHead>Fields</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((row) => (
            <TableRow key={row.export_run_id}>
              <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.started_at)}</TableCell>
              <TableCell className="text-sm">
                <span className="font-mono">{row.entity}</span> · {row.kind}
                <div className="flex flex-wrap gap-1 pt-1">
                  <Badge variant="outline">as {row.role}</Badge>
                  {row.carries_payroll_data && (
                    <Badge variant="warning">
                      <ShieldAlert /> Payroll data
                    </Badge>
                  )}
                  {row.status !== "succeeded" && <Badge variant="destructive">{row.status}</Badge>}
                </div>
              </TableCell>
              <TableCell className="max-w-xs truncate font-mono text-xs" title={row.destination_ref}>
                {row.destination_ref}
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.row_count.toLocaleString("en-IN")}</TableCell>
              <TableCell className="max-w-sm text-xs">
                <span className="text-foreground">{row.fields.join(", ")}</span>
                {row.withheld_fields.length > 0 && <div className="text-muted-foreground">withheld: {row.withheld_fields.join(", ")}</div>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataPanel>
  );
}

function SchemaTab() {
  const { data, error, isLoading, reload } = useApiQuery<SchemaDocument>("/bi/schema");

  return (
    <div className="flex flex-col gap-4">
      {data && (
        <Alert>
          <Database />
          <AlertTitle>Schema version {data.schema_version}</AlertTitle>
          <AlertDescription>{data.stability}</AlertDescription>
        </Alert>
      )}
      {isLoading ? null : error ? (
        <DataPanel error={error.detail} onRetry={reload} />
      ) : (
        (data?.entities ?? []).map((entity) => (
          <DataPanel key={entity.name} title={<span className="font-mono">{entity.name}</span>} description={entity.description}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Column</TableHead>
                  <TableHead>Meaning</TableHead>
                  <TableHead>Sensitivity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entity.columns.map((column) => (
                  <TableRow key={column.name}>
                    <TableCell className="font-mono text-xs">{column.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{column.description}</TableCell>
                    <TableCell>
                      <Badge variant={column.sensitivity === "public" ? "outline" : "warning"}>{column.sensitivity.replace("_", " ")}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataPanel>
        ))
      )}
    </div>
  );
}

function BenchmarkTab() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const terms = useApiQuery<{ minimum_contributors: number; sources: string[]; statement: string }>("/bi/benchmark-terms");
  const [contributing, setContributing] = useState(false);
  const [reference, setReference] = useState("");
  const [confirmOff, setConfirmOff] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const save = async (next: boolean) => {
    setIsBusy(true);
    try {
      await put("/bi/benchmark-consent", { is_contributor: next, contract_reference: reference.trim() || null });
      setContributing(next);
      toast.success(next ? "You are contributing anonymised aggregates." : "Opted out; your past contributions were deleted.");
      setConfirmOff(false);
    } catch (caught) {
      toast.error(detail(caught, "Could not record the choice."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <DataPanel title="The benchmarking deal" isLoading={terms.isLoading} error={terms.error?.detail ?? null} onRetry={terms.reload}>
        {terms.data && (
          <div className="grid gap-3 p-5 text-sm">
            <p>{terms.data.statement}</p>
            <p className="text-muted-foreground">
              At least {terms.data.minimum_contributors} companies per published cell. Sources: {terms.data.sources.join(", ")}.
            </p>
          </div>
        )}
      </DataPanel>

      {isAdmin && (
        <DataPanel title="Contribute">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <FormField
              htmlFor="benchmark-ref"
              label="Contract clause"
              hint="Consent that exists only as a switch is consent nobody can evidence."
            >
              <Input id="benchmark-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="MSA §14.2" />
            </FormField>
            <div className="flex items-end gap-2">
              <Button disabled={isBusy || !reference.trim()} onClick={() => save(true)}>
                <Handshake /> Opt in
              </Button>
              <Button variant="outline" disabled={isBusy} onClick={() => setConfirmOff(true)}>
                Opt out
              </Button>
            </div>
            {contributing && (
              <Alert variant="success" className="sm:col-span-2">
                <CircleCheck />
                <AlertTitle>Contributing</AlertTitle>
              </Alert>
            )}
          </div>
        </DataPanel>
      )}

      <Dialog open={confirmOff} onOpenChange={setConfirmOff}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Opt out of benchmarking?</DialogTitle>
            <DialogDescription>
              Your past contributions are deleted as well, and you stop seeing the peer aggregate — only licensed data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOff(false)}>
              Keep contributing
            </Button>
            <Button variant="destructive" disabled={isBusy} onClick={() => save(false)}>
              {isBusy && <Loader2 className="animate-spin" />} Opt out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
