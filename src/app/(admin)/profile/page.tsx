"use client";

import { UserX } from "lucide-react";
import React from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageShell } from "@/components/common/PageShell";
import { AccountSecurityTab } from "@/components/people/profile/AccountSecurityTab";
import { ProfileView } from "@/components/people/ProfileView";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

/**
 * My profile: your own full employee record, the same sections HR sees (with
 * identifiers masked), and your login. A login with no employee record — a
 * consultant, a platform admin — gets the login and an honest note, not an
 * empty profile.
 */
export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  if (!user.employee_id) {
    return (
      <PageShell title="My profile" description="Your login and how you sign in.">
        <Card tier="tier1">
          <EmptyState
            icon={UserX}
            title="Your login is not linked to an employee record"
            description="Personal details, documents and pay belong to an employee record. If you work here, ask HR to link your login to your record."
          />
        </Card>
        <AccountSecurityTab />
      </PageShell>
    );
  }

  return (
    <ProfileView
      recordPath="/employees/me"
      title="My profile"
      extraTabs={[{ value: "account", label: "Account & security", content: <AccountSecurityTab /> }]}
    />
  );
}
