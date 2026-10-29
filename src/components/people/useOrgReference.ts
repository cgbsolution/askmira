"use client";

import { useMemo } from "react";

import type { ProjectRow } from "@/components/time/TimesheetScreen";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Department, LegalEntity, Location } from "@/lib/types/people";

/**
 * The organisation's reference lists and id → name lookups.
 *
 * Every signed-in person may read these; they are what turns a department id
 * on a record into something a person can read.
 */
export function useOrgReference(version = 0) {
  const departments = useApiQuery<Department[]>(`/org/departments?v=${version}`);
  const locations = useApiQuery<Location[]>(`/org/locations?v=${version}`);
  const entities = useApiQuery<LegalEntity[]>(`/org/legal-entities?v=${version}`);
  // Closed ones too, so a person still on one reads by name (HR gets them all).
  const projects = useApiQuery<ProjectRow[]>(`/timesheets/projects?include_inactive=true&v=${version}`);

  return useMemo(() => {
    const departmentName = new Map((departments.data ?? []).map((d) => [d.id, d.name]));
    const locationName = new Map(
      (locations.data ?? []).map((l) => [l.id, `${l.name} (${l.state_code})`]),
    );
    const entityName = new Map((entities.data ?? []).map((e) => [e.id, e.name]));
    const projectName = new Map((projects.data ?? []).map((p) => [p.id, p.name]));
    return {
      departments: departments.data ?? [],
      locations: locations.data ?? [],
      entities: entities.data ?? [],
      projects: projects.data ?? [],
      isLoading:
        departments.isLoading || locations.isLoading || entities.isLoading || projects.isLoading,
      error: departments.error ?? locations.error ?? entities.error,
      reload: () => {
        departments.reload();
        locations.reload();
        entities.reload();
        projects.reload();
      },
      departmentName: (id: string | null | undefined) => (id ? departmentName.get(id) ?? "—" : "—"),
      locationName: (id: string | null | undefined) => (id ? locationName.get(id) ?? "—" : "—"),
      entityName: (id: string | null | undefined) => (id ? entityName.get(id) ?? "—" : "—"),
      projectName: (id: string | null | undefined) => (id ? projectName.get(id) ?? "—" : "—"),
    };
  }, [departments, locations, entities, projects]);
}
