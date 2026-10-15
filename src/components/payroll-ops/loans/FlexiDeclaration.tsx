"use client";

import { PiggyBank } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmployeePicker } from "@/components/common/EmployeePicker";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { financialYearStart, isMoneyInput, longFinancialYear } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post, put } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";

import { FinancialYearSelect } from "./FinancialYearSelect";

interface FlexiComponent {
  code: string;
  name: string;
  limit: string;
  amount: string;
}

interface Flexi {
  id: string | null;
  financial_year: string | null;
  pot: string;
  declared: string;
  undeclared: string;
  status: "none" | "draft" | "submitted" | "approved" | "rejected";
  decision_note: string | null;
  components: FlexiComponent[];
  note: string;
}

const STATUS: Record<Flexi["status"], { label: string; variant: "secondary" | "outline" | "default" | "destructive" }> = {
  none: { label: "No pot set", variant: "outline" },
  draft: { label: "Draft", variant: "outline" },
  submitted: { label: "Waiting for HR", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Sent back", variant: "destructive" },
};

const failed = (caught: unknown, fallback: string) =>
  toast.error(caught instanceof ApiError ? caught.detail : fallback);

/** The person's flexi-benefit pot for a year, and how they split it across components. */
export function MyFlexiDeclaration({ year, onChanged }: { year: string; onChanged: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<Flexi>(
    `/reimbursements/flexi/me?financial_year=${encodeURIComponent(year)}`,
  );
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAmounts(Object.fromEntries((data?.components ?? []).map((c) => [c.code, c.amount === "0" ? "" : c.amount])));
  }, [data]);

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (error) return <ErrorState message={error.detail} onRetry={reload} />;
  if (!data || data.status === "none") return null;

  const locked = data.status === "approved" || data.status === "submitted";
  const invalid = Object.values(amounts).some((value) => value !== "" && !isMoneyInput(value));
  const total = Object.values(amounts).reduce((sum, value) => sum + (Number(value) || 0), 0);

  const save = async (submit: boolean) => {
    setBusy(true);
    try {
      await put("/reimbursements/flexi/me", {
        financial_year: year,
        submit,
        allocations: Object.fromEntries(Object.entries(amounts).filter(([, value]) => value !== "")),
      });
      toast.success(submit ? "Sent to HR for approval." : "Draft saved.");
      reload();
      onChanged();
    } catch (caught) {
      failed(caught, "The declaration was not saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="size-4" /> Flexi benefit plan, FY {year}
          <Badge variant={STATUS[data.status].variant}>{STATUS[data.status].label}</Badge>
        </CardTitle>
        <CardDescription>
          Your flexi pot is <Money value={data.pot} />. {data.note}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.status === "rejected" && data.decision_note && (
          <p className="text-sm text-destructive">HR: {data.decision_note}</p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Component</TableHead>
              <TableHead className="text-right">Up to</TableHead>
              <TableHead className="w-44 text-right">Your amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.components.map((component) => (
              <TableRow key={component.code}>
                <TableCell>{component.name}</TableCell>
                <TableCell className="text-right">
                  <Money value={component.limit} />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    aria-label={`Amount for ${component.name}`}
                    inputMode="decimal"
                    className="ml-auto w-36 text-right"
                    disabled={locked}
                    value={amounts[component.code] ?? ""}
                    onChange={(event) => setAmounts((prev) => ({ ...prev, [component.code]: event.target.value }))}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-sm text-muted-foreground">
          Declared {total.toLocaleString("en-IN")} of <Money value={data.pot} />. The rest is paid as taxable
          salary.
        </p>
        {!locked && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || invalid} onClick={() => void save(false)}>
              Save draft
            </Button>
            <Button disabled={busy || invalid} onClick={() => void save(true)}>
              Submit to HR
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** HR: set a person's flexi pot, and approve, send back or reopen their split. */
export function FlexiDeclarationsPanel() {
  const [person, setPerson] = useState<EmployeeSummary | null>(null);
  const [year, setYear] = useState(longFinancialYear(financialYearStart()));
  const { data, error, isLoading, reload } = useApiQuery<Flexi>(
    person ? `/reimbursements/flexi/${person.id}?financial_year=${encodeURIComponent(year)}` : null,
  );
  const [pot, setPot] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPot(data && data.status !== "none" ? data.pot : "");
    setNote("");
  }, [data]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      reload();
    } catch (caught) {
      failed(caught, "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Flexi benefit plans</CardTitle>
        <CardDescription>
          Set the flexible part of a person&apos;s CTC for the year. They split it across the reimbursement
          components; once you approve it, that split is their entitlement for claims and payroll.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <FormField htmlFor="flexi-person" label="Employee">
            <EmployeePicker id="flexi-person" value={person} onChange={setPerson} excludeId={null} />
          </FormField>
          <FormField htmlFor="flexi-year" label="Financial year">
            <FinancialYearSelect value={year} onChange={setYear} />
          </FormField>
        </div>

        {!person ? null : isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : error ? (
          <ErrorState message={error.detail} onRetry={reload} />
        ) : data ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <FormField htmlFor="flexi-pot" label="Flexi pot for the year">
                <Input
                  id="flexi-pot"
                  inputMode="decimal"
                  className="w-44"
                  value={pot}
                  onChange={(event) => setPot(event.target.value)}
                />
              </FormField>
              <Button
                variant="outline"
                disabled={busy || !isMoneyInput(pot)}
                onClick={() =>
                  void run(
                    () => put(`/reimbursements/flexi/${person.id}/pot`, { financial_year: year, pot }),
                    "Flexi pot saved.",
                  )
                }
              >
                Save pot
              </Button>
              <Badge variant={STATUS[data.status].variant}>{STATUS[data.status].label}</Badge>
            </div>

            {data.status !== "none" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead className="text-right">Limit</TableHead>
                    <TableHead className="text-right">Declared</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.components.map((component) => (
                    <TableRow key={component.code}>
                      <TableCell>{component.name}</TableCell>
                      <TableCell className="text-right">
                        <Money value={component.limit} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={component.amount} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {data.id && data.status === "submitted" && (
              <div className="space-y-2">
                <Textarea
                  aria-label="Note to the employee"
                  placeholder="What needs changing (required to send back)"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => post(`/reimbursements/flexi-declarations/${data.id}/decide`, { approve: true, note }),
                        "Approved.",
                      )
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !note.trim()}
                    onClick={() =>
                      void run(
                        () => post(`/reimbursements/flexi-declarations/${data.id}/decide`, { approve: false, note }),
                        "Sent back.",
                      )
                    }
                  >
                    Send back
                  </Button>
                </div>
              </div>
            )}
            {data.id && data.status === "approved" && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => post(`/reimbursements/flexi-declarations/${data.id}/decide`, { approve: null, note: null }),
                    "Reopened. The person can change their split.",
                  )
                }
              >
                Reopen for changes
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
