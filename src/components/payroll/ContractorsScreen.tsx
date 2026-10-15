"use client";

import { Download, FileText, Loader2, Plus, Users } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { RequireRole } from "@/components/common/RequireRole";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, downloadFile, post } from "@/lib/api";
import { formatDay, toISODate } from "@/lib/utils";

interface Contractor {
  id: string;
  name: string;
  kind: string;
  pan_masked: string | null;
  has_pan: boolean;
  gstin: string | null;
  email: string | null;
  default_section: string;
  active: boolean;
}

interface Invoice {
  id: string;
  contractor_name: string | null;
  invoice_number: string;
  invoice_date: string;
  amount: string;
  gst_amount: string;
  section: string;
  tds_rate: string;
  tds_amount: string;
  net_payable: string;
  tds_note: string | null;
  status: "pending" | "approved" | "paid" | "cancelled";
  paid_on: string | null;
  contractor_id: string;
  challan_id: string | null;
}

interface ChallanPosition {
  ready: boolean;
  untied_invoices: number;
  untied_tds: string;
  challans: {
    id: string;
    bsr_code: string;
    deposit_date: string;
    challan_serial: string;
    tds_amount: string;
    tied: string;
    unused: string;
  }[];
}

const QUARTER_MONTHS: Record<string, number[]> = { "1": [4, 5, 6], "2": [7, 8, 9], "3": [10, 11, 12], "4": [1, 2, 3] };

function inQuarter(day: string, year: string, quarter: string): boolean {
  const [y, m] = day.split("-").map(Number);
  const start = Number(year.slice(0, 4));
  return QUARTER_MONTHS[quarter].includes(m) && y === (quarter === "4" ? start + 1 : start);
}

/** The quarter's 26Q challans, the invoices whose TDS each holds, and a statement per contractor. */
function ChallanTies({
  year,
  quarter,
  invoices,
  contractors,
  onChanged,
}: {
  year: string;
  quarter: string;
  invoices: Invoice[];
  contractors: Contractor[];
  onChanged: () => void;
}) {
  const valid = /^\d{4}-\d{2}$/.test(year);
  const position = useApiQuery<ChallanPosition>(
    valid ? `/contractors/form-26q/challans?financial_year=${year}&quarter=${quarter}` : null,
  );
  const [statementFor, setStatementFor] = useState("");
  const due = invoices.filter(
    (invoice) =>
      (invoice.status === "approved" || invoice.status === "paid") &&
      Number(invoice.tds_amount) > 0 &&
      valid &&
      inQuarter(invoice.invoice_date, year, quarter),
  );

  const link = async (invoice: Invoice, challanId: string) => {
    try {
      await post(`/contractors/invoices/${invoice.id}/challan`, { challan_id: challanId === "none" ? null : challanId });
      toast.success(challanId === "none" ? "Unlinked." : "Tied to the challan.");
      position.reload();
      onChanged();
    } catch (caught) {
      toast.error(failure(caught, "That did not go through."));
    }
  };

  const statement = async () => {
    try {
      await downloadFile(
        `/contractors/${statementFor}/tds-statement?financial_year=${year}&quarter=${quarter}`,
        `TDS-statement-${year}-Q${quarter}.pdf`,
      );
    } catch (caught) {
      toast.error(failure(caught, "The statement could not be produced."));
    }
  };

  if (!valid) return null;
  const challans = position.data?.challans ?? [];
  return (
    <div className="space-y-4 border-t border-border p-5">
      <div>
        <p className="font-medium">Challans for this quarter</p>
        <p className="text-sm text-muted-foreground">
          Record 26Q deposits under Statutory filings → TDS challans, then tie each invoice&apos;s TDS to the
          challan it went under. The working file carries the challan details.
        </p>
      </div>
      {position.data && !position.data.ready && (
        <Badge variant="warning">
          {position.data.untied_invoices} invoice(s), ₹{position.data.untied_tds} of TDS not yet tied to a challan
        </Badge>
      )}
      {challans.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Challan</TableHead>
              <TableHead className="text-right">Deposited</TableHead>
              <TableHead className="text-right">Tied</TableHead>
              <TableHead className="text-right">Unused</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {challans.map((challan) => (
              <TableRow key={challan.id}>
                <TableCell className="tabular-nums">
                  {challan.bsr_code} · {challan.challan_serial} · {formatDay(challan.deposit_date, true)}
                </TableCell>
                <TableCell className="text-right">
                  <Money value={challan.tds_amount} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={challan.tied} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={challan.unused} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {due.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead className="text-right">TDS</TableHead>
              <TableHead>Challan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {due.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>
                  {invoice.contractor_name} · {invoice.invoice_number}
                </TableCell>
                <TableCell className="text-right">
                  <Money value={invoice.tds_amount} />
                </TableCell>
                <TableCell>
                  <Select value={invoice.challan_id ?? "none"} onValueChange={(value) => void link(invoice, value)}>
                    <SelectTrigger className="w-64" aria-label={`Challan for ${invoice.invoice_number}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not yet tied</SelectItem>
                      {challans.map((challan) => (
                        <SelectItem key={challan.id} value={challan.id}>
                          {challan.bsr_code} · {challan.challan_serial}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <FormField
          htmlFor="tds-statement-for"
          label="TDS statement for a contractor"
          hint="Their deductions this quarter with the challans. Form 16A itself comes from TRACES."
        >
          <Select value={statementFor} onValueChange={setStatementFor}>
            <SelectTrigger id="tds-statement-for" className="w-64">
              <SelectValue placeholder="Choose a contractor" />
            </SelectTrigger>
            <SelectContent>
              {contractors.map((contractor) => (
                <SelectItem key={contractor.id} value={contractor.id}>
                  {contractor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <Button variant="outline" disabled={!statementFor} onClick={() => void statement()}>
          <Download /> Statement PDF
        </Button>
      </div>
    </div>
  );
}

const SECTIONS: Record<string, string> = {
  "194C": "194C — contract work",
  "194J_professional": "194J — professional fees",
  "194J_technical": "194J — technical fees",
};
const KINDS: Record<string, string> = {
  individual: "Individual",
  huf: "HUF",
  firm: "Firm / LLP",
  company: "Company",
};

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

function currentFinancialYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export function ContractorsScreen() {
  const contractors = useApiQuery<Contractor[]>("/contractors");
  const invoices = useApiQuery<Invoice[]>("/contractors/invoices");
  const [creating, setCreating] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [year, setYear] = useState(currentFinancialYear);
  const [quarter, setQuarter] = useState("1");

  const act = async (invoice: Invoice, path: string, body: object | undefined, done: string) => {
    setBusy(invoice.id);
    try {
      await post(`/contractors/invoices/${invoice.id}/${path}`, body);
      toast.success(done);
      invoices.reload();
    } catch (caught) {
      toast.error(failure(caught, "That did not go through."));
    } finally {
      setBusy(null);
    }
  };

  const export26q = async () => {
    try {
      await downloadFile(`/contractors/form-26q?financial_year=${year}&quarter=${quarter}`, `26Q-${year}-Q${quarter}.csv`);
    } catch (caught) {
      toast.error(failure(caught, "The file could not be downloaded."));
    }
  };

  return (
    <PageShell
      title="Contractors"
      description="Consultants and vendors paid against invoices, with TDS under 194C and 194J worked out from your rule set."
    >
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="contractors">Contractors</TabsTrigger>
          <TabsTrigger value="26q">26Q</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices" className="mt-4">
          <DataPanel
            tier="tier1"
            title="Invoices"
            actions={
              <Button size="sm" disabled={(contractors.data ?? []).length === 0} onClick={() => setInvoicing(true)}>
                <Plus /> Enter an invoice
              </Button>
            }
            isLoading={invoices.isLoading && !invoices.data}
            error={invoices.error?.detail ?? null}
            onRetry={invoices.reload}
            isEmpty={(invoices.data ?? []).length === 0}
            empty={{ icon: FileText, title: "No invoices yet" }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">TDS</TableHead>
                  <TableHead className="text-right">Pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invoices.data ?? []).map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <p className="font-medium">{invoice.contractor_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.invoice_number} · {formatDay(invoice.invoice_date, true)}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{invoice.section}</TableCell>
                    <TableCell className="text-right">
                      <Money value={invoice.amount} />
                      {Number(invoice.gst_amount) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          + GST <Money value={invoice.gst_amount} />
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={invoice.tds_amount} />
                      <p className="text-xs text-muted-foreground">{invoice.tds_rate}%</p>
                      {invoice.tds_note && <p className="max-w-56 text-xs text-muted-foreground">{invoice.tds_note}</p>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={invoice.net_payable} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={invoice.status === "paid" ? "success" : invoice.status === "approved" ? "secondary" : "warning"}>{invoice.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice.status === "pending" && (
                        <RequireRole roles={["admin"]}>
                          <Button size="sm" disabled={busy === invoice.id} onClick={() => void act(invoice, "approve", undefined, "Approved.")}>
                            Approve
                          </Button>
                        </RequireRole>
                      )}
                      {invoice.status === "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === invoice.id}
                          onClick={() => void act(invoice, "paid", { paid_on: toISODate(new Date()) }, "Marked paid.")}
                        >
                          Mark paid today
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataPanel>
        </TabsContent>
        <TabsContent value="contractors" className="mt-4">
          <DataPanel
            tier="tier1"
            title="Contractors"
            actions={
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus /> Add a contractor
              </Button>
            }
            isLoading={contractors.isLoading && !contractors.data}
            error={contractors.error?.detail ?? null}
            onRetry={contractors.reload}
            isEmpty={(contractors.data ?? []).length === 0}
            empty={{ icon: Users, title: "No contractors yet" }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>PAN</TableHead>
                  <TableHead>Section</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(contractors.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium">{c.name}</p>
                      {c.gstin && <p className="text-xs text-muted-foreground">GSTIN {c.gstin}</p>}
                    </TableCell>
                    <TableCell>{KINDS[c.kind] ?? c.kind}</TableCell>
                    <TableCell className="font-mono text-sm">{c.pan_masked ?? <Badge variant="warning">No PAN — higher TDS</Badge>}</TableCell>
                    <TableCell className="text-sm">{SECTIONS[c.default_section] ?? c.default_section}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataPanel>
        </TabsContent>
        <TabsContent value="26q" className="mt-4">
          <DataPanel
            tier="tier1"
            title="Form 26Q working file"
            description="The quarter's deductee lines from approved and paid invoices, for your return-preparation utility. Validate with the FVU before filing."
          >
            <div className="flex flex-wrap items-end gap-3 p-5">
              <FormField htmlFor="q26-year" label="Financial year">
                <Input id="q26-year" className="w-32" value={year} onChange={(e) => setYear(e.target.value)} />
              </FormField>
              <FormField htmlFor="q26-quarter" label="Quarter">
                <Select value={quarter} onValueChange={setQuarter}>
                  <SelectTrigger id="q26-quarter" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Q1 (Apr–Jun)</SelectItem>
                    <SelectItem value="2">Q2 (Jul–Sep)</SelectItem>
                    <SelectItem value="3">Q3 (Oct–Dec)</SelectItem>
                    <SelectItem value="4">Q4 (Jan–Mar)</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <Button variant="outline" disabled={!/^\d{4}-\d{2}$/.test(year)} onClick={() => void export26q()}>
                <Download /> Download
              </Button>
            </div>
            <ChallanTies
              year={year}
              quarter={quarter}
              invoices={invoices.data ?? []}
              contractors={contractors.data ?? []}
              onChanged={invoices.reload}
            />
          </DataPanel>
        </TabsContent>
      </Tabs>
      {creating && (
        <ContractorDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            contractors.reload();
          }}
        />
      )}
      {invoicing && (
        <InvoiceDialog
          contractors={(contractors.data ?? []).filter((c) => c.active)}
          onClose={() => setInvoicing(false)}
          onCreated={() => {
            setInvoicing(false);
            invoices.reload();
          }}
        />
      )}
    </PageShell>
  );
}

function ContractorDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("individual");
  const [pan, setPan] = useState("");
  const [gstin, setGstin] = useState("");
  const [section, setSection] = useState("194C");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await post("/contractors", {
        name: name.trim(),
        kind,
        pan: pan.trim().toUpperCase() || null,
        gstin: gstin.trim().toUpperCase() || null,
        default_section: section,
      });
      toast.success("Contractor added.");
      onCreated();
    } catch (caught) {
      toast.error(failure(caught, "The contractor could not be added."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a contractor</DialogTitle>
          <DialogDescription>Without a PAN, TDS is charged at the higher rate in your rule set.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="con-name" label="Name">
            <Input id="con-name" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="con-kind" label="Kind">
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="con-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KINDS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="con-section" label="Usual section">
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger id="con-section" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SECTIONS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="con-pan" label="PAN" optional>
              <Input id="con-pan" maxLength={10} className="font-mono uppercase" value={pan} onChange={(e) => setPan(e.target.value)} />
            </FormField>
            <FormField htmlFor="con-gstin" label="GSTIN" optional>
              <Input id="con-gstin" maxLength={15} className="font-mono uppercase" value={gstin} onChange={(e) => setGstin(e.target.value)} />
            </FormField>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || name.trim().length < 2 || (pan.trim() !== "" && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.trim().toUpperCase()))} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceDialog({ contractors, onClose, onCreated }: { contractors: Contractor[]; onClose: () => void; onCreated: () => void }) {
  const [contractorId, setContractorId] = useState(contractors[0]?.id ?? "");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const [amount, setAmount] = useState("");
  const [gst, setGst] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const created = await post<Invoice>(`/contractors/${contractorId}/invoices`, {
        invoice_number: number.trim(),
        invoice_date: date,
        amount,
        gst_amount: gst || "0",
      });
      toast.success(`Entered. TDS ₹${created.tds_amount}; pay ₹${created.net_payable}.`);
      onCreated();
    } catch (caught) {
      toast.error(failure(caught, "The invoice could not be entered."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enter an invoice</DialogTitle>
          <DialogDescription>TDS is charged on the amount before GST, at the rule set in force on the invoice date.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="inv-contractor" label="Contractor">
            <Select value={contractorId} onValueChange={setContractorId}>
              <SelectTrigger id="inv-contractor" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contractors.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="inv-number" label="Invoice number">
              <Input id="inv-number" maxLength={64} value={number} onChange={(e) => setNumber(e.target.value)} />
            </FormField>
            <FormField htmlFor="inv-date" label="Invoice date">
              <Input id="inv-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormField>
            <FormField htmlFor="inv-amount" label="Amount before GST">
              <Input id="inv-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </FormField>
            <FormField htmlFor="inv-gst" label="GST" optional>
              <Input id="inv-gst" inputMode="decimal" value={gst} onChange={(e) => setGst(e.target.value)} />
            </FormField>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !contractorId || !number.trim() || !date || !(Number(amount) > 0)} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Enter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
