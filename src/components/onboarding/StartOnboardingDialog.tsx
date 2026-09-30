"use client";

import { Loader2, Rocket } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { EmployeePicker, employeeDisplayName } from "@/components/common/EmployeePicker";
import { FormField } from "@/components/common/FormField";
import { pluralCount, useOnboardingRoles } from "@/components/onboarding/shared";
import { apiErrorMessage, InlineProblem } from "@/components/payroll-ops/shared";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type {
  OnboardingPlanDetail,
  OnboardingTemplate,
  PlanCreateInput,
} from "@/lib/types/onboarding";

/**
 * Start onboarding for one person: pick the checklist and a buddy. Due dates
 * come from the joining date, and every assignee is told by the server.
 */
export function StartOnboardingDialog({
  onStarted,
}: {
  onStarted: (plan: OnboardingPlanDetail) => void;
}) {
  const { ownEmployeeId } = useOnboardingRoles();
  const [open, setOpen] = useState(false);
  const templates = useApiQuery<OnboardingTemplate[]>(open ? "/onboarding/templates" : null);
  const active = (templates.data ?? []).filter((template) => template.active);

  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [buddy, setBuddy] = useState<EmployeeSummary | null>(null);
  const [joiningDate, setJoiningDate] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The default checklist is the sensible first choice.
  useEffect(() => {
    if (templateId || active.length === 0) return;
    setTemplateId((active.find((template) => template.is_default) ?? active[0]).id);
  }, [active, templateId]);

  const chosen = active.find((template) => template.id === templateId) ?? null;
  const buddyIsJoiner = Boolean(employee && buddy && employee.id === buddy.id);
  const isValid = Boolean(employee) && Boolean(chosen) && !buddyIsJoiner;

  const reset = () => {
    setEmployee(null);
    setTemplateId("");
    setBuddy(null);
    setJoiningDate("");
    setTouched(false);
    setError(null);
  };

  const submit = async () => {
    setTouched(true);
    if (!isValid || !employee || !chosen) return;
    const input: PlanCreateInput = {
      employee_id: employee.id,
      template_id: chosen.id,
      buddy_employee_id: buddy?.id ?? null,
      joining_date: joiningDate || null,
    };
    setIsSubmitting(true);
    setError(null);
    try {
      const plan = await post<OnboardingPlanDetail>("/onboarding/plans", input);
      toast.success(`Onboarding started for ${plan.employee_name}`);
      setOpen(false);
      reset();
      onStarted(plan);
    } catch (caught) {
      setError(apiErrorMessage(caught, "Onboarding could not be started."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="accent">
          <Rocket /> Start onboarding
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start onboarding</DialogTitle>
          <DialogDescription>
            The checklist is copied onto this person with due dates from their joining date.
            The new joiner, their manager, buddy and task owners are each told what is theirs.
          </DialogDescription>
        </DialogHeader>

        {templates.data !== null && active.length === 0 ? (
          <InlineProblem>
            There is no active onboarding checklist yet.{" "}
            <Link href="/onboarding/templates" className="font-medium underline">
              Create one under Checklists
            </Link>{" "}
            first.
          </InlineProblem>
        ) : (
          <div className="grid gap-4">
            <FormField
              htmlFor="onboarding-employee"
              label="New joiner"
              error={touched && !employee ? "Choose who is joining." : null}
            >
              <EmployeePicker
                id="onboarding-employee"
                value={employee}
                onChange={setEmployee}
                excludeId={ownEmployeeId}
                invalid={touched && !employee}
                disabled={isSubmitting}
              />
            </FormField>

            <FormField
              htmlFor="onboarding-template"
              label="Checklist"
              hint={
                chosen
                  ? `${pluralCount(chosen.task_count, "task")}${chosen.department_name ? ` · for ${chosen.department_name}` : ""}${chosen.location_name ? ` · at ${chosen.location_name}` : ""}`
                  : undefined
              }
              error={touched && !chosen ? "Choose a checklist." : null}
            >
              <Select
                value={templateId}
                disabled={isSubmitting || templates.isLoading}
                onValueChange={setTemplateId}
              >
                <SelectTrigger id="onboarding-template" className="w-full">
                  <SelectValue
                    placeholder={templates.isLoading ? "Loading checklists…" : "Choose a checklist"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {active.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.is_default ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              htmlFor="onboarding-buddy"
              label="Buddy"
              optional
              hint="A colleague who shows them around. Without one, buddy tasks wait for HR to assign."
              error={buddyIsJoiner ? "The new joiner cannot be their own buddy." : null}
            >
              <EmployeePicker
                id="onboarding-buddy"
                value={buddy}
                onChange={setBuddy}
                excludeId={employee?.id ?? null}
                invalid={buddyIsJoiner}
                disabled={isSubmitting}
              />
            </FormField>

            <FormField
              htmlFor="onboarding-joining"
              label="Joining date"
              optional
              hint={
                employee
                  ? `Leave blank to use ${employeeDisplayName(employee)}'s date of joining on record.`
                  : "Leave blank to use the employee's date of joining on record."
              }
            >
              <DatePicker
                id="onboarding-joining"
                value={joiningDate}
                onChange={setJoiningDate}
                disabled={isSubmitting}
                placeholder="From the employee record"
              />
            </FormField>

            {error && <InlineProblem>{error}</InlineProblem>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={isSubmitting || active.length === 0} onClick={() => void submit()}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Start onboarding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
