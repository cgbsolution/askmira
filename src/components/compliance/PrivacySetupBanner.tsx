"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";

/**
 * Shown to a workspace's admins on every page until they name the person
 * employees write to about their data (DPDP s.8(9), 8(10)). Every privacy
 * notice prints that contact; without it the notice can only say none is named.
 */
export function PrivacySetupBanner() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const { data } = useApiQuery<{ configured: boolean }>(isAdmin ? "/dpdp/status" : null);
  if (!isAdmin || !data || data.configured) return null;

  return (
    <Alert variant="warning" className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <ShieldAlert />
      <div className="min-w-0 flex-1">
        <AlertTitle>Name your privacy contact</AlertTitle>
        <AlertDescription>
          Employees&apos; privacy notice has no one to write to until you add a grievance contact. Their requests are
          still accepted meanwhile.
        </AlertDescription>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href="/compliance?tab=config">Add contact</Link>
      </Button>
    </Alert>
  );
}
