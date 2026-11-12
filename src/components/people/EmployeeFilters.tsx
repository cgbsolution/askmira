"use client";

import { X } from "lucide-react";
import React, { useMemo, useState } from "react";

import { EMPLOYMENT_STATUS, NONE } from "@/components/people/labels";
import { useOrgReference } from "@/components/people/useOrgReference";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmploymentStatus } from "@/lib/types";

/** The company and project filters' value for people with none. */
export const WITHOUT = "none";
/** The status filter's value for everybody who has not left (any status but exited). */
export const CURRENT_STAFF = "current";

export interface EmployeeFilterValues {
  status: string;
  company: string;
  project: string;
  department: string;
  location: string;
}

const EMPTY: EmployeeFilterValues = {
  status: NONE,
  company: NONE,
  project: NONE,
  department: NONE,
  location: NONE,
};

/**
 * Who a list of employees shows: status, company, project, department and
 * location, as the API's employee lists take them (`/employees`, `/salaries`…).
 * `params` is the query string's part for them; `body` the same as JSON, for
 * an export that posts its filters.
 */
export function useEmployeeFilters(initial: Partial<EmployeeFilterValues> = {}) {
  const [values, setValues] = useState<EmployeeFilterValues>({ ...EMPTY, ...initial });

  return useMemo(() => {
    const params = new URLSearchParams();
    const body: Record<string, string | boolean> = {};
    const put = (key: string, value: string | boolean) => {
      params.set(key, String(value));
      body[key] = value;
    };
    if (values.status === CURRENT_STAFF) put("current", true);
    else if (values.status !== NONE) put("status", values.status);
    if (values.company === WITHOUT) put("without_legal_entity", true);
    else if (values.company !== NONE) put("legal_entity_id", values.company);
    if (values.project === WITHOUT) put("without_project", true);
    else if (values.project !== NONE) put("project_id", values.project);
    if (values.department !== NONE) put("department_id", values.department);
    if (values.location !== NONE) put("location_id", values.location);
    const filtered = Object.keys(body).length > 0;
    return {
      values,
      set: (key: keyof EmployeeFilterValues, value: string) => setValues((previous) => ({ ...previous, [key]: value })),
      reset: () => setValues(EMPTY),
      params,
      body,
      filtered,
    };
  }, [values]);
}

export type EmployeeFilterState = ReturnType<typeof useEmployeeFilters>;

/**
 * The selects for `useEmployeeFilters`, for a list's toolbar. Company and
 * project show only when the workspace has any; "No company" / "No project"
 * find the people missing one.
 */
export function EmployeeFilters({
  state,
  onChange,
  children,
}: {
  state: EmployeeFilterState;
  /** After any change: a server list goes back to page one. */
  onChange?: () => void;
  /** More filters of the screen's own, before "Clear filters". */
  children?: React.ReactNode;
}) {
  const org = useOrgReference();
  const change = (key: keyof EmployeeFilterValues) => (value: string) => {
    state.set(key, value);
    onChange?.();
  };
  const { values } = state;

  return (
    <>
      <Select value={values.status} onValueChange={change("status")}>
        <SelectTrigger aria-label="Status" className="h-9 w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Any status</SelectItem>
          <SelectItem value={CURRENT_STAFF}>Current staff</SelectItem>
          {(Object.keys(EMPLOYMENT_STATUS) as EmploymentStatus[]).map((key) => (
            <SelectItem key={key} value={key}>
              {EMPLOYMENT_STATUS[key].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {org.entities.length > 0 && (
        <Select value={values.company} onValueChange={change("company")}>
          <SelectTrigger aria-label="Company" className="h-9 w-48">
            <SelectValue placeholder="Company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All companies</SelectItem>
            {org.entities.map((entity) => (
              <SelectItem key={entity.id} value={entity.id}>
                {entity.name}
              </SelectItem>
            ))}
            <SelectItem value={WITHOUT}>No company</SelectItem>
          </SelectContent>
        </Select>
      )}
      {org.projects.length > 0 && (
        <Select value={values.project} onValueChange={change("project")}>
          <SelectTrigger aria-label="Project" className="h-9 w-48">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All projects</SelectItem>
            {org.projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
            <SelectItem value={WITHOUT}>No project</SelectItem>
          </SelectContent>
        </Select>
      )}
      {org.departments.length > 0 && (
        <Select value={values.department} onValueChange={change("department")}>
          <SelectTrigger aria-label="Department" className="h-9 w-44">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All departments</SelectItem>
            {org.departments.map((department) => (
              <SelectItem key={department.id} value={department.id}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {org.locations.length > 0 && (
        <Select value={values.location} onValueChange={change("location")}>
          <SelectTrigger aria-label="Location" className="h-9 w-44">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All locations</SelectItem>
            {org.locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {children}
    </>
  );
}

/** "Clear filters", shown while any filter narrows the list. */
export function ClearFiltersButton({ shown, onClear }: { shown: boolean; onClear: () => void }) {
  if (!shown) return null;
  return (
    <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={onClear}>
      <X /> Clear filters
    </Button>
  );
}
