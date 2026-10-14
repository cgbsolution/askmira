"use client";

import React from "react";

import { FormField } from "@/components/common/FormField";
import { DetailItem } from "@/components/people/StatusBadges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { CustomField } from "@/lib/types/people";
import { formatDay } from "@/lib/utils";

/** The workspace's custom fields in profile order (sensitive ones for HR only). */
export function useCustomFields() {
  return useApiQuery<CustomField[]>("/org/custom-fields");
}

function display(field: CustomField, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (field.field_type === "boolean") return value ? "Yes" : "No";
  if (field.field_type === "date") return formatDay(String(value), true);
  if (Array.isArray(value)) return value.length ? value.join(", ") : null;
  return String(value);
}

/** The custom fields on one record, as the viewer may read them. */
export function CustomFieldsCard({ values }: { values: Record<string, unknown> }) {
  const { data } = useCustomFields();
  const fields = data ?? [];
  if (fields.length === 0) return null;
  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle className="text-base">More details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <DetailItem key={field.id} label={field.label}>
            {display(field, values[field.key])}
          </DetailItem>
        ))}
      </CardContent>
    </Card>
  );
}

/** Inputs for every active custom field, for HR's edit of the record. */
export function CustomFieldInputs({
  fields,
  values,
  errors,
  onChange,
}: {
  fields: CustomField[];
  values: Record<string, unknown>;
  errors?: Record<string, string>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => {
        const id = `cf-${field.key}`;
        const value = values[field.key];
        const common = { htmlFor: id, label: field.label, required: field.is_required, error: errors?.[field.key] };
        if (field.field_type === "boolean") {
          return (
            <FormField key={field.id} {...common}>
              <Select
                value={value === true ? "yes" : value === false ? "no" : "unset"}
                onValueChange={(v) => onChange(field.key, v === "yes" ? true : v === "no" ? false : null)}
              >
                <SelectTrigger id={id} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Not set</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          );
        }
        if (field.field_type === "select") {
          return (
            <FormField key={field.id} {...common}>
              <Select
                value={typeof value === "string" && value ? value : "unset"}
                onValueChange={(v) => onChange(field.key, v === "unset" ? null : v)}
              >
                <SelectTrigger id={id} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Not set</SelectItem>
                  {(field.options ?? []).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          );
        }
        if (field.field_type === "multiselect") {
          const chosen = new Set(Array.isArray(value) ? (value as string[]) : []);
          return (
            <fieldset key={field.id} className="grid content-start gap-1.5">
              <legend className="mb-1 text-sm font-medium">
                {field.label}
                {field.is_required && <span className="text-destructive"> *</span>}
              </legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {(field.options ?? []).map((option) => (
                  <div key={option} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`${id}-${option}`}
                      checked={chosen.has(option)}
                      onCheckedChange={(on) => {
                        const next = new Set(chosen);
                        if (on) next.add(option);
                        else next.delete(option);
                        onChange(field.key, [...next]);
                      }}
                    />
                    <Label htmlFor={`${id}-${option}`} className="text-sm font-normal">
                      {option}
                    </Label>
                  </div>
                ))}
              </div>
              {errors?.[field.key] && <p className="text-xs text-destructive">{errors[field.key]}</p>}
            </fieldset>
          );
        }
        return (
          <FormField key={field.id} {...common}>
            <Input
              id={id}
              type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
              maxLength={field.field_type === "text" ? 2000 : undefined}
              value={value === null || value === undefined ? "" : String(value)}
              onChange={(e) => {
                const raw = e.target.value;
                if (field.field_type === "number") onChange(field.key, raw === "" ? null : Number(raw));
                else onChange(field.key, raw === "" ? null : raw);
              }}
            />
          </FormField>
        );
      })}
    </div>
  );
}
