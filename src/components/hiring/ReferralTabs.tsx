"use client";

import { Briefcase, Gift, HandHeart, Users } from "lucide-react";
import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Money } from "@/components/common/Money";
import { RequireRole } from "@/components/common/RequireRole";
import { REFERRAL_STATUS, StatusBadge } from "@/components/hiring/labels";
import { ReferralFormDialog } from "@/components/hiring/ReferralFormDialog";
import { ReferralHireDialog, ReferralPayDialog } from "@/components/hiring/ReferralHrActions";
import { ReferralPayouts } from "@/components/hiring/ReferralPayouts";
import { ReferralProgrammeDialog } from "@/components/hiring/ReferralProgrammeDialog";
import { ReferralProgrammeTerms } from "@/components/hiring/ReferralProgrammeTerms";
import { ReferralShareDialog } from "@/components/hiring/ReferralShareDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ADMIN } from "@/lib/access";
import type {
  MyReferral,
  OpenRole,
  ReferralProgramme,
  ReferralRow,
} from "@/lib/types/hiring";
import { formatDay, formatDate } from "@/lib/utils";

function experience(role: OpenRole): string | null {
  const { experience_min_years: min, experience_max_years: max } = role;
  if (min === null && max === null) return null;
  if (min !== null && max !== null) return `${min}–${max} yrs`;
  return min !== null ? `${min}+ yrs` : `up to ${max} yrs`;
}

/**
 * Open roles anyone can refer into, with the running programme's terms above
 * them. Without a running programme there is nothing to refer under, and the
 * tab says so rather than offering a button that would be refused.
 */
export function ReferralOpenRolesTab({ onReferred }: { onReferred?: () => void }) {
  const roles = useApiQuery<OpenRole[]>("/recruiting/open-roles");
  const programmes = useApiQuery<ReferralProgramme[]>("/recruiting/referral-programmes");
  const active = (programmes.data ?? []).filter((programme) => programme.is_active);

  if (programmes.isLoading && !programmes.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (programmes.error) {
    return (
      <Card tier="tier2">
        <ErrorState message={programmes.error.detail} onRetry={programmes.reload} />
      </Card>
    );
  }
  if (active.length === 0) {
    return (
      <Card tier="tier2">
        <EmptyState
          tier="tier2"
          icon={Gift}
          title="No referral programme is running"
          description="Referrals are made under a programme that sets the bonus and the rules. HR has not started one, so there is nothing to refer under yet."
        />
      </Card>
    );
  }

  const list = roles.data ?? [];
  return (
    <div className="grid gap-4">
      {active.map((programme) => (
        <ReferralProgrammeTerms key={programme.id} programme={programme} />
      ))}
      <DataPanel
        tier="tier2"
        title="Open roles"
        description="Refer someone you know, or share a link that carries your name."
        isLoading={roles.isLoading && !roles.data}
        error={roles.error?.detail}
        onRetry={roles.reload}
        isEmpty={list.length === 0}
        empty={{
          icon: Briefcase,
          title: "No open roles right now",
          description: "Roles appear here once a requisition is approved and opened.",
        }}
      >
        <ul className="divide-y divide-border">
          {list.map((role) => {
            const exp = experience(role);
            return (
              <li
                key={role.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{role.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      role.code,
                      role.department,
                      role.location,
                      exp,
                      `${role.open_vacancies} open`,
                      `posted ${formatDay(role.posted_on, true)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <ReferralShareDialog role={role} programmes={active} />
                  <ReferralFormDialog role={role} programmes={active} onReferred={() => onReferred?.()} />
                </div>
              </li>
            );
          })}
        </ul>
      </DataPanel>
    </div>
  );
}

/** The viewer's own referrals: where each stands, and any bonus and its payouts. */
export function ReferralMineTab() {
  const { data, error, isLoading, reload } = useApiQuery<MyReferral[]>("/recruiting/my-referrals");
  const rows = data ?? [];
  return (
    <DataPanel
      title="My referrals"
      isLoading={isLoading && !data}
      error={error?.detail}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{
        icon: HandHeart,
        title: "You have not referred anyone yet",
        description: "Referrals you make from the Open roles tab appear here with their progress.",
      }}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Bonus</TableHead>
              <TableHead>Payouts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="align-top">
                <TableCell className="font-medium text-foreground">{row.candidate}</TableCell>
                <TableCell>
                  <p>{row.requisition_title ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{row.requisition_code ?? ""}</p>
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal">
                  <StatusBadge map={REFERRAL_STATUS} value={row.status} />
                  {row.duplicate_note && (
                    <p className="mt-1 text-xs text-muted-foreground">{row.duplicate_note}</p>
                  )}
                  {row.ineligibility_reason && (
                    <p className="mt-1 text-xs text-destructive">{row.ineligibility_reason}</p>
                  )}
                  {row.hired_on && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Joined {formatDay(row.hired_on, true)}
                    </p>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{formatDate(row.submitted_at)}</TableCell>
                <TableCell className="text-right">
                  <Money value={row.bonus_amount} />
                </TableCell>
                <TableCell className="whitespace-normal">
                  <ReferralPayouts payouts={row.payouts} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DataPanel>
  );
}

const HIREABLE = new Set<ReferralRow["status"]>(["submitted", "in_process"]);

/** Every referral in the workspace (HR): mark hires and record payouts. */
export function ReferralAllTab() {
  const { data, error, isLoading, reload } = useApiQuery<ReferralRow[]>("/recruiting/referrals");
  const rows = data ?? [];
  return (
    <DataPanel
      title="All referrals"
      description="Payouts are not picked up by payroll automatically. Mark one paid only after it has gone out in a run."
      isLoading={isLoading && !data}
      error={error?.detail}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{
        icon: Users,
        title: "No referrals yet",
        description: "Referrals made by employees appear here.",
      }}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate</TableHead>
              <TableHead>Referred by</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Bonus</TableHead>
              <TableHead>Payouts</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="align-top">
                <TableCell className="font-medium text-foreground">{row.candidate}</TableCell>
                <TableCell>
                  <p>{row.referrer ?? "—"}</p>
                  {row.referrer_grade && (
                    <p className="text-xs text-muted-foreground">Grade {row.referrer_grade}</p>
                  )}
                </TableCell>
                <TableCell>{row.requisition_code ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadge map={REFERRAL_STATUS} value={row.status} />
                  {row.hired_on && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Joined {formatDay(row.hired_on, true)}
                    </p>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{formatDate(row.submitted_at)}</TableCell>
                <TableCell className="text-right">
                  <Money value={row.bonus_amount} />
                </TableCell>
                <TableCell className="whitespace-normal">
                  <ReferralPayouts
                    payouts={row.payouts}
                    renderAction={(payout) =>
                      payout.status === "scheduled" ? (
                        <ReferralPayDialog payout={payout} onDone={reload} />
                      ) : null
                    }
                  />
                </TableCell>
                <TableCell className="text-right">
                  {HIREABLE.has(row.status) && <ReferralHireDialog referral={row} onDone={reload} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DataPanel>
  );
}

/** Every programme, running or not (HR); admins can start a new one. */
export function ReferralProgrammesTab() {
  const { data, error, isLoading, reload } = useApiQuery<ReferralProgramme[]>(
    "/recruiting/referral-programmes/all",
  );
  const list = data ?? [];
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Programmes set the bonus per grade, when it is paid and who may refer.
        </p>
        <RequireRole roles={ADMIN}>
          <ReferralProgrammeDialog onCreated={reload} />
        </RequireRole>
      </div>
      {isLoading && !data ? (
        <Skeleton className="h-48 w-full" />
      ) : error ? (
        <Card tier="tier1">
          <ErrorState message={error.detail} onRetry={reload} />
        </Card>
      ) : list.length === 0 ? (
        <Card tier="tier1">
          <CardContent className="p-0">
            <EmptyState
              icon={Gift}
              title="No referral programmes"
              description="An admin can create one; employees can refer as soon as it exists."
            />
          </CardContent>
        </Card>
      ) : (
        list.map((programme) => <ReferralProgrammeTerms key={programme.id} programme={programme} />)
      )}
    </div>
  );
}
