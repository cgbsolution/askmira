"use client";

import { Clock, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { RequireRole } from "@/components/common/RequireRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProjectRow } from "@/components/time/TimesheetScreen";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import { formatDay } from "@/lib/utils";

interface Rate {
  id: string;
  project_id: string | null;
  project: string | null;
  rate: string;
  effective_from: string;
  reason: string | null;
}

const GENERAL = "__general";

/**
 * For people paid by the hour: the rate from each date, in general or for one
 * project. A raise is a new row; an approved timesheet is priced entry by entry
 * at the project's rate where one is set, else the general rate in force.
 */
export function HourlyRatesCard({ employeeId }: { employeeId: string }) {
  const { data, reload } = useApiQuery<Rate[]>(`/timesheets/rates/${employeeId}`);
  const projects = useApiQuery<ProjectRow[]>("/timesheets/projects");
  const [rate, setRate] = useState("");
  const [from, setFrom] = useState("");
  const [projectId, setProjectId] = useState(GENERAL);
  const [busy, setBusy] = useState(false);
  const rows = data ?? [];

  const add = async () => {
    setBusy(true);
    try {
      await post("/timesheets/rates", {
        employee_id: employeeId,
        project_id: projectId === GENERAL ? null : projectId,
        rate,
        effective_from: from,
      });
      toast.success("Hourly rate added.");
      setRate("");
      setFrom("");
      setProjectId(GENERAL);
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The rate could not be added.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="size-4 text-primary" /> Hourly pay
        </CardTitle>
        <CardDescription>
          Only for people paid by the hour. Approved timesheets are priced at these rates: a project&apos;s own rate
          where one is set, else the general rate.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>For</TableHead>
                <TableHead className="text-right">An hour</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDay(r.effective_from, true)}</TableCell>
                  <TableCell>{r.project ?? "General rate"}</TableCell>
                  <TableCell className="text-right">
                    <Money value={r.rate} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <RequireRole roles={["admin"]}>
          <div className="grid gap-3 sm:grid-cols-[12rem_10rem_12rem_auto] sm:items-end">
            <FormField htmlFor="rate-project" label="For">
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="rate-project" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GENERAL}>General rate</SelectItem>
                  {(projects.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="rate-amount" label="Rate an hour (₹)">
              <Input id="rate-amount" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            </FormField>
            <FormField htmlFor="rate-from" label="From">
              <Input id="rate-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </FormField>
            <Button disabled={busy || !(Number(rate) > 0) || !from} onClick={() => void add()}>
              {busy && <Loader2 className="animate-spin" />} Add rate
            </Button>
          </div>
        </RequireRole>
      </CardContent>
    </Card>
  );
}
