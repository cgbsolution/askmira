"use client";

import { Loader2, PartyPopper, Plus, Save, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { put } from "@/lib/api";

import { apiDetail } from "./cultureShared";

interface Rule {
  years: number;
  points: number | null;
  message: string;
  active: boolean;
}

/**
 * Which work anniversaries the company marks. Each is posted on the feed for
 * people who share their work anniversary, privately for everybody else, with
 * points where set and rewards are on.
 */
export function MilestonesPanel() {
  const { data, error, isLoading, reload } = useApiQuery<Rule[]>("/culture/milestones");
  const [rows, setRows] = useState<Rule[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setRows(data.map((r) => ({ ...r })));
  }, [data]);

  const update = (index: number, change: Partial<Rule>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));

  const save = async () => {
    setBusy(true);
    try {
      await put("/culture/milestones", { rules: rows });
      toast.success("Work anniversaries saved.");
      reload();
    } catch (caught) {
      toast.error(apiDetail(caught, "They could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DataPanel
      tier="tier2"
      title="Work anniversaries"
      description="Marked automatically each morning. {name}, {years} and {company} are filled in."
      actions={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRows((current) => [...current, { years: 1, points: null, message: "", active: true }])}
          >
            <Plus /> Add
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2 className="animate-spin" /> : <Save />} Save
          </Button>
        </div>
      }
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{ icon: PartyPopper, title: "No anniversaries marked", description: "Add 1, 3, 5 or 10 years to start." }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Years</TableHead>
            <TableHead>Message</TableHead>
            <TableHead className="w-32">Points</TableHead>
            <TableHead className="w-20">On</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              <TableCell>
                <Input
                  aria-label="Years"
                  inputMode="numeric"
                  value={String(row.years)}
                  onChange={(e) => update(index, { years: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                />
              </TableCell>
              <TableCell>
                <Input
                  aria-label="Message"
                  maxLength={1000}
                  placeholder="Happy {years}-year work anniversary, {name}!"
                  value={row.message}
                  onChange={(e) => update(index, { message: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <Input
                  aria-label="Points"
                  inputMode="numeric"
                  placeholder="None"
                  value={row.points ? String(row.points) : ""}
                  onChange={(e) => update(index, { points: Number(e.target.value.replace(/\D/g, "")) || null })}
                />
              </TableCell>
              <TableCell>
                <Switch aria-label="Marked" checked={row.active} onCheckedChange={(on) => update(index, { active: on })} />
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Remove"
                  onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                >
                  <X />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataPanel>
  );
}
