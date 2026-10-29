"use client";

import { Download, Eye, FileQuestion, Languages, Loader2, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, downloadFile, post } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import {
  NOTICE_LANGUAGES,
  capabilityLabel,
  REQUEST_STATUS_LABEL,
  REQUEST_TYPE_LABEL,
  type AccessExport,
  type ConsentView,
  type ErasurePlan,
  type MyRequest,
  type Notice,
  type PurposeState,
  type RequestType,
  type WithdrawalEffect,
} from "@/lib/types/dpdp";
import { formatDate, formatDateTime } from "@/lib/utils";

function detail(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "outline" | "muted" | "warning" | "secondary" }> = {
  granted: { label: "You agreed", variant: "success" },
  declined: { label: "You declined", variant: "muted" },
  not_asked: { label: "Not asked yet", variant: "outline" },
  stale: { label: "Changed since you agreed", variant: "warning" },
  not_applicable: { label: "No choice — required", variant: "secondary" },
};

/**
 * The account menu → My privacy.
 *
 * Every person's own view under the DPDP Act: what is held about them and why,
 * the choices they have (and the processing where they have none, shown too —
 * that is the question somebody opening this screen is actually asking), and
 * their rights, exercised here with the statutory clock starting on receipt.
 */
export function MyPrivacyScreen() {
  return (
    <PageShell title="My privacy" description="What AskMira holds about you, why, what you agreed to, and your rights over it.">
      <Tabs defaultValue="choices">
        <TabsList>
          <TabsTrigger value="choices">My choices</TabsTrigger>
          <TabsTrigger value="notice">Privacy notice</TabsTrigger>
          <TabsTrigger value="rights">My rights</TabsTrigger>
        </TabsList>
        <TabsContent value="choices" className="mt-4">
          <ChoicesTab />
        </TabsContent>
        <TabsContent value="notice" className="mt-4">
          <NoticeTab />
        </TabsContent>
        <TabsContent value="rights" className="mt-4">
          <RightsTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function ChoicesTab() {
  const { data, error, isLoading, reload } = useApiQuery<ConsentView>("/dpdp/me/consent");
  const [busy, setBusy] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<PurposeState | null>(null);
  const [effect, setEffect] = useState<WithdrawalEffect | null>(null);

  const grant = async (row: PurposeState) => {
    setBusy(row.purpose);
    try {
      await post("/dpdp/me/consent", { purpose_key: row.purpose, granted: true });
      toast.success(`Recorded: you agreed to "${row.name}".`);
      reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not record your choice."));
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async () => {
    if (!withdrawing) return;
    setBusy(withdrawing.purpose);
    try {
      setEffect(await post<WithdrawalEffect>(`/dpdp/me/consent/${withdrawing.purpose}/withdraw`));
      setWithdrawing(null);
      reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not withdraw."));
    } finally {
      setBusy(null);
    }
  };

  const optional = (data?.purposes ?? []).filter((row) => row.status !== "not_applicable");
  const required = (data?.purposes ?? []).filter((row) => row.status === "not_applicable");

  return (
    <div className="flex flex-col gap-4">
      {effect && (
        <Alert variant="success">
          <ShieldCheck />
          <AlertTitle>{effect.summary}</AlertTitle>
          <AlertDescription>
            {effect.stops.length > 0 && <p>Stopped: {effect.stops.map(capabilityLabel).join(", ")}.</p>}
            {effect.erased.length > 0 && <p>Deleted: {effect.erased.join("; ")}.</p>}
            {effect.retained.length > 0 && <p>Kept: {effect.retained.join(" ")}</p>}
          </AlertDescription>
        </Alert>
      )}

      <DataPanel
        title="Where you have a choice"
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={optional.length === 0}
        empty={{ icon: ShieldCheck, title: "Nothing here needs your consent" }}
      >
        <ul className="divide-y divide-border">
          {optional.map((row) => {
            const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.not_asked;
            const on = row.status === "granted";
            return (
              <li key={row.purpose} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{row.name}</span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  {row.description && <p className="mt-1 text-sm text-muted-foreground">{row.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.lawful_basis_label}
                    {row.decided_at && ` · decided ${formatDateTime(row.decided_at)}`}
                  </p>
                  {row.stops_if_withdrawn.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      If you say no, these stop: {row.stops_if_withdrawn.map(capabilityLabel).join(", ")}.
                    </p>
                  )}
                </div>
                <Switch
                  checked={on}
                  disabled={busy === row.purpose || (on && !row.can_withdraw)}
                  aria-label={`${row.name}: ${on ? "agreed" : "not agreed"}`}
                  onCheckedChange={(next) => (next ? grant(row) : setWithdrawing(row))}
                />
              </li>
            );
          })}
        </ul>
      </DataPanel>

      {required.length > 0 && (
        <DataPanel title="Where the law or your contract decides" description="Shown so you know it happens — there is no switch, because there is no choice.">
          <ul className="divide-y divide-border">
            {required.map((row) => (
              <li key={row.purpose} className="px-5 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Lock className="size-3.5 text-muted-foreground" /> {row.name}
                </div>
                <p className="text-xs text-muted-foreground">{row.lawful_basis_label}</p>
              </li>
            ))}
          </ul>
        </DataPanel>
      )}

      <Dialog open={withdrawing !== null} onOpenChange={(next) => !next && setWithdrawing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw your consent: {withdrawing?.name}?</DialogTitle>
            <DialogDescription>
              {withdrawing?.stops_if_withdrawn.length
                ? `These stop: ${withdrawing.stops_if_withdrawn.map(capabilityLabel).join(", ")}.`
                : "Processing for this purpose stops."}{" "}
              You can agree again at any time.
            </DialogDescription>
          </DialogHeader>
          {withdrawing && (withdrawing.withdrawal_erases.length > 0 || withdrawing.withdrawal_keeps.length > 0) && (
            <div className="grid gap-2 text-sm">
              {withdrawing.withdrawal_erases.length > 0 && (
                <div>
                  <p className="font-medium text-foreground">Deleted straight away</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {withdrawing.withdrawal_erases.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {withdrawing.withdrawal_keeps.length > 0 && (
                <div>
                  <p className="font-medium text-foreground">Kept</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {withdrawing.withdrawal_keeps.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawing(null)}>
              Keep it
            </Button>
            <Button onClick={withdraw} disabled={busy !== null}>
              {busy && <Loader2 className="animate-spin" />} Withdraw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NoticeTab() {
  const { locale } = useLocale();
  const [language, setLanguage] = useState<string>(locale);
  // The notice opens in the portal's language; the menu still offers every other.
  useEffect(() => setLanguage(locale), [locale]);
  const { data, error, isLoading, reload } = useApiQuery<Notice>(`/dpdp/me/notice?language=${language}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Languages className="size-4 text-muted-foreground" />
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-52" aria-label="Notice language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NOTICE_LANGUAGES.map((option) => (
              <SelectItem key={option.code} value={option.code}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <ErrorState message={error.detail} onRetry={reload} />
      ) : data ? (
        <>
          {(data.is_fallback || data.untranslated_items > 0) && (
            <Alert variant="warning">
              <Languages />
              <AlertTitle>Not fully translated</AlertTitle>
              <AlertDescription>
                {data.fallback_line ?? `${data.untranslated_items} part(s) are shown in English until a reviewed translation exists.`}
              </AlertDescription>
            </Alert>
          )}
          <DataPanel title={data.title} description={`${data.language_name} · version ${data.version}`}>
            <div className="grid gap-5 p-5 text-sm">
              <p className="whitespace-pre-line">{data.intro}</p>
              <NoticeGroup heading="Where you choose" items={data.choices} />
              <NoticeGroup heading="What happens without a choice, and why" items={data.disclosures} />
              <p className="whitespace-pre-line text-muted-foreground">{data.rights_line}</p>
              {data.grievance_contact ? (
                <p className="text-muted-foreground">
                  Grievances: {data.grievance_contact}
                  {data.data_protection_officer_name && ` (${data.data_protection_officer_name})`}
                </p>
              ) : (
                <Alert variant="warning">
                  <FileQuestion />
                  <AlertTitle>No privacy contact named yet</AlertTitle>
                  <AlertDescription>
                    Your employer has not yet named who handles privacy concerns. You can still see, correct or erase
                    your data from My rights, and the answer clock starts as soon as you ask.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </DataPanel>
        </>
      ) : null}
    </div>
  );
}

function NoticeGroup({ heading, items }: { heading: string; items: Notice["choices"] }) {
  if (items.length === 0) return null;
  return (
    <section className="grid gap-3">
      <h3 className="font-semibold text-foreground">{heading}</h3>
      {items.map((item) => (
        <div key={item.purpose} className="rounded-md border border-border p-3">
          <div className="font-medium text-foreground">{item.heading}</div>
          <p className="mt-1 whitespace-pre-line">{item.body}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {item.basis_explanation} Uses: {item.data_used.join(", ")}.
            {item.sub_processors.length > 0 && ` Shared with: ${item.sub_processors.join(", ")}.`}
          </p>
        </div>
      ))}
    </section>
  );
}

function RightsTab() {
  const requests = useApiQuery<{ requests: MyRequest[] }>("/dpdp/me/requests");
  const [raising, setRaising] = useState<RequestType | null>(null);
  const [viewingExport, setViewingExport] = useState(false);
  const [previewingErasure, setPreviewingErasure] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFile("/dpdp/me/export/download", "my-data.json");
    } catch (caught) {
      toast.error(detail(caught, "The download failed."));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <DataPanel title="See your data">
          <div className="grid gap-2 p-5 text-sm">
            <p className="text-muted-foreground">Everything held about you, organised to read rather than to parse.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setViewingExport(true)}>
                <Eye /> View
              </Button>
              <Button size="sm" variant="outline" disabled={downloading} onClick={download}>
                {downloading ? <Loader2 className="animate-spin" /> : <Download />} Download
              </Button>
            </div>
          </div>
        </DataPanel>
        <DataPanel title="Erasure">
          <div className="grid gap-2 p-5 text-sm">
            <p className="text-muted-foreground">See what erasure would remove and what the law requires us to keep, before you ask.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setPreviewingErasure(true)}>
                <Eye /> Preview
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRaising("erasure")}>
                <Trash2 /> Request
              </Button>
            </div>
          </div>
        </DataPanel>
        <DataPanel title="Something else">
          <div className="grid gap-2 p-5 text-sm">
            <p className="text-muted-foreground">Correct a record, nominate someone, or raise a grievance.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setRaising("correction")}>
                Correct
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRaising("grievance")}>
                Grievance
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRaising("nomination")}>
                Nominate
              </Button>
            </div>
          </div>
        </DataPanel>
      </div>

      <DataPanel
        title="Your requests"
        isLoading={requests.isLoading}
        error={requests.error?.detail ?? null}
        onRetry={requests.reload}
        isEmpty={(requests.data?.requests ?? []).length === 0}
        empty={{ icon: FileQuestion, title: "You have not made any requests" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Answer due by</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(requests.data?.requests ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-sm">
                  {REQUEST_TYPE_LABEL[row.type]}
                  {row.details && <div className="max-w-sm text-xs text-muted-foreground">{row.details}</div>}
                  {row.rejection_reason && <div className="text-xs text-destructive">{row.rejection_reason}</div>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.received_at)}</TableCell>
                <TableCell className="text-sm">{formatDate(row.due_by)}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "completed" ? "success" : row.status === "rejected" ? "muted" : "outline"}>
                    {REQUEST_STATUS_LABEL[row.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      <RaiseRequestDialog type={raising} onOpenChange={(open) => !open && setRaising(null)} onRaised={requests.reload} />
      <AccessExportSheet open={viewingExport} onOpenChange={setViewingExport} />
      <ErasurePreviewSheet open={previewingErasure} onOpenChange={setPreviewingErasure} />
    </div>
  );
}

function RaiseRequestDialog({ type, onOpenChange, onRaised }: { type: RequestType | null; onOpenChange: (open: boolean) => void; onRaised: () => void }) {
  const [details, setDetails] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (type) setDetails("");
  }, [type]);

  const needsDetails = type === "correction" || type === "grievance" || type === "nomination";

  const submit = async () => {
    if (!type) return;
    setIsBusy(true);
    try {
      const result = await post<{ due_by: string }>("/dpdp/me/requests", { request_type: type, details: details.trim() || null });
      toast.success(`Received. You will have an answer by ${formatDate(result.due_by)}.`);
      onRaised();
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "The request was not recorded."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={type !== null} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{type ? REQUEST_TYPE_LABEL[type] : ""}</DialogTitle>
          <DialogDescription>The response clock starts the moment you submit — checking who you are does not pause it.</DialogDescription>
        </DialogHeader>
        <FormField
          htmlFor="request-details"
          label={type === "correction" ? "What is wrong, and what it should say" : type === "nomination" ? "Who, and how to reach them" : "Details"}
          optional={!needsDetails}
        >
          <Textarea id="request-details" value={details} onChange={(e) => setDetails(e.target.value)} rows={4} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || (needsDetails && !details.trim())}>
            {isBusy && <Loader2 className="animate-spin" />} Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccessExportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data, error, isLoading, reload } = useApiQuery<AccessExport>(open ? "/dpdp/me/export" : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Everything held about you</SheetTitle>
          <SheetDescription>{data ? `Generated ${formatDateTime(data.generated_at)}.` : " "}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : error ? (
            <ErrorState message={error.detail} onRetry={reload} />
          ) : data ? (
            <>
              <Alert>
                <AlertTitle>
                  {data.completeness.rows_exported} records from {data.completeness.tables_with_your_rows} places
                </AlertTitle>
                <AlertDescription>
                  {data.completeness.note} {data.completeness.withheld}
                  {data.completeness.truncated_tables.length > 0 && ` Shortened: ${data.completeness.truncated_tables.join(", ")} — the download has everything.`}
                </AlertDescription>
              </Alert>
              {data.sections.map((section) => (
                <div key={section.category} className="rounded-md border border-border p-3 text-sm">
                  <div className="font-medium text-foreground">{section.name}</div>
                  <p className="text-muted-foreground">{section.what_this_is}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Why: {section.why_we_hold_it}. How long: {section.how_long}.
                  </p>
                </div>
              ))}
              {data.contents.map((table) => (
                <section key={table.table} className="grid gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {table.label} <span className="font-normal text-muted-foreground">({table.row_count})</span>
                  </h3>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(table.rows[0] ?? {}).map((column) => (
                            <TableHead key={column} className="whitespace-nowrap">
                              {column.replaceAll("_", " ")}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {table.rows.map((row, index) => (
                          <TableRow key={index}>
                            {Object.keys(table.rows[0] ?? {}).map((column) => (
                              <TableCell key={column} className="max-w-60 truncate text-xs">
                                {row[column] === null || row[column] === undefined ? "—" : String(row[column])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {table.withheld_columns.length > 0 && (
                    <p className="text-xs text-muted-foreground">Not shown: {table.withheld_columns.join(", ")}.</p>
                  )}
                </section>
              ))}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ErasurePreviewSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data, error, isLoading, reload } = useApiQuery<ErasurePlan>(open ? "/dpdp/me/erasure-preview" : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>What erasure would do</SheetTitle>
          <SheetDescription>A preview. Nothing is deleted by looking.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : error ? (
            <ErrorState message={error.detail} onRetry={reload} />
          ) : data ? (
            <>
              <Alert>
                <AlertTitle>
                  {data.purged_count} would be erased, {data.retained_count} kept
                </AlertTitle>
                <AlertDescription>{data.summary}</AlertDescription>
              </Alert>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Why</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.decisions.map((decision) => (
                    <TableRow key={decision.category}>
                      <TableCell className="text-sm">{decision.category_name}</TableCell>
                      <TableCell>
                        <Badge variant={decision.outcome === "purge" || decision.outcome === "erase" ? "outline" : "secondary"}>
                          {decision.outcome.replaceAll("_", " ")}
                        </Badge>
                        {decision.retained_until && <div className="text-xs text-muted-foreground">until {formatDate(decision.retained_until)}</div>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {decision.explanation}
                        {decision.statutory_reference && <div>{decision.statutory_reference}</div>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
