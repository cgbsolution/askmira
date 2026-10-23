"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Bell, Loader2, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { RequireRole } from "@/components/common/RequireRole";
import { RULE_TYPE_LABEL } from "@/components/payroll/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import { formatDay } from "@/lib/utils";

interface Notice {
  id: string;
  rule_type: string;
  jurisdiction: string;
  effective_from: string;
  title: string;
  summary: string;
  source_reference: string;
  has_suggested_rules: boolean;
  withdrawn: boolean;
  status: "in_place" | "drafted" | "action_needed";
}

interface CoverageRow {
  jurisdiction: string;
  rules: { rule_type: string; in_force: boolean; effective_from: string | null }[];
}

const STATUS: Record<Notice["status"], { label: string; variant: "success" | "secondary" | "warning" }> = {
  in_place: { label: "In place", variant: "success" },
  drafted: { label: "Drafted, awaiting approval", variant: "secondary" },
  action_needed: { label: "Action needed", variant: "warning" },
};

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/** Changes in the law that touch this workspace, and which rule types are in force where. */
export function StatutoryUpdates({ onDrafted }: { onDrafted: () => void }) {
  const notices = useApiQuery<Notice[]>("/statutory-notices");
  const coverage = useApiQuery<CoverageRow[]>("/statutory-notices/coverage");
  const [busy, setBusy] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const draft = async (notice: Notice) => {
    setBusy(notice.id);
    try {
      await post(`/statutory-notices/${notice.id}/draft`);
      toast.success("Drafted. Another admin approves it before payroll uses it.");
      notices.reload();
      onDrafted();
    } catch (caught) {
      toast.error(failure(caught, "The rule set could not be drafted."));
    } finally {
      setBusy(null);
    }
  };

  const columns: ColumnDef<Notice>[] = [
    {
      accessorKey: "title",
      header: "Change",
      meta: {
        text: (notice) =>
          [
            notice.title,
            RULE_TYPE_LABEL[notice.rule_type] ?? notice.rule_type,
            notice.jurisdiction,
            notice.source_reference,
            notice.summary,
          ].join(" · "),
      },
      cell: ({ row }) => (
        <>
          <p className="font-medium">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">
            {RULE_TYPE_LABEL[row.original.rule_type] ?? row.original.rule_type} · {row.original.jurisdiction} ·{" "}
            {row.original.source_reference}
          </p>
          <p className="mt-1 max-w-xl text-sm">{row.original.summary}</p>
        </>
      ),
    },
    {
      accessorKey: "effective_from",
      header: "From",
      meta: { cellClassName: "whitespace-nowrap", text: (notice) => formatDay(notice.effective_from, true) },
      cell: ({ row }) => formatDay(row.original.effective_from, true),
    },
    {
      accessorKey: "status",
      header: "Here",
      meta: { text: (notice) => STATUS[notice.status].label },
      cell: ({ row }) => (
        <Badge variant={STATUS[row.original.status].variant}>{STATUS[row.original.status].label}</Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => {
        const notice = row.original;
        return (
          notice.status === "action_needed" &&
          (notice.has_suggested_rules ? (
            <RequireRole roles={["admin"]}>
              <Button size="sm" disabled={busy === notice.id} onClick={() => void draft(notice)}>
                {busy === notice.id && <Loader2 className="animate-spin" />} Draft rule set
              </Button>
            </RequireRole>
          ) : (
            <span className="text-xs text-muted-foreground">Enter it from the cited source</span>
          ))
        );
      },
    },
  ];

  return (
    <div className="grid gap-6">
      <DataTable
        tier="tier1"
        title="Statutory updates"
        description="Changes to PF, ESI, Professional Tax, LWF and income tax for your locations, published by AskMira's statutory desk."
        columns={columns}
        data={notices.data ?? []}
        noun="notices"
        exportName="statutory-notices"
        searchPlaceholder="Search changes"
        actions={
          <RequireRole roles={["super_admin"]}>
            <Button size="sm" onClick={() => setPublishing(true)}>
              <Plus /> Publish a notice
            </Button>
          </RequireRole>
        }
        isLoading={notices.isLoading && !notices.data}
        error={notices.error?.detail ?? null}
        onRetry={notices.reload}
        empty={{ icon: Bell, title: "No statutory changes published for your locations" }}
      />
      {coverage.data && (
        <Card tier="tier1">
          <CardHeader>
            <CardTitle className="text-base">What is in force today</CardTitle>
            <CardDescription>For the country and each state you have a location in. Whether a state levies PT or LWF at all is for you to confirm.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {coverage.data.map((row) => (
              <div key={row.jurisdiction} className="min-w-48 rounded-md border border-border p-3">
                <p className="mb-2 font-medium">{row.jurisdiction === "IN" ? "National" : row.jurisdiction}</p>
                <ul className="grid gap-1 text-sm">
                  {row.rules.map((rule) => (
                    <li key={rule.rule_type} className="flex items-center justify-between gap-3">
                      <span>{RULE_TYPE_LABEL[rule.rule_type] ?? rule.rule_type}</span>
                      <Badge variant={rule.in_force ? "success" : "muted"}>{rule.in_force ? "In force" : "None"}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {publishing && (
        <PublishDialog
          onClose={() => setPublishing(false)}
          onDone={() => {
            setPublishing(false);
            notices.reload();
          }}
        />
      )}
    </div>
  );
}

function PublishDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [ruleType, setRuleType] = useState("professional_tax");
  const [jurisdiction, setJurisdiction] = useState("");
  const [from, setFrom] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [source, setSource] = useState("");
  const [rules, setRules] = useState("");
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    let suggested: unknown = null;
    if (rules.trim()) {
      try {
        suggested = JSON.parse(rules);
      } catch {
        toast.error("The suggested rules are not valid JSON.");
        return;
      }
    }
    setBusy(true);
    try {
      await post("/statutory-notices", {
        rule_type: ruleType,
        jurisdiction: jurisdiction.trim().toUpperCase(),
        effective_from: from,
        title: title.trim(),
        summary: summary.trim(),
        source_reference: source.trim(),
        suggested_rules: suggested,
      });
      toast.success("Published to every workspace it affects.");
      onDone();
    } catch (caught) {
      toast.error(failure(caught, "The notice could not be published."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Publish a statutory notice</DialogTitle>
          <DialogDescription>Every workspace with a location in the jurisdiction sees it. Suggested rules only after statutory review.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField htmlFor="notice-type" label="Rule type">
            <Select value={ruleType} onValueChange={setRuleType}>
              <SelectTrigger id="notice-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RULE_TYPE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="notice-jurisdiction" label="Jurisdiction" hint="IN, or a state code">
            <Input id="notice-jurisdiction" maxLength={8} className="uppercase" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} />
          </FormField>
          <FormField htmlFor="notice-from" label="Takes effect">
            <Input id="notice-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </FormField>
          <FormField htmlFor="notice-title" label="Title" className="sm:col-span-3">
            <Input id="notice-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField htmlFor="notice-summary" label="What changes" className="sm:col-span-3">
            <Textarea id="notice-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </FormField>
          <FormField htmlFor="notice-source" label="Notification or circular" className="sm:col-span-3">
            <Input id="notice-source" value={source} onChange={(e) => setSource(e.target.value)} />
          </FormField>
          <FormField htmlFor="notice-rules" label="Reviewed rules (JSON)" optional className="sm:col-span-3">
            <Textarea id="notice-rules" rows={4} className="font-mono text-xs" value={rules} onChange={(e) => setRules(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !jurisdiction.trim() || !from || title.trim().length < 5 || summary.trim().length < 10 || source.trim().length < 3} onClick={() => void publish()}>
            {busy && <Loader2 className="animate-spin" />} Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
