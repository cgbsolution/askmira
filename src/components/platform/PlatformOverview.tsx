"use client";

import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Inbox,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  Plus,
  PlugZap,
  RefreshCw,
  Trash2,
  UserX,
  Users,
} from "lucide-react";
import Link from "next/link";
import React from "react";

import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { cn, formatDate } from "@/lib/utils";

import { type Connection, OrgLogo, type Workspace } from "./PlatformConsole";
import type { PlatformTool } from "./tools";

interface DeletedWorkspace {
  id: string;
  name: string;
  deleted_at: string | null;
  purge_after: string | null;
  purged_at: string | null;
  can_export: boolean;
}

interface DemoRequestLite {
  id: string;
  status: string;
}

/** A purge this close is worth a reminder: the company's data goes for good. */
const PURGE_WARNING_DAYS = 14;
/** An active organisation nobody has signed in to for this long has likely stalled. */
const QUIET_DAYS = 30;

function daysFrom(iso: string, now: number): number {
  return Math.floor((new Date(iso).getTime() - now) / 86_400_000);
}

interface Attention {
  key: string;
  icon: LucideIcon;
  tone: "warning" | "destructive";
  title: string;
  detail: string;
  href: string;
  action: string;
}

/**
 * Platform → Overview: the super admin's home. Every figure is read from the
 * platform's own records (organisations, tool keys and links, demo requests,
 * deleted organisations), and every attention line opens where it is fixed.
 */
export function PlatformOverview() {
  const workspaces = useApiQuery<Workspace[]>("/platform/workspaces");
  const tools = useApiQuery<PlatformTool[]>("/platform/tools");
  const connections = useApiQuery<Connection[]>("/platform/connections");
  const demos = useApiQuery<DemoRequestLite[]>("/platform/demo-requests?status_filter=new");
  const deleted = useApiQuery<DeletedWorkspace[]>("/platform/workspaces/deleted");

  const orgs = workspaces.data ?? [];
  const active = orgs.filter((org) => org.is_active);
  const suspended = orgs.length - active.length;
  const people = orgs.reduce((sum, org) => sum + org.employees, 0);
  const logins = orgs.reduce((sum, org) => sum + org.active_logins, 0);
  const newDemos = demos.data?.length ?? 0;
  const toolList = tools.data ?? [];
  const toolsReady = toolList.filter((tool) => tool.key_set && tool.last_check_ok !== false).length;

  const now = Date.now();
  const attention: Attention[] = [];
  for (const tool of toolList) {
    if (!tool.key_set) {
      attention.push({
        key: `tool-key:${tool.key}`,
        icon: KeyRound,
        tone: "warning",
        title: `${tool.brand} has no platform key`,
        detail: "New organisations cannot be set up in it from here.",
        href: "/platform/tools",
        action: "Set key",
      });
    } else if (tool.last_check_ok === false) {
      attention.push({
        key: `tool-check:${tool.key}`,
        icon: KeyRound,
        tone: "destructive",
        title: `${tool.brand} refused the platform key`,
        detail: tool.last_check_message ?? "Check the key set on the tool.",
        href: "/platform/tools",
        action: "Fix key",
      });
    }
  }
  for (const org of connections.data ?? []) {
    for (const tool of org.tools) {
      if (tool.connected && tool.last_error) {
        attention.push({
          key: `sync:${org.id}:${tool.key}`,
          icon: RefreshCw,
          tone: "destructive",
          title: `${org.name}: ${tool.brand} people sync failed`,
          detail: tool.last_error,
          href: `/platform/organisations?open=${org.id}`,
          action: "Open",
        });
      }
    }
  }
  for (const org of orgs) {
    if (org.is_active && org.admins.filter((admin) => admin.is_active).length === 0) {
      attention.push({
        key: `no-admin:${org.id}`,
        icon: UserX,
        tone: "destructive",
        title: `${org.name} has no active admin`,
        detail: "Nobody can set it up or manage it.",
        href: `/platform/organisations?search=${encodeURIComponent(org.workspace)}`,
        action: "Open",
      });
    }
    for (const admin of org.admins) {
      if (org.is_active && admin.is_active && admin.must_change_password) {
        attention.push({
          key: `first-sign-in:${admin.id}`,
          icon: UserX,
          tone: "warning",
          title: `${admin.full_name} has not signed in to ${org.name}`,
          detail: `${admin.email} still has the temporary password.`,
          href: `/platform/organisations?search=${encodeURIComponent(org.workspace)}`,
          action: "Open",
        });
      }
    }
    if (org.is_active && !org.is_own && org.last_sign_in && -daysFrom(org.last_sign_in, now) > QUIET_DAYS) {
      attention.push({
        key: `quiet:${org.id}`,
        icon: Users,
        tone: "warning",
        title: `Nobody has signed in to ${org.name} for ${-daysFrom(org.last_sign_in, now)} days`,
        detail: `Last sign-in ${formatDate(org.last_sign_in)}.`,
        href: `/platform/organisations?open=${org.id}`,
        action: "Open",
      });
    }
  }
  if (newDemos > 0) {
    attention.push({
      key: "demos",
      icon: Inbox,
      tone: "warning",
      title: `${newDemos} demo ${newDemos === 1 ? "request is" : "requests are"} waiting for a reply`,
      detail: "Sent from the website's demo form.",
      href: "/platform/demo-requests",
      action: "Reply",
    });
  }
  for (const gone of deleted.data ?? []) {
    if (!gone.can_export || !gone.purge_after) continue;
    const days = daysFrom(gone.purge_after, now);
    if (days <= PURGE_WARNING_DAYS) {
      attention.push({
        key: `purge:${gone.id}`,
        icon: Trash2,
        tone: "destructive",
        title: `${gone.name}'s data is purged ${days <= 0 ? "today" : `in ${days} ${days === 1 ? "day" : "days"}`}`,
        detail: `On ${formatDate(gone.purge_after)}. Download it first if the company needs it.`,
        href: "/platform/deleted",
        action: "Download",
      });
    }
  }

  const loading =
    (workspaces.isLoading && !workspaces.data) ||
    (tools.isLoading && !tools.data) ||
    (connections.isLoading && !connections.data);
  const failed = workspaces.error ?? tools.error ?? connections.error;
  const reloadAll = () => {
    workspaces.reload();
    tools.reload();
    connections.reload();
    demos.reload();
    deleted.reload();
  };

  const recent = [...orgs]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 5);

  return (
    <PageShell
      title="Platform overview"
      eyebrow="Platform console"
      icon={LayoutDashboard}
      description="Organisations, their admins and the tools they are connected to, and what needs you today."
      actions={
        <Button asChild>
          <Link href="/platform/organisations?new=1">
            <Plus /> New organisation
          </Link>
        </Button>
      }
    >
      {failed ? (
        <ErrorState message={failed.detail} onRetry={reloadAll} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Organisations"
              icon={Building2}
              value={loading ? null : orgs.length}
              note={suspended ? `${active.length} active · ${suspended} suspended` : "All active"}
              href="/platform/organisations"
            />
            <Stat
              label="People on AskMiraa"
              icon={Users}
              value={loading ? null : people}
              note={`${logins} active ${logins === 1 ? "login" : "logins"}`}
              href="/platform/organisations"
            />
            <Stat
              label="Tools ready"
              icon={PlugZap}
              value={loading ? null : toolsReady}
              suffix={toolList.length ? ` / ${toolList.length}` : undefined}
              note="Platform key set and accepted"
              href="/platform/tools"
            />
            <Stat
              label="New demo requests"
              icon={Inbox}
              value={demos.isLoading && !demos.data ? null : newDemos}
              note="Waiting for a first reply"
              href="/platform/demo-requests"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card tier="tier1">
              <CardHeader>
                <CardTitle className="text-base">Needs attention</CardTitle>
                <CardDescription>From the organisations, tools and requests as they stand now.</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {loading ? (
                  <div className="grid gap-3 px-6">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : attention.length === 0 ? (
                  <div className="flex items-center gap-3 px-6 py-4 text-sm text-muted-foreground">
                    <CheckCircle2 className="size-5 text-success" />
                    Nothing needs you right now.
                  </div>
                ) : (
                  <ul className="divide-y divide-border border-y border-border">
                    {attention.map((item) => (
                      <li key={item.key} className="flex items-start gap-3 px-6 py-3">
                        <span
                          className={cn(
                            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                            item.tone === "destructive"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-marigold-100 text-marigold-900",
                          )}
                        >
                          <item.icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{item.detail}</p>
                        </div>
                        <Button size="sm" variant="outline" asChild className="shrink-0">
                          <Link href={item.href}>{item.action}</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card tier="tier1">
              <CardHeader>
                <CardTitle className="text-base">Connected tools</CardTitle>
                <CardDescription>Each tool&apos;s platform key, and how many organisations use it.</CardDescription>
                <CardAction>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href="/platform/tools">
                      Manage <ArrowRight />
                    </Link>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-2">
                {loading ? (
                  <>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </>
                ) : toolList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tools are configured on this server.</p>
                ) : (
                  toolList.map((tool) => {
                    const using = (connections.data ?? []).filter((org) =>
                      org.tools.some((t) => t.key === tool.key && t.connected),
                    ).length;
                    const failing = (connections.data ?? []).filter((org) =>
                      org.tools.some((t) => t.key === tool.key && t.connected && t.last_error),
                    ).length;
                    return (
                      <div
                        key={tool.key}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{tool.brand}</p>
                          <p className="text-xs text-muted-foreground">
                            {using} {using === 1 ? "organisation" : "organisations"}
                            {failing ? ` · ${failing} sync failing` : ""}
                          </p>
                        </div>
                        {!tool.key_set ? (
                          <Badge variant="warning">No key</Badge>
                        ) : tool.last_check_ok === false ? (
                          <Badge variant="destructive">Key refused</Badge>
                        ) : tool.last_check_ok ? (
                          <Badge variant="success">Ready</Badge>
                        ) : (
                          <Badge variant="secondary">Key set, not checked</Badge>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          <Card tier="tier1">
            <CardHeader>
              <CardTitle className="text-base">Newest organisations</CardTitle>
              <CardDescription>The five most recently created.</CardDescription>
              <CardAction>
                <Button size="sm" variant="ghost" asChild>
                  <Link href="/platform/organisations">
                    All organisations <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
              {loading ? (
                <div className="grid gap-3 px-6">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : recent.length === 0 ? (
                <p className="px-6 text-sm text-muted-foreground">No organisations yet.</p>
              ) : (
                <ul className="divide-y divide-border border-y border-border">
                  {recent.map((org) => {
                    const connected = (connections.data ?? [])
                      .find((row) => row.id === org.id)
                      ?.tools.filter((tool) => tool.connected);
                    return (
                      <li key={org.id}>
                        <Link
                          href={`/platform/organisations?open=${org.id}`}
                          className="flex flex-wrap items-center gap-3 px-6 py-3 outline-hidden transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
                        >
                          <OrgLogo url={org.logo_url} />
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                              {org.name}
                              {!org.is_active ? <Badge variant="destructive">Suspended</Badge> : null}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {org.workspace}
                              {org.created_at ? ` · created ${formatDate(org.created_at)}` : ""}
                            </p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <p className="font-medium text-foreground tabular-nums">
                              {org.employees} {org.employees === 1 ? "person" : "people"}
                            </p>
                            <p>
                              {connected?.length
                                ? connected.map((tool) => tool.brand).join(", ")
                                : "No tools connected"}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}

function Stat({
  label,
  icon: Icon,
  value,
  suffix,
  note,
  href,
}: {
  label: string;
  icon: LucideIcon;
  value: number | null;
  suffix?: string;
  note: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card tier="tier1" className="h-full gap-2 py-4 transition-colors group-hover:border-primary/40">
        <CardHeader className="px-4">
          <CardDescription className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
            <Icon className="size-4 text-primary" /> {label}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          {value === null ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
              {value.toLocaleString("en-IN")}
              {suffix ? <span className="text-base font-medium text-muted-foreground">{suffix}</span> : null}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{note}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

