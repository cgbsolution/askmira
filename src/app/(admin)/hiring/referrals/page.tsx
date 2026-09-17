"use client";

import React from "react";

import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import {
  ReferralAllTab,
  ReferralMineTab,
  ReferralOpenRolesTab,
  ReferralProgrammesTab,
} from "@/components/hiring/ReferralTabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { HR } from "@/lib/access";

/**
 * Refer a friend: open roles and the programme's terms for everyone, your own
 * referrals, and — for HR — every referral and the programmes themselves.
 * Each tab loads when it is opened, so switching back shows fresh figures.
 */
export default function ReferralsPage() {
  const { hasRole } = useAuth();
  const isHr = hasRole(...HR);

  return (
    <PageShell
      tier="tier2"
      title="Refer a friend"
      description="Know someone for an open role? Refer them in your name, or share a link that carries it."
    >
      <SectionNav section="hiring" />
      <Tabs defaultValue="open">
        <div className="no-scrollbar overflow-x-auto">
          <TabsList>
            <TabsTrigger value="open">Open roles</TabsTrigger>
            <TabsTrigger value="mine">My referrals</TabsTrigger>
            {isHr && <TabsTrigger value="all">All referrals</TabsTrigger>}
            {isHr && <TabsTrigger value="programmes">Programmes</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent value="open">
          <ReferralOpenRolesTab />
        </TabsContent>
        <TabsContent value="mine">
          <ReferralMineTab />
        </TabsContent>
        {isHr && (
          <TabsContent value="all">
            <ReferralAllTab />
          </TabsContent>
        )}
        {isHr && (
          <TabsContent value="programmes">
            <ReferralProgrammesTab />
          </TabsContent>
        )}
      </Tabs>
    </PageShell>
  );
}
