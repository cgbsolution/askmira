"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Copy, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { pluralCount } from "@/components/onboarding/shared";
import { InlineProblem } from "@/components/payroll-ops/shared";
import { CustomFieldInputs, useCustomFields } from "@/components/people/CustomFields";
import { EmployeePicker, type PickedEmployee } from "@/components/people/EmployeePicker";
import { EMPLOYMENT_TYPE, GENDER, NONE, apiMessage, fromSelect } from "@/components/people/labels";
import { useOrgReference } from "@/components/people/useOrgReference";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type {
  JoinerCreated,
  JoinerCreateInput,
  OnboardingTemplate,
} from "@/lib/types/onboarding";
import type { EmploymentType, Gender } from "@/lib/types/people";
import { formatDay, todayISO } from "@/lib/utils";

const STEPS = [
  { title: "Basic details", description: "Who is joining" },
  { title: "Job details", description: "Role and reporting" },
  { title: "Onboarding", description: "Checklist and login" },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE = /^[A-Za-z0-9_\-/]+$/;

/** Probation lengths offered, in months; "none" for no probation. */
const PROBATION = ["none", "3", "6", "12"] as const;

/** A checklist is suggested for someone joining within this many days, or later. */
const RECENT_JOINER_DAYS = 30;

type Values = {
  employee_code: string;
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  work_email: string;
  personal_email: string;
  phone: string;
  date_of_joining: string;
  employment_type: EmploymentType;
  department_id: string;
  project_id: string;
  designation: string;
  location_id: string;
  legal_entity_id: string;
  probation: (typeof PROBATION)[number];
};

const EMPTY: Values = {
  employee_code: "",
  first_name: "",
  last_name: "",
  gender: NONE,
  date_of_birth: "",
  work_email: "",
  personal_email: "",
  phone: "",
  date_of_joining: "",
  employment_type: "full_time",
  department_id: NONE,
  project_id: NONE,
  designation: "",
  location_id: NONE,
  legal_entity_id: NONE,
  probation: "none",
};

/** The same day `months` later, held to the month's end (31 Jan + 1 month = 28 Feb). */
function addMonths(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  const moved = new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay)));
  return moved.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/**
 * Add a new joiner in three steps — basic details, job details, onboarding —
 * the way HR fills in a joining form. One request creates the record, starts
 * the checklist and gives them a login, so nothing is left half set up.
 */
export function JoinerWizard({
  onCancel,
  onAdded,
  renderDoneActions,
}: {
  onCancel: () => void;
  /** Fired once the joiner exists, before the done screen shows. */
  onAdded?: (created: JoinerCreated) => void;
  /** The way on from the done screen; `addAnother` starts a fresh form. */
  renderDoneActions: (created: JoinerCreated, addAnother: () => void) => React.ReactNode;
}) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const org = useOrgReference();
  const customFields = useCustomFields();
  const definitions = customFields.data ?? [];
  const templates = useApiQuery<OnboardingTemplate[]>("/onboarding/templates");
  const active = useMemo(
    () => (templates.data ?? []).filter((template) => template.active),
    [templates.data],
  );

  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>(EMPTY);
  const [manager, setManager] = useState<PickedEmployee | null>(null);
  const [custom, setCustom] = useState<Record<string, unknown>>({});
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [buddy, setBuddy] = useState<PickedEmployee | null>(null);
  const [createLogin, setCreateLogin] = useState(true);
  const [sendWelcome, setSendWelcome] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [created, setCreated] = useState<JoinerCreated | null>(null);

  // A workspace with one company: every record belongs to it.
  const onlyEntity = org.entities.length === 1 ? org.entities[0].id : null;
  useEffect(() => {
    if (onlyEntity && values.legal_entity_id === NONE) {
      setValues((current) => ({ ...current, legal_entity_id: onlyEntity }));
    }
  }, [onlyEntity, values.legal_entity_id]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const probationEnd =
    values.date_of_joining && values.probation !== "none"
      ? addMonths(values.date_of_joining, Number(values.probation))
      : null;
  const defaultTemplate = active.find((template) => template.is_default) ?? active[0] ?? null;
  // Untouched, the checklist follows the joining date: a recent or future
  // joiner gets the default one, somebody who joined long ago gets none.
  const recentJoiner =
    !values.date_of_joining || daysBetween(values.date_of_joining, todayISO()) <= RECENT_JOINER_DAYS;
  const chosenId = templateId ?? (recentJoiner && defaultTemplate ? defaultTemplate.id : NONE);
  const chosen = active.find((template) => template.id === chosenId) ?? null;
  const fullName = [values.first_name.trim(), values.last_name.trim()].filter(Boolean).join(" ");

  const validate = (index: number): Record<string, string> => {
    const found: Record<string, string> = {};
    if (index === 0) {
      if (!CODE.test(values.employee_code.trim())) {
        found.employee_code = values.employee_code.trim()
          ? "Letters, digits, - _ and / only."
          : "Give them an employee code.";
      }
      if (!values.first_name.trim()) found.first_name = "A first name is required.";
      if (!EMAIL.test(values.work_email.trim())) found.work_email = "Enter a valid work email.";
      if (values.personal_email.trim() && !EMAIL.test(values.personal_email.trim())) {
        found.personal_email = "Enter a valid email, or leave it blank.";
      }
      if (values.date_of_birth && values.date_of_birth >= todayISO()) {
        found.date_of_birth = "A date of birth has to be in the past.";
      }
    }
    if (index === 1) {
      if (!values.date_of_joining) found.date_of_joining = "Choose the day they join.";
      // With several companies, one has to be chosen: no payroll run pays a
      // person who belongs to none.
      if (org.entities.length > 1 && values.legal_entity_id === NONE) {
        found.legal_entity_id = "Choose the company that employs and pays them.";
      }
      for (const field of definitions) {
        const value = custom[field.key];
        const empty =
          value === null ||
          value === undefined ||
          value === "" ||
          (Array.isArray(value) && value.length === 0);
        if (field.is_required && empty) found[field.key] = `${field.label} is required.`;
      }
    }
    return found;
  };

  const next = () => {
    const found = validate(step);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep((current) => current + 1);
  };

  const reset = () => {
    setStep(0);
    setValues({ ...EMPTY, legal_entity_id: onlyEntity ?? NONE });
    setManager(null);
    setCustom({});
    setTemplateId(null);
    setBuddy(null);
    setCreateLogin(true);
    setSendWelcome(true);
    setErrors({});
    setServerError(null);
    setCreated(null);
  };

  const submit = async () => {
    // The stepper can be clicked ahead, so every earlier step is checked again
    // here; the first one with a problem is shown.
    for (const index of [0, 1]) {
      const found = validate(index);
      if (Object.keys(found).length > 0) {
        setErrors(found);
        setStep(index);
        return;
      }
    }
    const text = (value: string) => (value.trim() === "" ? null : value.trim());
    const filled = Object.fromEntries(
      Object.entries(custom).filter(
        ([, value]) =>
          value !== null &&
          value !== undefined &&
          value !== "" &&
          !(Array.isArray(value) && value.length === 0),
      ),
    );
    const input: JoinerCreateInput = {
      employee: {
        employee_code: values.employee_code.trim(),
        first_name: values.first_name.trim(),
        last_name: text(values.last_name),
        work_email: values.work_email.trim(),
        personal_email: text(values.personal_email),
        phone: text(values.phone),
        date_of_birth: text(values.date_of_birth),
        gender: fromSelect(values.gender) as Gender | null,
        legal_entity_id: fromSelect(values.legal_entity_id),
        location_id: fromSelect(values.location_id),
        department_id: fromSelect(values.department_id),
        project_id: fromSelect(values.project_id),
        manager_id: manager?.id ?? null,
        designation: text(values.designation),
        employment_type: values.employment_type,
        date_of_joining: values.date_of_joining,
        probation_end_date: probationEnd,
        custom_fields: filled,
      },
      template_id: chosen?.id ?? null,
      buddy_employee_id: chosen ? (buddy?.id ?? null) : null,
      create_login: isAdmin && createLogin,
      send_welcome_email: sendWelcome,
    };
    setIsSaving(true);
    setServerError(null);
    try {
      const result = await post<JoinerCreated>("/onboarding/joiners", input);
      setCreated(result);
      onAdded?.(result);
    } catch (caught) {
      const message = apiMessage(caught, "The joiner could not be added.");
      // Send them back to the field the server refused, where it can be fixed.
      if (/employee code/i.test(message)) {
        setErrors({ employee_code: message });
        setStep(0);
      } else if (/email/i.test(message)) {
        setErrors({ work_email: message });
        setStep(0);
      } else {
        setServerError(message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (created) {
    return <JoinerDone created={created} actions={renderDoneActions(created, reset)} />;
  }

  const textField = (
    key: keyof Values,
    label: string,
    options: { type?: string; optional?: boolean; hint?: string; placeholder?: string } = {},
  ) => (
    <FormField
      htmlFor={`joiner-${key}`}
      label={label}
      optional={options.optional}
      required={!options.optional}
      hint={options.hint}
      error={errors[key]}
    >
      <Input
        id={`joiner-${key}`}
        type={options.type ?? "text"}
        value={values[key]}
        placeholder={options.placeholder}
        aria-invalid={Boolean(errors[key])}
        onChange={(event) => set(key, event.target.value as never)}
      />
    </FormField>
  );

  return (
    <div className="grid gap-6">
      <Stepper steps={STEPS} current={step} onStepClick={(index) => setStep(index)} />

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {textField("employee_code", "Employee code", {
            hint: "Letters, digits, - _ and /. It cannot change later.",
            placeholder: "e.g. EMP0042",
          })}
          {textField("first_name", "First name")}
          {textField("last_name", "Last name", { optional: true })}
          <FormField htmlFor="joiner-gender" label="Gender" optional>
            <Select value={values.gender} onValueChange={(v) => set("gender", v)}>
              <SelectTrigger id="joiner-gender" className="w-full">
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
          <FormField
            htmlFor="joiner-dob"
            label="Date of birth"
            optional
            error={errors.date_of_birth}
          >
            <DatePicker
              id="joiner-dob"
              value={values.date_of_birth}
              onChange={(v) => set("date_of_birth", v)}
              max={todayISO()}
              invalid={Boolean(errors.date_of_birth)}
            />
          </FormField>
          {textField("phone", "Mobile number", { type: "tel", optional: true })}
          {textField("work_email", "Work email", {
            type: "email",
            hint: isAdmin ? "Their login is sent here." : undefined,
          })}
          {textField("personal_email", "Personal email", { type: "email", optional: true })}
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              htmlFor="joiner-doj"
              label="Date of joining"
              required
              hint="Checklist tasks are dated from this day."
              error={errors.date_of_joining}
            >
              <DatePicker
                id="joiner-doj"
                value={values.date_of_joining}
                onChange={(v) => set("date_of_joining", v)}
                invalid={Boolean(errors.date_of_joining)}
              />
            </FormField>
            <FormField htmlFor="joiner-type" label="Employment type">
              <Select
                value={values.employment_type}
                onValueChange={(v) => set("employment_type", v as EmploymentType)}
              >
                <SelectTrigger id="joiner-type" className="w-full">
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
            {textField("designation", "Designation", { optional: true })}
            <FormField
              htmlFor="joiner-project"
              label="Project"
              optional
              hint="A client's project, or Internal. Payroll follows the company, not this."
            >
              <Select value={values.project_id} onValueChange={(v) => set("project_id", v)}>
                <SelectTrigger id="joiner-project" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {org.projects
                    .filter((p) => p.active || p.id === values.project_id)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.billable || /internal/i.test(p.name) ? "" : " (Internal)"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="joiner-department" label="Department" optional>
              <Select value={values.department_id} onValueChange={(v) => set("department_id", v)}>
                <SelectTrigger id="joiner-department" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {org.departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="joiner-manager" label="Reporting manager" optional>
              <EmployeePicker
                id="joiner-manager"
                value={manager}
                onChange={setManager}
                placeholder="Choose their manager"
                allowClear
              />
            </FormField>
            <FormField
              htmlFor="joiner-location"
              label="Work location"
              optional
              hint="Its state decides Professional Tax and holidays."
            >
              <Select value={values.location_id} onValueChange={(v) => set("location_id", v)}>
                <SelectTrigger id="joiner-location" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {org.locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} ({location.state_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {org.entities.length > 1 && (
              <FormField
                htmlFor="joiner-entity"
                label="Company"
                required
                error={errors.legal_entity_id}
                hint="Its payroll run pays them, and they see its logo after signing in."
              >
                <Select
                  value={values.legal_entity_id === NONE ? "" : values.legal_entity_id}
                  onValueChange={(v) => set("legal_entity_id", v)}
                >
                  <SelectTrigger
                    id="joiner-entity"
                    className="w-full"
                    aria-invalid={Boolean(errors.legal_entity_id)}
                  >
                    <SelectValue placeholder="Choose a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {org.entities.filter((entity) => entity.is_active).map((entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            <FormField
              htmlFor="joiner-probation"
              label="Probation"
              hint={probationEnd ? `Ends ${formatDay(probationEnd, true)}.` : undefined}
            >
              <Select
                value={values.probation}
                onValueChange={(v) => set("probation", v as Values["probation"])}
              >
                <SelectTrigger id="joiner-probation" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No probation</SelectItem>
                  <SelectItem value="3">3 months</SelectItem>
                  <SelectItem value="6">6 months</SelectItem>
                  <SelectItem value="12">12 months</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          {definitions.length > 0 && (
            <div className="grid gap-3 border-t pt-4">
              <p className="text-sm font-semibold">More details</p>
              <CustomFieldInputs
                fields={definitions}
                values={custom}
                errors={errors}
                onChange={(key, value) => setCustom((current) => ({ ...current, [key]: value }))}
              />
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              htmlFor="joiner-checklist"
              label="Onboarding checklist"
              hint={
                chosen
                  ? `${pluralCount(chosen.task_count, "task")}, dated from ${formatDay(values.date_of_joining, true)}. The joiner, manager, buddy and task owners are each told what is theirs.`
                  : recentJoiner
                    ? "No checklist: the record is added, nothing else starts."
                    : "They joined a while ago, so no checklist is suggested."
              }
            >
              <Select
                value={chosenId}
                disabled={templates.isLoading}
                onValueChange={(v) => {
                  setTemplateId(v);
                  if (v === NONE) setBuddy(null);
                }}
              >
                <SelectTrigger id="joiner-checklist" className="w-full">
                  <SelectValue placeholder={templates.isLoading ? "Loading checklists…" : undefined} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Don&apos;t start a checklist</SelectItem>
                  {active.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.is_default ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {chosen && (
              <FormField
                htmlFor="joiner-buddy"
                label="Buddy"
                optional
                hint="A colleague who shows them around."
              >
                <EmployeePicker
                  id="joiner-buddy"
                  value={buddy}
                  onChange={setBuddy}
                  placeholder="Choose a buddy"
                  allowClear
                />
              </FormField>
            )}
          </div>

          {templates.data !== null && active.length === 0 && (
            <p className="text-sm text-muted-foreground">
              There is no onboarding checklist yet.{" "}
              <Link href="/onboarding/templates" className="font-medium text-primary underline">
                Create one under Checklists
              </Link>{" "}
              to give joiners a dated list of tasks.
            </p>
          )}

          {isAdmin ? (
            <div className="grid gap-3 rounded-xl border p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="joiner-login"
                  checked={createLogin}
                  onCheckedChange={(on) => setCreateLogin(on === true)}
                  className="mt-0.5"
                />
                <div className="grid gap-1">
                  <Label htmlFor="joiner-login" className="font-medium">
                    Give them a login
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    As an employee, at {values.work_email.trim() || "their work email"}. Without
                    one they cannot see their tasks, punch in or apply for leave.
                  </p>
                </div>
              </div>
              {createLogin && (
                <div className="ml-7 flex items-start gap-3">
                  <Checkbox
                    id="joiner-welcome"
                    checked={sendWelcome}
                    onCheckedChange={(on) => setSendWelcome(on === true)}
                    className="mt-0.5"
                  />
                  <div className="grid gap-1">
                    <Label htmlFor="joiner-welcome" className="font-medium">
                      Email them their sign-in details now
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Where to sign in, a link to set their password, and their checklist.
                      Untick if that mailbox is not live yet.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              An admin gives them a login from their profile once they are added.
            </p>
          )}

          <div className="grid gap-1 rounded-xl bg-muted/60 p-4 text-sm">
            <p className="font-semibold">
              {fullName} · {values.employee_code.trim()}
            </p>
            <p className="text-muted-foreground">
              {[
                values.designation.trim() || null,
                org.departmentName(fromSelect(values.department_id)) !== "—"
                  ? org.departmentName(fromSelect(values.department_id))
                  : null,
                values.date_of_joining ? `joins ${formatDay(values.date_of_joining, true)}` : null,
                manager ? `reports to ${manager.label}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          {serverError && <InlineProblem>{serverError}</InlineProblem>}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={isSaving}
          onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}
        >
          {step === 0 ? (
            "Cancel"
          ) : (
            <>
              <ArrowLeft /> Back
            </>
          )}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Next <ArrowRight />
          </Button>
        ) : (
          <Button type="button" variant="accent" disabled={isSaving} onClick={() => void submit()}>
            {isSaving ? <Loader2 className="animate-spin" /> : <UserPlus />}
            Add joiner
          </Button>
        )}
      </div>
    </div>
  );
}

/** What was done, said plainly — and the one-time password when no email went. */
function JoinerDone({ created, actions }: { created: JoinerCreated; actions: React.ReactNode }) {
  const login = created.login;
  const emailed = login?.welcome_email?.status === "sent" || login?.welcome_email?.status === "queued";

  const copyPassword = async () => {
    if (!login) return;
    try {
      await navigator.clipboard.writeText(login.temporary_password);
      toast.success("Copied. Send it over a channel they already trust.");
    } catch {
      toast.error("Could not copy. Select the password and copy it by hand.");
    }
  };

  return (
    <div className="grid gap-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" />
        <div className="grid gap-1">
          <p className="text-base font-semibold">
            {created.employee_name} is added ({created.employee_code})
          </p>
          <ul className="grid gap-0.5 text-sm text-muted-foreground">
            <li>
              {created.status === "pre_joining"
                ? "Pre-joining until their joining date, then active."
                : "Active from today."}
            </li>
            <li>
              {created.checklist_name
                ? `Onboarding started on “${created.checklist_name}”.`
                : "No checklist was started."}
            </li>
            <li>
              {login
                ? emailed
                  ? `Login created; sign-in details emailed to ${login.welcome_email?.sent_to}.`
                  : "Login created. Give them the one-time password below."
                : "No login yet."}
            </li>
          </ul>
        </div>
      </div>

      {login && !emailed && (
        <Alert>
          <AlertTitle>One-time password</AlertTitle>
          <AlertDescription className="grid gap-2">
            <code className="w-fit rounded-md bg-muted px-2 py-1 font-mono text-sm text-foreground">
              {login.temporary_password}
            </code>
            <span>
              Shown once: only its hash is stored. They set their own password when they first
              sign in.
            </span>
            <Button variant="outline" size="sm" className="w-fit" onClick={() => void copyPassword()}>
              <Copy /> Copy password
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        {actions}
      </div>
    </div>
  );
}
