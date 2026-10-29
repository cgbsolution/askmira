"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Briefcase, Download, FileUp, Loader2, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AmountInput } from "@/components/common/AmountInput";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { DatePicker } from "@/components/common/DatePicker";
import { EmployeePicker } from "@/components/common/EmployeePicker";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { MonthPicker } from "@/components/common/MonthPicker";
import { DataTable } from "@/components/common/data-table/DataTable";
import { CompanionChart } from "@/components/companion/CompanionExtras";
import { apiMessage } from "@/components/payroll/labels";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del, downloadFile, patch, post } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type {
  AccountAllocation,
  AccountEntry,
  AccountEntryKind,
  AccountImport,
  AccountPnl,
  AccountPnlDetail,
  AccountPnlRow,
  ClientAccount,
} from "@/lib/types/accounts";
import { cn, formatDate } from "@/lib/utils";

/**
 * Client accounts and their P&L: what was billed to each account against the
 * payroll cost mapped to it and its other direct costs.
 *
 * Four tabs: the P&L itself; the accounts; billing and costs (typed or
 * uploaded); and which people work on which account, from when. Every figure
 * on the P&L is worked out by AskMira from those three and from payroll's own
 * payslips — nothing here is typed as a result.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return `${MONTHS[month - 1] ?? "?"} ${year}`;
}

function thisMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function yearStart(end: string): string {
  const [year, month] = end.split("-").map(Number);
  return `${month >= 4 ? year : year - 1}-04`;
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function SignedMoney({ value }: { value: string }) {
  const negative = value.startsWith("-");
  return (
    <span className={cn("tabular-nums", negative && "text-destructive")}>
      {negative ? "-" : ""}
      <Money value={negative ? value.slice(1) : value} />
    </span>
  );
}

function Margin({ pct }: { pct: string | null }) {
  if (pct === null) return <span className="text-muted-foreground">—</span>;
  return <span className={cn("tabular-nums", pct.startsWith("-") && "text-destructive")}>{pct}%</span>;
}

/** "1,25,000.50" typed → "125000.50"; refuses anything that is not an amount. */
function percentOk(value: string): boolean {
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(value)) return false;
  const number = Number(value);
  return number > 0 && number <= 100;
}

export function AccountsScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "pnl";
  const accounts = useApiQuery<ClientAccount[]>("/accounts");
  const setTab = (next: string) => {
    const query = new URLSearchParams(params.toString());
    query.set("tab", next);
    query.delete("account");
    router.replace(`?${query.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={tab} onValueChange={setTab} className="grid gap-4">
      <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
        <TabsTrigger value="pnl">P&amp;L</TabsTrigger>
        <TabsTrigger value="accounts">Accounts</TabsTrigger>
        <TabsTrigger value="entries">Billing &amp; costs</TabsTrigger>
        <TabsTrigger value="people">People on accounts</TabsTrigger>
      </TabsList>
      <TabsContent value="pnl">
        <PnlTab accounts={accounts.data ?? []} initialAccount={params.get("account")} />
      </TabsContent>
      <TabsContent value="accounts">
        <AccountsTab
          accounts={accounts.data ?? []}
          isLoading={accounts.isLoading}
          error={accounts.error?.detail ?? null}
          reload={accounts.reload}
        />
      </TabsContent>
      <TabsContent value="entries">
        <EntriesTab accounts={accounts.data ?? []} />
      </TabsContent>
      <TabsContent value="people">
        <PeopleTab accounts={accounts.data ?? []} onChanged={accounts.reload} />
      </TabsContent>
    </Tabs>
  );
}

// ── P&L ─────────────────────────────────────────────────────────────────────

function PnlTab({ accounts, initialAccount }: { accounts: ClientAccount[]; initialAccount: string | null }) {
  const [end, setEnd] = useState(thisMonth());
  const [start, setStart] = useState(yearStart(thisMonth()));
  const [includeInactive, setIncludeInactive] = useState(false);
  const [open, setOpen] = useState<string | null>(initialAccount);
  const reversed = start > end;
  const query = reversed
    ? null
    : `/accounts/pnl?start=${start}&end=${end}${includeInactive ? "&include_inactive=true" : ""}`;
  const pnl = useApiQuery<AccountPnl>(query);

  const columns = useMemo<ColumnDef<AccountPnlRow>[]>(
    () => [
      {
        id: "account",
        header: "Account",
        accessorFn: (row) => `${row.name} ${row.code}`,
        cell: ({ row }) => (
          <span className="grid">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">{row.original.code}</span>
          </span>
        ),
        meta: { text: (row) => `${row.name} (${row.code})` },
      },
      {
        accessorKey: "billed",
        header: "Billed",
        meta: { className: "text-right", text: (row) => row.billed },
        cell: ({ row }) => <SignedMoney value={row.original.billed} />,
      },
      {
        accessorKey: "people_cost",
        header: "People cost",
        meta: { className: "text-right", text: (row) => row.people_cost },
        cell: ({ row }) => <SignedMoney value={row.original.people_cost} />,
      },
      {
        accessorKey: "other_cost",
        header: "Other cost",
        meta: { className: "text-right", text: (row) => row.other_cost },
        cell: ({ row }) => <SignedMoney value={row.original.other_cost} />,
      },
      {
        accessorKey: "margin",
        header: "Margin",
        meta: { className: "text-right", text: (row) => row.margin },
        cell: ({ row }) => <SignedMoney value={row.original.margin} />,
      },
      {
        accessorKey: "margin_pct",
        header: "Margin %",
        meta: { className: "text-right", text: (row) => row.margin_pct ?? "" },
        cell: ({ row }) => <Margin pct={row.original.margin_pct} />,
      },
      {
        accessorKey: "people",
        header: "People",
        meta: { className: "text-right" },
      },
    ],
    [],
  );

  const totals = pnl.data?.totals;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <FormField htmlFor="pnl-start" label="From">
          <MonthPicker id="pnl-start" value={start} onChange={setStart} />
        </FormField>
        <FormField htmlFor="pnl-end" label="To">
          <MonthPicker id="pnl-end" value={end} onChange={setEnd} />
        </FormField>
        <div className="flex items-center gap-2 pb-2">
          <Switch id="pnl-inactive" checked={includeInactive} onCheckedChange={setIncludeInactive} />
          <Label htmlFor="pnl-inactive">Show inactive accounts</Label>
        </div>
      </div>
      {reversed ? (
        <Alert variant="destructive">
          <AlertDescription>The first month is after the last. Pick a From month on or before To.</AlertDescription>
        </Alert>
      ) : null}
      {totals ? (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ["Billed", <SignedMoney key="b" value={totals.billed} />],
            ["Cost on accounts", <SignedMoney key="c" value={totals.total_cost} />],
            ["Margin", <SignedMoney key="m" value={totals.margin} />],
            ["Margin %", <Margin key="p" pct={totals.margin_pct} />],
            ["Payroll cost on no account", <SignedMoney key="u" value={pnl.data?.unmapped_cost ?? "0"} />],
          ].map(([label, value]) => (
            <div key={String(label)} className="grid gap-1 rounded-lg border bg-card p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-lg font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <DataTable
        tier="tier1"
        title="Account P&L"
        description={
          pnl.data ? `${monthLabel(pnl.data.start)} to ${monthLabel(pnl.data.end)}. Click an account for its months and people.` : undefined
        }
        columns={columns}
        data={pnl.data?.accounts ?? []}
        getRowId={(row) => row.account_id}
        noun="accounts"
        isLoading={pnl.isLoading}
        error={pnl.error?.detail}
        onRetry={pnl.reload}
        selectable={false}
        exportName={`account-pnl-${start}-to-${end}`}
        onRowClick={(row) => setOpen(row.account_id)}
        empty={{
          icon: Briefcase,
          title: accounts.length === 0 ? "No client accounts yet" : "No accounts in this view",
          description:
            accounts.length === 0
              ? "Add an account under Accounts, map people to it and record what you billed."
              : "Switch on Show inactive accounts to see accounts no longer in use.",
        }}
      />
      {pnl.data?.notes.length ? (
        <ul className="grid gap-1 text-xs leading-5 text-muted-foreground">
          {pnl.data.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      <PnlDetailSheet accountId={open} start={start} end={end} onClose={() => setOpen(null)} />
    </div>
  );
}

function PnlDetailSheet({
  accountId,
  start,
  end,
  onClose,
}: {
  accountId: string | null;
  start: string;
  end: string;
  onClose: () => void;
}) {
  const detail = useApiQuery<AccountPnlDetail>(
    accountId && start <= end ? `/accounts/${accountId}/pnl?start=${start}&end=${end}` : null,
  );
  const data = detail.data;
  return (
    <Sheet open={accountId !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{data ? `${data.account.name} (${data.account.code})` : "Account P&L"}</SheetTitle>
          <SheetDescription>
            {data ? `${monthLabel(data.start)} to ${monthLabel(data.end)}` : "Loading…"}
            {data?.account.client_name ? ` · ${data.account.client_name}` : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6">
          {detail.isLoading && !data ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : null}
          {detail.error ? (
            <Alert variant="destructive">
              <AlertDescription>{detail.error.detail}</AlertDescription>
            </Alert>
          ) : null}
          {data ? (
            <>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  ["Billed", data.summary.billed],
                  ["People cost", data.summary.people_cost],
                  ["Other direct cost", data.summary.other_cost],
                  ["Margin", data.summary.margin],
                ].map(([label, value]) => (
                  <div key={label} className="grid gap-0.5">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="font-semibold">
                      <SignedMoney value={value} />
                    </dd>
                  </div>
                ))}
                <div className="grid gap-0.5">
                  <dt className="text-xs text-muted-foreground">Margin %</dt>
                  <dd className="font-semibold">
                    <Margin pct={data.summary.margin_pct} />
                  </dd>
                </div>
              </dl>
              <CompanionChart
                card={{
                  type: "chart",
                  title: "Billed against cost",
                  caption: "Month by month",
                  chart: "bar",
                  unit: "inr",
                  x: data.months.map((m) => monthLabel(m.month)),
                  series: [
                    { name: "Billed", values: data.months.map((m) => m.billed) },
                    { name: "Total cost", values: data.months.map((m) => m.total_cost) },
                    { name: "Margin", values: data.months.map((m) => m.margin) },
                  ],
                }}
              />
              <DataTable
                variant="plain"
                columns={[
                  { id: "month", header: "Month", accessorFn: (m) => monthLabel(m.month) },
                  {
                    accessorKey: "billed",
                    header: "Billed",
                    meta: { className: "text-right" },
                    cell: ({ row }) => <SignedMoney value={row.original.billed} />,
                  },
                  {
                    accessorKey: "total_cost",
                    header: "Cost",
                    meta: { className: "text-right" },
                    cell: ({ row }) => <SignedMoney value={row.original.total_cost} />,
                  },
                  {
                    accessorKey: "margin",
                    header: "Margin",
                    meta: { className: "text-right" },
                    cell: ({ row }) => <SignedMoney value={row.original.margin} />,
                  },
                  {
                    accessorKey: "margin_pct",
                    header: "%",
                    meta: { className: "text-right" },
                    cell: ({ row }) => <Margin pct={row.original.margin_pct} />,
                  },
                ]}
                data={data.months}
                getRowId={(m) => m.month}
              />
              <DataTable
                variant="plain"
                title="People cost on this account"
                columns={[
                  { accessorKey: "name", header: "Name" },
                  { accessorKey: "employee_code", header: "Code" },
                  {
                    accessorKey: "share_pct",
                    header: "Average share",
                    meta: { className: "text-right" },
                    cell: ({ row }) => <span className="tabular-nums">{row.original.share_pct}%</span>,
                  },
                  {
                    accessorKey: "cost",
                    header: "Cost",
                    meta: { className: "text-right" },
                    cell: ({ row }) => <SignedMoney value={row.original.cost} />,
                  },
                ]}
                data={data.people}
                getRowId={(p) => p.employee_id}
                emptyMessage="Nobody's cost is mapped to this account in the period."
              />
              <ul className="grid gap-1 text-xs leading-5 text-muted-foreground">
                {data.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Accounts ────────────────────────────────────────────────────────────────

function AccountsTab({
  accounts,
  isLoading,
  error,
  reload,
}: {
  accounts: ClientAccount[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}) {
  const [editing, setEditing] = useState<ClientAccount | "new" | null>(null);
  const [deleting, setDeleting] = useState<ClientAccount | null>(null);

  const columns: ColumnDef<ClientAccount>[] = [
    { accessorKey: "code", header: "Code", meta: { cellClassName: "font-medium" } },
    { accessorKey: "name", header: "Account" },
    { accessorKey: "client_name", header: "Client", cell: ({ row }) => row.original.client_name ?? "—" },
    { accessorKey: "owner_name", header: "Looked after by", cell: ({ row }) => row.original.owner_name ?? "—" },
    { accessorKey: "people_now", header: "People now", meta: { className: "text-right" } },
    {
      accessorKey: "mapped_fte",
      header: "Full-time equivalent",
      meta: { className: "text-right" },
      cell: ({ row }) => <span className="tabular-nums">{row.original.mapped_fte}</span>,
    },
    {
      accessorKey: "is_active",
      header: "Status",
      meta: { text: (row) => (row.is_active ? "Active" : "Inactive") },
      cell: ({ row }) =>
        row.original.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="outline">Inactive</Badge>,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { text: false, className: "text-right" },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Edit ${row.original.name}`} onClick={() => setEditing(row.original)}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Delete ${row.original.name}`} onClick={() => setDeleting(row.original)}>
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        tier="tier1"
        title="Client accounts"
        description="The engagements you bill. Map people to them and record billing to see each one's P&L."
        columns={columns}
        data={accounts}
        noun="accounts"
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        selectable={false}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus /> Add account
          </Button>
        }
        empty={{
          icon: Briefcase,
          title: "No client accounts yet",
          description: "Add the accounts you bill, with a short code for each.",
          action: (
            <Button onClick={() => setEditing("new")}>
              <Plus /> Add account
            </Button>
          ),
        }}
      />
      <AccountDialog
        account={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "this account"}?`}
        description="Only an account with no billing, costs or people mapped can be deleted. Otherwise, mark it inactive."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await del(`/accounts/${deleting.id}`);
            toast.success("Account deleted.");
            reload();
          } catch (caught) {
            toast.error(apiMessage(caught, "Could not delete it."));
          } finally {
            setDeleting(null);
          }
        }}
      />
    </>
  );
}

function AccountDialog({
  account,
  onClose,
  onSaved,
}: {
  account: ClientAccount | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = account === "new";
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account === null) return;
    const current = account === "new" ? null : account;
    setCode(current?.code ?? "");
    setName(current?.name ?? "");
    setClient(current?.client_name ?? "");
    setNotes(current?.notes ?? "");
    setActive(current?.is_active ?? true);
    setErrors({});
  }, [account]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const found: Record<string, string> = {};
    if (isNew && !/^[A-Za-z0-9][A-Za-z0-9_\-/.]*$/.test(code.trim())) found.code = "Use letters, digits, - _ / or . (no spaces).";
    if (!name.trim()) found.name = "Give the account a name.";
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      if (isNew) {
        await post("/accounts", { code: code.trim(), name, client_name: client || null, notes: notes || null });
        toast.success("Account added.");
      } else if (account) {
        await patch(`/accounts/${account.id}`, { name, client_name: client || null, notes: notes || null, is_active: active });
        toast.success("Account saved.");
      }
      onSaved();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not save the account."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={account !== null} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void save(event)} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{isNew ? "Add a client account" : "Edit account"}</DialogTitle>
            <DialogDescription>An account is a client engagement you bill.</DialogDescription>
          </DialogHeader>
          <FormField htmlFor="account-code" label="Code" required error={errors.code} hint={isNew ? undefined : "The code cannot change."}>
            <Input
              id="account-code"
              value={code}
              maxLength={32}
              disabled={!isNew}
              placeholder="ACC-001"
              aria-invalid={Boolean(errors.code)}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </FormField>
          <FormField htmlFor="account-name" label="Account name" required error={errors.name}>
            <Input
              id="account-name"
              value={name}
              maxLength={160}
              aria-invalid={Boolean(errors.name)}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="account-client" label="Client billed" optional hint="When it differs from the account's name.">
            <Input id="account-client" value={client} maxLength={160} onChange={(event) => setClient(event.target.value)} />
          </FormField>
          <FormField htmlFor="account-notes" label="Notes" optional>
            <Textarea id="account-notes" value={notes} rows={3} maxLength={2000} onChange={(event) => setNotes(event.target.value)} />
          </FormField>
          {!isNew ? (
            <div className="flex items-center gap-2">
              <Switch id="account-active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="account-active">Active</Label>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Billing and costs ───────────────────────────────────────────────────────

function AccountSelect({
  id,
  accounts,
  value,
  onChange,
  allLabel,
  invalid,
}: {
  id: string;
  accounts: ClientAccount[];
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  invalid?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full sm:w-64" aria-invalid={invalid}>
        <SelectValue placeholder="Choose an account" />
      </SelectTrigger>
      <SelectContent>
        {allLabel ? <SelectItem value="all">{allLabel}</SelectItem> : null}
        {accounts
          .filter((a) => a.is_active || value === a.id)
          .map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name} ({a.code})
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

function EntriesTab({ accounts }: { accounts: ClientAccount[] }) {
  const [accountId, setAccountId] = useState("all");
  const [kind, setKind] = useState("all");
  const [editing, setEditing] = useState<AccountEntry | AccountEntryKind | null>(null);
  const [deleting, setDeleting] = useState<AccountEntry | null>(null);
  const [uploading, setUploading] = useState(false);
  const query = new URLSearchParams();
  if (accountId !== "all") query.set("account_id", accountId);
  if (kind !== "all") query.set("kind", kind);
  const entries = useApiQuery<AccountEntry[]>(`/accounts/entries?${query.toString()}`);

  const columns: ColumnDef<AccountEntry>[] = [
    { id: "month", header: "Month", accessorFn: (e) => e.month, cell: ({ row }) => monthLabel(row.original.month) },
    { id: "account", header: "Account", accessorFn: (e) => `${e.account_name} (${e.account_code})` },
    {
      accessorKey: "kind",
      header: "Type",
      meta: { text: (e) => (e.kind === "billing" ? "Billing" : "Cost") },
      cell: ({ row }) =>
        row.original.kind === "billing" ? <Badge variant="success">Billing</Badge> : <Badge variant="warning">Cost</Badge>,
    },
    {
      accessorKey: "amount",
      header: "Amount",
      meta: { className: "text-right", text: (e) => e.amount },
      cell: ({ row }) => <SignedMoney value={row.original.amount} />,
    },
    { accessorKey: "reference", header: "Invoice / cost head", cell: ({ row }) => row.original.reference ?? "—" },
    { accessorKey: "entry_date", header: "Date", cell: ({ row }) => (row.original.entry_date ? formatDate(row.original.entry_date) : "—") },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { text: false, className: "text-right" },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label="Edit entry" onClick={() => setEditing(row.original)}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete entry" onClick={() => setDeleting(row.original)}>
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  const noAccounts = accounts.length === 0;
  return (
    <>
      <DataTable
        tier="tier1"
        title="Billing and costs"
        description="One row per invoice raised (a credit note is negative) or direct cost, by the month it belongs to."
        columns={columns}
        data={entries.data ?? []}
        noun="entries"
        isLoading={entries.isLoading}
        error={entries.error?.detail}
        onRetry={entries.reload}
        selectable={false}
        filtered={accountId !== "all" || kind !== "all"}
        filters={
          <>
            <AccountSelect id="entries-account" accounts={accounts} value={accountId} onChange={setAccountId} allLabel="All accounts" />
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Billing and costs</SelectItem>
                <SelectItem value="billing">Billing only</SelectItem>
                <SelectItem value="cost">Costs only</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={noAccounts} onClick={() => setUploading(true)}>
              <FileUp /> Upload Excel
            </Button>
            <Button variant="outline" disabled={noAccounts} onClick={() => setEditing("cost")}>
              <Plus /> Add cost
            </Button>
            <Button disabled={noAccounts} onClick={() => setEditing("billing")}>
              <Plus /> Add billing
            </Button>
          </div>
        }
        empty={{
          icon: Briefcase,
          title: noAccounts ? "Add an account first" : "No billing or costs yet",
          description: noAccounts
            ? "Billing is recorded against a client account. Add one under Accounts."
            : "Add what you billed each month, or upload it from Excel.",
        }}
      />
      <EntryDialog
        target={editing}
        accounts={accounts}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          entries.reload();
        }}
      />
      <UploadDialog open={uploading} onClose={() => setUploading(false)} onSaved={entries.reload} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title="Delete this entry?"
        description={
          deleting
            ? `${deleting.kind === "billing" ? "Billing" : "Cost"} of ₹${deleting.amount} for ${deleting.account_name}, ${monthLabel(deleting.month)}. The P&L changes with it.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await del(`/accounts/entries/${deleting.id}`);
            toast.success("Entry deleted.");
            entries.reload();
          } catch (caught) {
            toast.error(apiMessage(caught, "Could not delete it."));
          } finally {
            setDeleting(null);
          }
        }}
      />
    </>
  );
}

function EntryDialog({
  target,
  accounts,
  onClose,
  onSaved,
}: {
  target: AccountEntry | AccountEntryKind | null;
  accounts: ClientAccount[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = typeof target === "object" ? target : null;
  const kind: AccountEntryKind = existing?.kind ?? (target === "cost" ? "cost" : "billing");
  const [accountId, setAccountId] = useState("");
  const [month, setMonth] = useState(thisMonth());
  const [amount, setAmount] = useState("");
  const [credit, setCredit] = useState(false);
  const [reference, setReference] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target === null) return;
    setAccountId(existing?.account_id ?? "");
    setMonth(existing?.month ?? thisMonth());
    setAmount(existing ? existing.amount.replace(/^-/, "") : "");
    setCredit(existing ? existing.amount.startsWith("-") : false);
    setReference(existing?.reference ?? "");
    setEntryDate(existing?.entry_date ?? "");
    setNotes(existing?.notes ?? "");
    setErrors({});
  }, [target, existing]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const found: Record<string, string> = {};
    if (!existing && !accountId) found.account = "Choose the account.";
    if (!month) found.month = "Pick the month.";
    else if (month > thisMonth()) found.month = "Record billing and costs once they have happened.";
    if (!amount || Number(amount) === 0 || Number.isNaN(Number(amount))) found.amount = "Enter an amount above zero.";
    setErrors(found);
    if (Object.keys(found).length) return;
    const signed = credit && kind === "billing" ? `-${amount}` : amount;
    setSaving(true);
    try {
      if (existing) {
        await patch(`/accounts/entries/${existing.id}`, {
          month,
          amount: signed,
          reference: reference || null,
          entry_date: entryDate || null,
          notes: notes || null,
        });
      } else {
        await post("/accounts/entries", {
          account_id: accountId,
          kind,
          month,
          amount: signed,
          reference: reference || null,
          entry_date: entryDate || null,
          notes: notes || null,
        });
      }
      toast.success(kind === "billing" ? "Billing saved." : "Cost saved.");
      onSaved();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not save it."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void save(event)} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>
              {existing ? "Edit entry" : kind === "billing" ? "Add billing" : "Add a direct cost"}
            </DialogTitle>
            <DialogDescription>
              {kind === "billing"
                ? "An invoice raised to the client, in the month it belongs to."
                : "A cost of the account other than people: travel, software, a subcontractor."}
            </DialogDescription>
          </DialogHeader>
          {existing ? (
            <p className="text-sm">
              <span className="text-muted-foreground">Account:</span> {existing.account_name} ({existing.account_code})
            </p>
          ) : (
            <FormField htmlFor="entry-account" label="Account" required error={errors.account}>
              <AccountSelect id="entry-account" accounts={accounts} value={accountId} onChange={setAccountId} invalid={Boolean(errors.account)} />
            </FormField>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="entry-month" label="Month" required error={errors.month}>
              <MonthPicker id="entry-month" value={month} onChange={setMonth} />
            </FormField>
            <FormField htmlFor="entry-amount" label="Amount (₹)" required error={errors.amount}>
              <AmountInput id="entry-amount" value={amount} onValueChange={setAmount} aria-invalid={Boolean(errors.amount)} placeholder="0.00" />
            </FormField>
          </div>
          {kind === "billing" ? (
            <div className="flex items-center gap-2">
              <Switch id="entry-credit" checked={credit} onCheckedChange={setCredit} />
              <Label htmlFor="entry-credit">This is a credit note (reduces what was billed)</Label>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="entry-reference" label={kind === "billing" ? "Invoice no." : "What it was"} optional>
              <Input
                id="entry-reference"
                value={reference}
                maxLength={120}
                placeholder={kind === "billing" ? "INV-2026-091" : "Travel"}
                onChange={(event) => setReference(event.target.value)}
              />
            </FormField>
            <FormField htmlFor="entry-date" label={kind === "billing" ? "Invoice date" : "Date"} optional>
              <DatePicker id="entry-date" value={entryDate} onChange={setEntryDate} max={today()} />
            </FormField>
          </div>
          <FormField htmlFor="entry-notes" label="Notes" optional>
            <Textarea id="entry-notes" value={notes} rows={2} maxLength={2000} onChange={(event) => setNotes(event.target.value)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [checked, setChecked] = useState<AccountImport | null>(null);
  const [busy, setBusy] = useState<"check" | "save" | "template" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setChecked(null);
      setProblem(null);
    }
  }, [open]);

  const send = async (apply: boolean) => {
    if (!file) return setProblem("Choose the filled sheet first.");
    setBusy(apply ? "save" : "check");
    setProblem(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("apply", apply ? "true" : "false");
      const result = await post<AccountImport>("/accounts/entries/import", form);
      setChecked(result);
      if (apply) {
        toast.success(`${result.saved} row(s) saved.`);
        onSaved();
        onClose();
      }
    } catch (caught) {
      setProblem(apiMessage(caught, "Could not read the file."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && busy === null && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload billing and costs</DialogTitle>
          <DialogDescription>
            One row per invoice or cost: Account code, Type (Billing or Cost), Month, Amount, Invoice no. / cost head,
            Date and Notes. Every row is checked first; nothing is saved while any row has an error.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Button
            variant="outline"
            className="w-fit"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("template");
              try {
                await downloadFile("/accounts/entries/template", "account-billing-and-costs.xlsx");
              } catch (caught) {
                toast.error(apiMessage(caught, "Could not download the template."));
              } finally {
                setBusy(null);
              }
            }}
          >
            <Download /> Download template
          </Button>
          <FormField htmlFor="entries-file" label="Filled sheet (.xlsx or .csv, up to 5 MB)" required>
            <FileInput
              id="entries-file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setChecked(null);
              }}
            />
          </FormField>
          {problem ? (
            <Alert variant="destructive">
              <AlertDescription>{problem}</AlertDescription>
            </Alert>
          ) : null}
          {checked ? (
            <div className="grid gap-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">{checked.ready} ready</Badge>
                {checked.errors ? <Badge variant="destructive">{checked.errors} with errors</Badge> : null}
                {checked.skipped ? <Badge variant="outline">{checked.skipped} blank</Badge> : null}
              </div>
              <DataTable
                variant="plain"
                columns={[
                  { accessorKey: "row", header: "Row" },
                  {
                    accessorKey: "status",
                    header: "Status",
                    cell: ({ row }) =>
                      row.original.status === "ready" ? (
                        <Badge variant="success">Ready</Badge>
                      ) : row.original.status === "error" ? (
                        <Badge variant="destructive">Error</Badge>
                      ) : (
                        <Badge variant="outline">Blank</Badge>
                      ),
                  },
                  { accessorKey: "account_code", header: "Account", cell: ({ row }) => row.original.account_code ?? "—" },
                  { accessorKey: "month", header: "Month", cell: ({ row }) => (row.original.month ? monthLabel(row.original.month) : "—") },
                  {
                    accessorKey: "amount",
                    header: "Amount",
                    meta: { className: "text-right" },
                    cell: ({ row }) => (row.original.amount ? <SignedMoney value={row.original.amount} /> : "—"),
                  },
                  { accessorKey: "message", header: "Problem", cell: ({ row }) => row.original.message ?? "" },
                ]}
                data={checked.rows.filter((r) => r.status !== "skipped")}
                getRowId={(r) => String(r.row)}
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy !== null} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" disabled={busy !== null || !file} onClick={() => void send(false)}>
            {busy === "check" ? <Loader2 className="animate-spin" /> : null} Check file
          </Button>
          <Button
            disabled={busy !== null || !checked || checked.errors > 0 || checked.ready === 0}
            onClick={() => void send(true)}
          >
            {busy === "save" ? <Loader2 className="animate-spin" /> : null} Save {checked?.ready ?? 0} row(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── People on accounts ──────────────────────────────────────────────────────

function PeopleTab({ accounts, onChanged }: { accounts: ClientAccount[]; onChanged: () => void }) {
  const [accountId, setAccountId] = useState("all");
  const [current, setCurrent] = useState(true);
  const [adding, setAdding] = useState(false);
  const [ending, setEnding] = useState<AccountAllocation | null>(null);
  const [deleting, setDeleting] = useState<AccountAllocation | null>(null);
  const query = new URLSearchParams();
  if (accountId !== "all") query.set("account_id", accountId);
  if (current) query.set("current_only", "true");
  const allocations = useApiQuery<AccountAllocation[]>(`/accounts/allocations?${query.toString()}`);
  const changed = () => {
    allocations.reload();
    onChanged();
  };

  const columns: ColumnDef<AccountAllocation>[] = [
    {
      id: "person",
      header: "Person",
      accessorFn: (a) => `${a.employee_name} ${a.employee_code}`,
      meta: { text: (a) => `${a.employee_name} (${a.employee_code})` },
      cell: ({ row }) => (
        <span className="grid">
          <span className="font-medium">{row.original.employee_name}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.employee_code}
            {row.original.department_name ? ` · ${row.original.department_name}` : ""}
          </span>
        </span>
      ),
    },
    { id: "account", header: "Account", accessorFn: (a) => `${a.account_name} (${a.account_code})` },
    {
      accessorKey: "percent",
      header: "Share",
      meta: { className: "text-right", text: (a) => `${a.percent}%` },
      cell: ({ row }) => <span className="tabular-nums">{Number(row.original.percent)}%</span>,
    },
    { accessorKey: "effective_from", header: "From", cell: ({ row }) => formatDate(row.original.effective_from) },
    {
      accessorKey: "effective_to",
      header: "Until",
      cell: ({ row }) => (row.original.effective_to ? formatDate(row.original.effective_to) : "Open"),
    },
    {
      accessorKey: "active",
      header: "Now",
      meta: { text: (a) => (a.active ? "On it" : "Not now") },
      cell: ({ row }) => (row.original.active ? <Badge variant="success">On it</Badge> : <Badge variant="outline">Not now</Badge>),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { text: false, className: "text-right" },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {!row.original.effective_to ? (
            <Button variant="outline" size="sm" onClick={() => setEnding(row.original)}>
              End
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" aria-label="Delete mapping" onClick={() => setDeleting(row.original)}>
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        tier="tier1"
        title="People on accounts"
        description="Who works on which account, how much of their time, from when. Their payroll cost is shared out by it, day by day."
        columns={columns}
        data={allocations.data ?? []}
        noun="mappings"
        isLoading={allocations.isLoading}
        error={allocations.error?.detail}
        onRetry={allocations.reload}
        selectable={false}
        filtered={accountId !== "all"}
        filters={
          <>
            <AccountSelect id="people-account" accounts={accounts} value={accountId} onChange={setAccountId} allLabel="All accounts" />
            <div className="flex items-center gap-2">
              <Switch id="people-current" checked={current} onCheckedChange={setCurrent} />
              <Label htmlFor="people-current">Current only</Label>
            </div>
          </>
        }
        actions={
          <Button disabled={accounts.filter((a) => a.is_active).length === 0} onClick={() => setAdding(true)}>
            <UserPlus /> Map a person
          </Button>
        }
        empty={{
          icon: UserPlus,
          title: "Nobody is mapped yet",
          description: "Map each person to the accounts they work on, with their share of time.",
        }}
      />
      <MapDialog open={adding} accounts={accounts} onClose={() => setAdding(false)} onSaved={changed} />
      <EndDialog allocation={ending} onClose={() => setEnding(null)} onSaved={changed} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title="Delete this mapping?"
        description="Only for a mapping entered by mistake: past P&Ls change with it. To move someone, end the mapping instead."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await del(`/accounts/allocations/${deleting.id}`);
            toast.success("Mapping deleted.");
            changed();
          } catch (caught) {
            toast.error(apiMessage(caught, "Could not delete it."));
          } finally {
            setDeleting(null);
          }
        }}
      />
    </>
  );
}

function MapDialog({
  open,
  accounts,
  onClose,
  onSaved,
}: {
  open: boolean;
  accounts: ClientAccount[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [person, setPerson] = useState<EmployeeSummary | null>(null);
  const [accountId, setAccountId] = useState("");
  const [percent, setPercent] = useState("100");
  const [from, setFrom] = useState(today());
  const [until, setUntil] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPerson(null);
      setAccountId("");
      setPercent("100");
      setFrom(today());
      setUntil("");
      setErrors({});
    }
  }, [open]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const found: Record<string, string> = {};
    if (!person) found.person = "Choose the person.";
    if (!accountId) found.account = "Choose the account.";
    if (!percentOk(percent)) found.percent = "A share above 0 and at most 100, up to two decimals.";
    if (!from) found.from = "Pick the first day.";
    if (until && from && until < from) found.until = "The last day cannot be before the first.";
    setErrors(found);
    if (Object.keys(found).length || !person) return;
    setSaving(true);
    try {
      await post("/accounts/allocations", {
        employee_id: person.id,
        account_id: accountId,
        percent,
        effective_from: from,
        effective_to: until || null,
      });
      toast.success("Mapped.");
      onSaved();
      onClose();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not map them."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void save(event)} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Map a person to an account</DialogTitle>
            <DialogDescription>
              Their share of time on the account, from a date. A person&apos;s shares add up to at most 100%.
            </DialogDescription>
          </DialogHeader>
          <FormField htmlFor="map-person" label="Person" required error={errors.person}>
            <EmployeePicker id="map-person" value={person} onChange={setPerson} excludeId={null} invalid={Boolean(errors.person)} />
          </FormField>
          <FormField htmlFor="map-account" label="Account" required error={errors.account}>
            <AccountSelect id="map-account" accounts={accounts} value={accountId} onChange={setAccountId} invalid={Boolean(errors.account)} />
          </FormField>
          <FormField htmlFor="map-percent" label="Share of their time (%)" required error={errors.percent}>
            <Input
              id="map-percent"
              inputMode="decimal"
              autoComplete="off"
              className="w-32 text-right tabular-nums"
              value={percent}
              aria-invalid={Boolean(errors.percent)}
              onChange={(event) => {
                const next = event.target.value.replace(/[\s%]/g, "");
                if (/^\d{0,3}(\.\d{0,2})?$/.test(next)) setPercent(next);
              }}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="map-from" label="From" required error={errors.from}>
              <DatePicker id="map-from" value={from} onChange={setFrom} required />
            </FormField>
            <FormField htmlFor="map-until" label="Until" optional error={errors.until} hint="Leave empty while it lasts.">
              <DatePicker id="map-until" value={until} onChange={setUntil} min={from || null} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EndDialog({
  allocation,
  onClose,
  onSaved,
}: {
  allocation: AccountAllocation | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [day, setDay] = useState(today());
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (allocation) setDay(today() < allocation.effective_from ? allocation.effective_from : today());
  }, [allocation]);

  return (
    <Dialog open={allocation !== null} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>End this mapping</DialogTitle>
          <DialogDescription>
            {allocation
              ? `${allocation.employee_name} on ${allocation.account_name} at ${Number(allocation.percent)}%. To change the share, end it here and map them again from the next day.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <FormField htmlFor="end-day" label="Last day on the account" required>
          <DatePicker id="end-day" value={day} onChange={setDay} min={allocation?.effective_from ?? null} required />
        </FormField>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={saving || !day}
            onClick={async () => {
              if (!allocation) return;
              setSaving(true);
              try {
                await post(`/accounts/allocations/${allocation.id}/end`, { last_day: day });
                toast.success("Mapping ended.");
                onSaved();
                onClose();
              } catch (caught) {
                toast.error(apiMessage(caught, "Could not end it."));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="animate-spin" /> : null} End mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
