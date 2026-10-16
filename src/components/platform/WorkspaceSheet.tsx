"use client";

import { Building2, ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import React from "react";

import { ErrorState } from "@/components/common/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { INDIAN_STATES } from "@/lib/states";
import { formatDate } from "@/lib/utils";

import type { CompanyDetails, EditTarget } from "./CreateWorkspaceDialog";

export interface WorkspaceDetail extends EditTarget {
  name: string;
  is_active: boolean;
  is_own: boolean;
  created_at: string | null;
  sign_in_path: string;
  admins: {
    id: string;
    full_name: string;
    email: string;
    is_active: boolean;
    must_change_password: boolean;
    last_login_at: string | null;
  }[];
  active_logins: number;
  employees: number;
  last_sign_in: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  private_limited: "Private limited company",
  public_limited: "Public limited company",
  llp: "LLP",
  partnership: "Partnership firm",
  proprietorship: "Sole proprietorship",
  opc: "One person company",
  trust_society: "Trust or society",
  government: "Government or PSU",
  other: "Other",
};

const MODULE_LABEL: Record<string, string> = {
  core_hr: "Core HR",
  leave: "Leave & attendance",
  payroll: "Payroll",
  culture: "Culture",
  hiring: "Hiring",
  analytics: "Analytics",
  benefits: "Benefits",
  rewards: "Rewards",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words text-foreground">{value || <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-1">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function stateName(code: string | null): string | null {
  if (!code) return null;
  return INDIAN_STATES.find((state) => state.code === code)?.name ?? code;
}

/**
 * Platform → Workspaces → View: one company's full record on file.
 *
 * What the platform holds about the company itself — its identity, office,
 * admins and size. Nothing from inside its workspace.
 */
export function WorkspaceSheet({
  workspaceId,
  onClose,
  onEdit,
}: {
  workspaceId: string | null;
  onClose: () => void;
  onEdit: (detail: WorkspaceDetail) => void;
}) {
  const { data, error, isLoading, reload } = useApiQuery<WorkspaceDetail>(
    workspaceId ? `/platform/workspaces/${workspaceId}` : null,
  );
  const d: CompanyDetails | undefined = data?.details;

  return (
    <Sheet open={workspaceId !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-center gap-3">
            {data?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.logo_url} alt="" className="size-12 rounded object-contain" />
            ) : (
              <span className="flex size-12 items-center justify-center rounded bg-muted text-muted-foreground">
                <Building2 className="size-5" />
              </span>
            )}
            <div className="min-w-0">
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {data?.name ?? "Organisation"}
                {data && !data.is_active ? <Badge variant="destructive">Suspended</Badge> : null}
                {data?.is_own ? <Badge variant="outline">Yours</Badge> : null}
              </SheetTitle>
              <SheetDescription className="font-mono">{data?.workspace}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="grid gap-5 px-4 pb-6">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : error ? (
            <ErrorState message={error.detail} onRetry={reload} />
          ) : data && d ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onEdit(data)}>
                  <Pencil /> Edit details
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={data.sign_in_path} target="_blank" rel="noopener noreferrer">
                    <ExternalLink /> Their sign-in page
                  </Link>
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-lg border p-3 text-center">
                <div>
                  <p className="text-xl font-semibold tabular-nums">{data.employees}</p>
                  <p className="text-xs text-muted-foreground">People</p>
                </div>
                <div>
                  <p className="text-xl font-semibold tabular-nums">{data.active_logins}</p>
                  <p className="text-xs text-muted-foreground">Active logins</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{data.last_sign_in ? formatDate(data.last_sign_in) : "Never"}</p>
                  <p className="text-xs text-muted-foreground">Last sign-in</p>
                </div>
              </div>

              <Block title="Company">
                <Row label="Display name" value={d.company_name} />
                <Row label="Legal name" value={d.legal_name} />
                <Row label="Type" value={d.company_type ? TYPE_LABEL[d.company_type] ?? d.company_type : null} />
                <Row label="Industry" value={d.industry} />
                <Row label="Size" value={d.company_size ? `${d.company_size} employees` : null} />
                <Row label="Website" value={d.website} />
                <Row label="Email" value={d.contact_email} />
                <Row label="Phone" value={d.contact_phone} />
                <Row label="Created" value={data.created_at ? formatDate(data.created_at) : null} />
              </Block>

              <Separator />

              <Block title="Statutory identity">
                <Row label="PAN" value={d.pan && <span className="font-mono">{d.pan}</span>} />
                <Row label="TAN" value={d.tan && <span className="font-mono">{d.tan}</span>} />
                <Row label="GSTIN" value={d.gstin && <span className="font-mono">{d.gstin}</span>} />
                <Row label="CIN / LLPIN" value={d.cin && <span className="font-mono">{d.cin}</span>} />
                <Row label="PF establishment" value={d.pf_registration_no} />
                <Row label="ESI code" value={d.esi_registration_no} />
              </Block>

              <Separator />

              <Block title="Registered office">
                <Row label="Address" value={d.registered_address} />
                <Row label="State" value={stateName(d.state_code)} />
                <Row label="PIN code" value={d.pincode} />
              </Block>

              <Separator />

              <Block title="Admins">
                {data.admins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No admin.</p>
                ) : (
                  data.admins.map((admin) => (
                    <div key={admin.id} className="flex flex-wrap items-center justify-between gap-2 py-1 text-sm">
                      <span>
                        {admin.full_name} <span className="text-xs text-muted-foreground">{admin.email}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {admin.must_change_password
                          ? "Not signed in yet"
                          : admin.last_login_at
                            ? `Last in ${formatDate(admin.last_login_at)}`
                            : "—"}
                      </span>
                    </div>
                  ))
                )}
              </Block>

              <Separator />

              <Block title="Modules">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(MODULE_LABEL).map(([key, label]) => (
                    <Badge key={key} variant={d.modules[key] ? "secondary" : "outline"}>
                      {d.modules[key] ? label : `${label} (off)`}
                    </Badge>
                  ))}
                </div>
              </Block>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
