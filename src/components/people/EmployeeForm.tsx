"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";

import { FormField } from "@/components/common/FormField";
import { EmployeePicker, type PickedEmployee } from "@/components/people/EmployeePicker";
import {
  EMPLOYMENT_STATUS,
  EMPLOYMENT_TYPE,
  GENDER,
  NONE,
  apiMessage,
  fromSelect,
  personName,
} from "@/components/people/labels";
import { useOrgReference } from "@/components/people/useOrgReference";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { get, patch, post } from "@/lib/api";
import type { EmploymentStatus } from "@/lib/types";
import type { EmployeeInput, EmployeeRecord, EmploymentType, Gender } from "@/lib/types/people";

type Values = {
  employee_code: string;
  first_name: string;
  last_name: string;
  display_name: string;
  work_email: string;
  personal_email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  legal_entity_id: string;
  location_id: string;
  department_id: string;
  designation: string;
  grade: string;
  employment_type: EmploymentType;
  status: EmploymentStatus;
  date_of_joining: string;
  probation_end_date: string;
  date_of_exit: string;
  notice_period_days: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toValues(record?: EmployeeRecord): Values {
  return {
    employee_code: record?.employee_code ?? "",
    first_name: record?.first_name ?? "",
    last_name: record?.last_name ?? "",
    display_name: record?.display_name ?? "",
    work_email: record?.work_email ?? "",
    personal_email: record?.personal_email ?? "",
    phone: record?.phone ?? "",
    date_of_birth: record?.date_of_birth ?? "",
    gender: record?.gender ?? NONE,
    legal_entity_id: record?.legal_entity_id ?? NONE,
    location_id: record?.location_id ?? NONE,
    department_id: record?.department_id ?? NONE,
    designation: record?.designation ?? "",
    grade: record?.grade ?? "",
    employment_type: record?.employment_type ?? "full_time",
    status: record?.status ?? "active",
    date_of_joining: record?.date_of_joining ?? "",
    probation_end_date: record?.probation_end_date ?? "",
    date_of_exit: record?.date_of_exit ?? "",
    notice_period_days:
      record?.notice_period_days !== null && record?.notice_period_days !== undefined
        ? String(record.notice_period_days)
        : "",
  };
}

function toPayload(values: Values, managerId: string | null): EmployeeInput {
  const text = (value: string) => (value.trim() === "" ? null : value.trim());
  return {
    employee_code: values.employee_code.trim(),
    first_name: values.first_name.trim(),
    last_name: text(values.last_name),
    display_name: text(values.display_name),
    work_email: values.work_email.trim(),
    personal_email: text(values.personal_email),
    phone: text(values.phone),
    date_of_birth: text(values.date_of_birth),
    gender: fromSelect(values.gender) as Gender | null,
    legal_entity_id: fromSelect(values.legal_entity_id),
    location_id: fromSelect(values.location_id),
    department_id: fromSelect(values.department_id),
    manager_id: managerId,
    designation: text(values.designation),
    grade: text(values.grade),
    employment_type: values.employment_type,
    status: values.status,
    date_of_joining: text(values.date_of_joining),
    probation_end_date: text(values.probation_end_date),
    date_of_exit: text(values.date_of_exit),
    notice_period_days: values.notice_period_days === "" ? null : Number(values.notice_period_days),
  };
}

function validate(values: Values, isCreate: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (isCreate && !/^[A-Za-z0-9_\-/]+$/.test(values.employee_code.trim())) {
    errors.employee_code = "Letters, digits, - _ and / only.";
  }
  if (!values.first_name.trim()) errors.first_name = "A first name is required.";
  if (!EMAIL.test(values.work_email.trim())) errors.work_email = "Enter a valid work email.";
  if (values.personal_email.trim() && !EMAIL.test(values.personal_email.trim())) {
    errors.personal_email = "Enter a valid email, or leave it blank.";
  }
  if (values.notice_period_days !== "") {
    const days = Number(values.notice_period_days);
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      errors.notice_period_days = "Between 0 and 365 days.";
    }
  }
  if (
    values.date_of_joining &&
    values.probation_end_date &&
    values.probation_end_date < values.date_of_joining
  ) {
    errors.probation_end_date = "Probation cannot end before the joining date.";
  }
  if (values.date_of_joining && values.date_of_exit && values.date_of_exit < values.date_of_joining) {
    errors.date_of_exit = "Exit cannot be before joining.";
  }
  return errors;
}

/**
 * HR's create and edit form for an employee record.
 *
 * On edit only the fields that changed are sent, so the audit trail shows what
 * actually moved. Transfers and promotions belong in Lifecycle events; this
 * form is for corrections and set-up.
 */
export function EmployeeForm({
  record,
  onSaved,
  onCancel,
}: {
  record?: EmployeeRecord;
  onSaved: (saved: EmployeeRecord) => void;
  onCancel?: () => void;
}) {
  const isCreate = !record;
  const org = useOrgReference();
  const [values, setValues] = useState<Values>(() => toValues(record));
  const [manager, setManager] = useState<PickedEmployee | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!record?.manager_id) return;
    get<EmployeeRecord>(`/employees/${record.manager_id}`)
      .then((m) => setManager({ id: m.id, label: `${personName(m)} (${m.employee_code})` }))
      .catch(() => setManager({ id: record.manager_id as string, label: "Current manager" }));
  }, [record?.manager_id]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate(values, isCreate);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) return;

    const payload = toPayload(values, manager?.id ?? null);
    let body: EmployeeInput = payload;
    if (record) {
      const before = toPayload(toValues(record), record.manager_id);
      body = Object.fromEntries(
        Object.entries(payload).filter(
          ([key, value]) => key !== "employee_code" && before[key as keyof EmployeeInput] !== value,
        ),
      ) as EmployeeInput;
      if (Object.keys(body).length === 0) {
        setServerError("Nothing has changed.");
        return;
      }
    } else {
      delete body.date_of_exit;
    }

    setIsSaving(true);
    try {
      const saved = record
        ? await patch<EmployeeRecord>(`/employees/${record.id}`, body)
        : await post<EmployeeRecord>("/employees", body);
      onSaved(saved);
    } catch (error) {
      setServerError(apiMessage(error, "The record could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  const textField = (
    key: keyof Values,
    label: string,
    options: { type?: string; optional?: boolean; hint?: string; disabled?: boolean } = {},
  ) => (
    <FormField
      htmlFor={`emp-${key}`}
      label={label}
      optional={options.optional}
      hint={options.hint}
      error={errors[key]}
    >
      <Input
        id={`emp-${key}`}
        type={options.type ?? "text"}
        value={values[key]}
        disabled={options.disabled}
        aria-invalid={Boolean(errors[key])}
        onChange={(event) => set(key, event.target.value as never)}
      />
    </FormField>
  );

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4">
        <p className="text-sm font-semibold text-foreground">Identity</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {textField("employee_code", "Employee code", {
            disabled: !isCreate,
            hint: isCreate ? undefined : "The code cannot change once issued.",
          })}
          {textField("first_name", "First name")}
          {textField("last_name", "Last name", { optional: true })}
          {textField("display_name", "Display name", { optional: true })}
          {textField("work_email", "Work email", { type: "email" })}
          {textField("personal_email", "Personal email", { type: "email", optional: true })}
          {textField("phone", "Phone", { type: "tel", optional: true })}
          {textField("date_of_birth", "Date of birth", { type: "date", optional: true })}
          <FormField htmlFor="emp-gender" label="Gender" optional>
            <Select value={values.gender} onValueChange={(v) => set("gender", v)}>
              <SelectTrigger id="emp-gender" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not recorded</SelectItem>
                {(Object.keys(GENDER) as Gender[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {GENDER[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </section>

      <Separator />

      <section className="grid gap-4">
        <p className="text-sm font-semibold text-foreground">Placement</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField htmlFor="emp-entity" label="Legal entity" optional>
            <Select value={values.legal_entity_id} onValueChange={(v) => set("legal_entity_id", v)}>
              <SelectTrigger id="emp-entity" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {org.entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            htmlFor="emp-location"
            label="Location"
            optional
            hint="The location's state decides Professional Tax and holidays."
          >
            <Select value={values.location_id} onValueChange={(v) => set("location_id", v)}>
              <SelectTrigger id="emp-location" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {org.locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name} ({l.state_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="emp-department" label="Department" optional>
            <Select value={values.department_id} onValueChange={(v) => set("department_id", v)}>
              <SelectTrigger id="emp-department" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {org.departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="emp-manager" label="Manager" optional>
            <EmployeePicker
              id="emp-manager"
              value={manager}
              onChange={setManager}
              excludeId={record?.id}
              placeholder="No manager"
              allowClear
            />
          </FormField>
          {textField("designation", "Designation", { optional: true })}
          {textField("grade", "Grade", { optional: true })}
        </div>
      </section>

      <Separator />

      <section className="grid gap-4">
        <p className="text-sm font-semibold text-foreground">Employment</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField htmlFor="emp-type" label="Employment type">
            <Select
              value={values.employment_type}
              onValueChange={(v) => set("employment_type", v as EmploymentType)}
            >
              <SelectTrigger id="emp-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EMPLOYMENT_TYPE) as EmploymentType[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {EMPLOYMENT_TYPE[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            htmlFor="emp-status"
            label="Status"
            hint={
              record?.status === "exited"
                ? undefined
                : "Leaving is recorded under People → Exits, which runs clearance and the settlement."
            }
          >
            <Select value={values.status} onValueChange={(v) => set("status", v as EmploymentStatus)}>
              <SelectTrigger id="emp-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EMPLOYMENT_STATUS) as EmploymentStatus[])
                  // "Exited" is set by the exit workflow, never typed here —
                  // unless the record already is exited and is only being shown.
                  .filter((key) => key !== "exited" || record?.status === "exited")
                  .map((key) => (
                  <SelectItem key={key} value={key}>
                    {EMPLOYMENT_STATUS[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {textField("date_of_joining", "Date of joining", { type: "date", optional: true })}
          {textField("probation_end_date", "Probation ends", { type: "date", optional: true })}
          {!isCreate && textField("date_of_exit", "Date of exit", { type: "date", optional: true })}
          {textField("notice_period_days", "Notice period (days)", {
            type: "number",
            optional: true,
          })}
        </div>
      </section>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="accent" disabled={isSaving}>
          {isSaving && <Loader2 className="animate-spin" />}
          {isCreate ? "Create employee" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
