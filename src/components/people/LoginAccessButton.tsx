"use client";

import { KeyRound, UserPlus } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { NewUserDialog } from "@/components/settings/NewUserDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { EmployeeSummary } from "@/lib/types";
import type { ManagedUser } from "@/lib/types/admin";

/**
 * Whether this person can sign in, and a way to give them a login if not.
 *
 * Admins only — logins are managed under Settings → Users & roles, and this
 * is the same action from where HR usually is when a new joiner is set up.
 * Without a login linked to the record the person cannot punch, apply for
 * leave or see a payslip.
 */
export function LoginAccessButton({ employee }: { employee: EmployeeSummary }) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("tenant_admin", "hr_admin");
  const logins = useApiQuery<ManagedUser[]>(isAdmin ? "/admin/users" : null);
  const [creating, setCreating] = useState(false);

  if (!isAdmin || !logins.data) return null;
  const login = logins.data.find((row) => row.employee_id === employee.id);

  if (login) {
    return (
      <Button variant="ghost" asChild>
        <Link href="/settings/users">
          <KeyRound /> Login
          <Badge variant={login.is_active ? "success" : "muted"}>
            {login.is_active ? "Active" : "Disabled"}
          </Badge>
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => setCreating(true)}>
        <UserPlus /> Create login
      </Button>
      <NewUserDialog
        open={creating}
        onOpenChange={setCreating}
        canGrantTenantAdmin={hasRole("tenant_admin")}
        initialEmployee={employee}
        onCreated={logins.reload}
      />
    </>
  );
}
