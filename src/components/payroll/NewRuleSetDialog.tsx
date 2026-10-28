"use client";

import { Copy, Loader2, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { apiMessage, RULE_TYPE_LABEL } from "@/components/payroll/labels";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { get, post } from "@/lib/api";
import type { RuleSet, RuleSetInput, RuleType } from "@/lib/types/payroll";
import { DatePicker } from "@/components/common/DatePicker";

const STATE_TYPES: RuleType[] = ["professional_tax", "labour_welfare_fund"];

/**
 * Enter a new effective-dated version exactly as the SME supplied it. The
 * rules are pasted as JSON; the API checks the keys each engine needs and
 * nothing about the values.
 */
export function NewRuleSetDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [ruleType, setRuleType] = useState<RuleType>("pf");
  const [jurisdiction, setJurisdiction] = useState("IN");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [rulesText, setRulesText] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);

  const isState = STATE_TYPES.includes(ruleType);

  // Most changes are a tweak of the version in force: start from its rules rather
  // than typing the JSON again.
  const copyCurrent = async () => {
    setCopying(true);
    setError(null);
    try {
      const params = new URLSearchParams({ rule_type: ruleType, jurisdiction });
      const rows = await get<RuleSet[]>(`/payroll/rule-sets?${params}`);
      const latest = [...rows].sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
      if (!latest) {
        setError(`There is no ${RULE_TYPE_LABEL[ruleType] ?? ruleType} version for ${jurisdiction} yet to start from.`);
        return;
      }
      setRulesText(JSON.stringify(latest.rules, null, 2));
    } catch (caught) {
      setError(apiMessage(caught, "Could not read the version in force."));
    } finally {
      setCopying(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!effectiveFrom) return setError("Give the date this version applies from.");
    if (!/^[A-Z]{2,8}$/.test(jurisdiction)) {
      return setError("Jurisdiction is IN, or a state code such as KA.");
    }
    if (source.trim().length < 3) {
      return setError("Cite the source — a notification, circular or gazette reference.");
    }
    let rules: unknown;
    try {
      rules = JSON.parse(rulesText);
    } catch {
      return setError("The rules are not valid JSON.");
    }
    if (!rules || typeof rules !== "object" || Array.isArray(rules) || !Object.keys(rules).length) {
      return setError("The rules must be a JSON object with at least one key.");
    }
    setSaving(true);
    setError(null);
    try {
      const body: RuleSetInput = {
        rule_type: ruleType,
        jurisdiction,
        effective_from: effectiveFrom,
        rules: rules as Record<string, unknown>,
        source_reference: source.trim(),
        notes: notes.trim() || null,
      };
      await post<RuleSet>("/payroll/rule-sets", body);
      toast.success("Version entered. It needs another admin's approval before payroll uses it.");
      setOpen(false);
      setRulesText("");
      setSource("");
      setNotes("");
      onCreated();
    } catch (caught) {
      setError(apiMessage(caught, "Could not enter this version."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New version
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Enter a rule set version</DialogTitle>
            <DialogDescription>
              An existing version is never edited. A change is a new version with its own
              effective date.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="rs-type" label="Rule type">
              <Select
                value={ruleType}
                onValueChange={(next) => {
                  const value = next as RuleType;
                  setRuleType(value);
                  if (!STATE_TYPES.includes(value)) setJurisdiction("IN");
                }}
              >
                <SelectTrigger id="rs-type" className="w-full">
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
            <FormField
              htmlFor="rs-jurisdiction"
              label="Jurisdiction"
              hint={isState ? "The state code, e.g. KA" : "IN for national rules"}
            >
              <Input
                id="rs-jurisdiction"
                value={jurisdiction}
                onChange={(event) => setJurisdiction(event.target.value.toUpperCase())}
                maxLength={8}
              />
            </FormField>
          </div>
          <FormField htmlFor="rs-from" label="Effective from">
            <DatePicker
              id="rs-from"
              value={effectiveFrom}
              onChange={setEffectiveFrom}
            />
          </FormField>
          <FormField htmlFor="rs-source" label="Source" hint="Notification, circular or gazette reference.">
            <Input id="rs-source" value={source} onChange={(event) => setSource(event.target.value)} />
          </FormField>
          <FormField htmlFor="rs-rules" label="Rules (JSON)">
            <div>
              <Button type="button" variant="outline" size="sm" disabled={copying} onClick={() => void copyCurrent()}>
                {copying ? <Loader2 className="animate-spin" /> : <Copy />} Start from the current version
              </Button>
            </div>
            <Textarea
              id="rs-rules"
              className="min-h-40 text-xs"
              value={rulesText}
              onChange={(event) => setRulesText(event.target.value)}
              spellCheck={false}
            />
          </FormField>
          <FormField htmlFor="rs-notes" label="Notes" optional>
            <Textarea id="rs-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </FormField>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Enter version
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
