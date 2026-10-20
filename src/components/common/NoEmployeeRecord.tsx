"use client";

import { UserX } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";

/**
 * Whether the signed-in login belongs to an employee record. Self-service pages
 * (my courses, my benefits, my timesheet…) have nothing to show a login without
 * one, such as the platform's own super admin: they say so instead of asking
 * the API and showing its refusal as a failure.
 */
export function useHasEmployeeRecord(): boolean {
  const { user } = useAuth();
  return Boolean(user?.employee_id);
}

/** Said in place of a self-service panel when the login has no employee record. */
export function NoEmployeeRecord({ what }: { what: string }) {
  return (
    <Alert>
      <UserX />
      <AlertTitle>Your login is not linked to an employee record</AlertTitle>
      <AlertDescription>
        {what} belong to an employee record, so there is nothing to show here. If you work at this
        company, ask HR to link your login to your employee record.
      </AlertDescription>
    </Alert>
  );
}
