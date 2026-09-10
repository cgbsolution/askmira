"use client";

import { Mail, Phone, ShieldCheck } from "lucide-react";

import { PageShell } from "@/components/common/PageShell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { formatDate, humanizeRole, initials } from "@/lib/utils";

export default function ProfilePage() {
  const { user, tenant } = useAuth();

  if (!user) return null;

  return (
    <PageShell tier="tier2" title="My profile" description="Your account and workspace details.">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card tier="tier2" className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="text-base">{initials(user.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="font-display text-xl">{user.full_name}</CardTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{humanizeRole(user.role)}</Badge>
                {user.is_email_verified ? (
                  <Badge variant="success">Email verified</Badge>
                ) : (
                  <Badge variant="warning">Email unverified</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2.5 rounded-xl bg-mint-50 px-3 py-2.5 dark:bg-mint-900/20">
              <Mail className="size-4 shrink-0 text-brand-600" />
              <span className="truncate text-sm">{user.email}</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-mint-50 px-3 py-2.5 dark:bg-mint-900/20">
              <Phone className="size-4 shrink-0 text-brand-600" />
              <span className="truncate text-sm">{user.phone ?? "Not provided"}</span>
            </div>
          </CardContent>
        </Card>

        <Card tier="tier1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-brand-600" /> Workspace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <DetailRow label="Name" value={tenant?.name ?? "—"} />
            <DetailRow label="Plan" value={tenant?.plan ?? "—"} />
            <DetailRow label="Data region" value={tenant?.data_region ?? "—"} />
            <DetailRow label="Last sign-in" value={formatDate(user.last_login_at)} />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium capitalize">{value}</span>
    </div>
  );
}
