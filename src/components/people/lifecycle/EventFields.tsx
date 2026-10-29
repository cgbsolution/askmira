"use client";

import { useState } from "react";

import { FormField } from "@/components/common/FormField";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EmploymentType, LifecycleEventType } from "@/lib/types/people";

import { EmployeePicker, type PickedEmployee } from "../EmployeePicker";
import { EMPLOYMENT_TYPE, EVENT_FIELDS, FIELD_LABEL, NONE } from "../labels";
import { useOrgReference } from "../useOrgReference";
import { DatePicker } from "@/components/common/DatePicker";

export type FieldValues = Record<string, string>;

/**
 * The inputs an event type is allowed to change — and only those.
 *
 * The API refuses any other field, because an event that can change any field
 * is a field edit with a nicer name. Showing only the permitted inputs means
 * the form cannot be filled in a way the API will reject.
 */
export function EventFields({
  eventType,
  values,
  onChange,
  idPrefix,
}: {
  eventType: LifecycleEventType;
  values: FieldValues;
  onChange: (values: FieldValues) => void;
  idPrefix: string;
}) {
  const org = useOrgReference();
  const [manager, setManager] = useState<PickedEmployee | null>(null);
  const set = (field: string, value: string) => onChange({ ...values, [field]: value });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {EVENT_FIELDS[eventType].map((field) => {
        const id = `${idPrefix}-${field}`;
        const label = `New ${FIELD_LABEL[field]?.toLowerCase() ?? field}`;
        switch (field) {
          case "legal_entity_id":
            return (
              <FormField
                key={field}
                htmlFor={id}
                label={label}
                optional
                hint="Pays them, and files their PF, ESI and TDS, from the month this takes effect in. Date it the 1st of a month for a clean change."
              >
                <Select value={values[field] ?? NONE} onValueChange={(next) => set(field, next)}>
                  <SelectTrigger id={id} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unchanged</SelectItem>
                    {org.entities
                      .filter((row) => row.is_active)
                      .map((row) => (
                        <SelectItem key={row.id} value={row.id}>
                          {row.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </FormField>
            );
          case "department_id":
            return (
              <FormField key={field} htmlFor={id} label={label} optional>
                <Select value={values[field] ?? NONE} onValueChange={(next) => set(field, next)}>
                  <SelectTrigger id={id} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unchanged</SelectItem>
                    {org.departments.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            );
          case "location_id":
            return (
              <FormField key={field} htmlFor={id} label={label} optional>
                <Select value={values[field] ?? NONE} onValueChange={(next) => set(field, next)}>
                  <SelectTrigger id={id} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unchanged</SelectItem>
                    {org.locations.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.name} ({row.state_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            );
          case "manager_id":
            return (
              <FormField key={field} htmlFor={id} label={label} optional>
                <EmployeePicker
                  id={id}
                  value={manager}
                  allowClear
                  onChange={(next) => {
                    setManager(next);
                    set(field, next?.id ?? NONE);
                  }}
                />
              </FormField>
            );
          case "employment_type":
            return (
              <FormField key={field} htmlFor={id} label={label} optional>
                <Select value={values[field] ?? NONE} onValueChange={(next) => set(field, next)}>
                  <SelectTrigger id={id} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unchanged</SelectItem>
                    {(Object.keys(EMPLOYMENT_TYPE) as EmploymentType[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {EMPLOYMENT_TYPE[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            );
          case "probation_end_date":
            return (
              <FormField key={field} htmlFor={id} label={label} optional>
                <DatePicker
                  id={id}
                  value={values[field] ?? ""}
                  onChange={(picked) => set(field, picked)}
                />
              </FormField>
            );
          case "notice_period_days":
            return (
              <FormField key={field} htmlFor={id} label={label} optional>
                <Input
                  id={id}
                  inputMode="numeric"
                  value={values[field] ?? ""}
                  onChange={(event) => set(field, event.target.value.replace(/\D/g, ""))}
                />
              </FormField>
            );
          default:
            return (
              <FormField key={field} htmlFor={id} label={label} optional>
                <Input
                  id={id}
                  value={values[field] ?? ""}
                  onChange={(event) => set(field, event.target.value)}
                />
              </FormField>
            );
        }
      })}
    </div>
  );
}

/** The filled-in fields as the API wants them: unchanged ones omitted, numbers as numbers. */
export function toNewValues(values: FieldValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(values)) {
    if (value === "" || value === NONE) continue;
    out[field] = field === "notice_period_days" ? Number(value) : value.trim();
  }
  return out;
}
