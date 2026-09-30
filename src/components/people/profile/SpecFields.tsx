"use client";

import React from "react";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { NONE } from "@/components/people/labels";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { INDIAN_STATES } from "@/lib/states";
import { cn } from "@/lib/utils";

export type FieldKind = "text" | "select" | "date" | "number" | "switch" | "state" | "textarea";

/** One field of a profile section form. The backend schema is the authority; this drives the UI. */
export interface FieldSpec {
  key: string;
  label: string;
  kind?: FieldKind;
  options?: Record<string, string>;
  optional?: boolean;
  hint?: string;
  wide?: boolean;
  maxLength?: number;
  /** A client-side shape check, so an obvious typo is caught before the round trip. */
  pattern?: RegExp;
  patternMessage?: string;
}

export type FieldValues = Record<string, string | boolean>;

export function blankValues(specs: FieldSpec[]): FieldValues {
  return Object.fromEntries(
    specs.map((spec) => [spec.key, spec.kind === "switch" ? false : spec.kind === "select" ? NONE : ""]),
  );
}

/** A stored record as form values. */
export function toFieldValues(specs: FieldSpec[], record: Record<string, unknown> | null | undefined): FieldValues {
  const values = blankValues(specs);
  if (!record) return values;
  for (const spec of specs) {
    const value = record[spec.key];
    if (value === null || value === undefined) continue;
    if (spec.kind === "switch") values[spec.key] = Boolean(value);
    else values[spec.key] = String(value);
  }
  return values;
}

/** Form values as the API payload: blanks become null, numbers become numbers. */
export function toPayload(specs: FieldSpec[], values: FieldValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const spec of specs) {
    const value = values[spec.key];
    if (spec.kind === "switch") {
      out[spec.key] = Boolean(value);
      continue;
    }
    const text = typeof value === "string" ? value.trim() : "";
    if (spec.kind === "select" && (text === NONE || text === "")) {
      out[spec.key] = null;
    } else if (text === "") {
      out[spec.key] = null;
    } else if (spec.kind === "number") {
      out[spec.key] = Number(text);
    } else {
      out[spec.key] = text;
    }
  }
  return out;
}

export function fieldErrors(specs: FieldSpec[], values: FieldValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const spec of specs) {
    if (spec.kind === "switch") continue;
    const text = typeof values[spec.key] === "string" ? (values[spec.key] as string).trim() : "";
    const empty = text === "" || text === NONE;
    if (empty) {
      if (!spec.optional) errors[spec.key] = `${spec.label} is required.`;
      continue;
    }
    if (spec.kind === "number" && Number.isNaN(Number(text))) {
      errors[spec.key] = "Enter a number.";
    } else if (spec.pattern && !spec.pattern.test(text.toUpperCase().replace(/\s/g, ""))) {
      errors[spec.key] = spec.patternMessage ?? `Check the ${spec.label.toLowerCase()}.`;
    }
  }
  return errors;
}

/** A grid of labelled controls for one record. */
export function SpecFields({
  idPrefix,
  specs,
  values,
  onChange,
  errors = {},
  hints = {},
  disabled = false,
}: {
  idPrefix: string;
  specs: FieldSpec[];
  values: FieldValues;
  onChange: (next: FieldValues) => void;
  errors?: Record<string, string>;
  /** Per-field hints that depend on the record (e.g. the value on file now). */
  hints?: Record<string, string | undefined>;
  disabled?: boolean;
}) {
  const set = (key: string, value: string | boolean) => onChange({ ...values, [key]: value });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {specs.map((spec) => {
        const id = `${idPrefix}-${spec.key}`;
        const value = values[spec.key];
        const text = typeof value === "string" ? value : "";
        const invalid = Boolean(errors[spec.key]);
        let control: React.ReactNode;
        switch (spec.kind) {
          case "switch":
            control = (
              <div className="flex h-11 items-center">
                <Switch
                  id={id}
                  checked={Boolean(value)}
                  disabled={disabled}
                  onCheckedChange={(checked) => set(spec.key, checked)}
                />
              </div>
            );
            break;
          case "select":
            control = (
              <Select value={text || NONE} onValueChange={(next) => set(spec.key, next)} disabled={disabled}>
                <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{spec.optional ? "Not recorded" : "Choose…"}</SelectItem>
                  {Object.entries(spec.options ?? {}).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
            break;
          case "state":
            control = (
              <Select value={text || NONE} onValueChange={(next) => set(spec.key, next)} disabled={disabled}>
                <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
                  <SelectValue placeholder="Choose a state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Choose a state</SelectItem>
                  {INDIAN_STATES.map((state) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
            break;
          case "date":
            control = (
              <DatePicker
                id={id}
                value={text || null}
                onChange={(next) => set(spec.key, next)}
                invalid={invalid}
                disabled={disabled}
              />
            );
            break;
          case "textarea":
            control = (
              <Textarea
                id={id}
                value={text}
                maxLength={spec.maxLength}
                disabled={disabled}
                aria-invalid={invalid}
                onChange={(event) => set(spec.key, event.target.value)}
              />
            );
            break;
          default:
            control = (
              <Input
                id={id}
                type={spec.kind === "number" ? "number" : "text"}
                value={text}
                maxLength={spec.maxLength}
                disabled={disabled}
                aria-invalid={invalid}
                onChange={(event) => set(spec.key, event.target.value)}
              />
            );
        }
        return (
          <FormField
            key={spec.key}
            htmlFor={id}
            label={spec.label}
            optional={spec.optional && spec.kind !== "switch"}
            hint={hints[spec.key] ?? spec.hint}
            error={errors[spec.key]}
            className={cn(spec.wide && "sm:col-span-2")}
          >
            {control}
          </FormField>
        );
      })}
    </div>
  );
}
