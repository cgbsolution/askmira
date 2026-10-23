"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Bot, Copy, KeyRound, Loader2, Plus, Webhook } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, patch, post } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface ApiKeyRow {
  id: string;
  name: string;
  key_hint: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
}

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  entity_types: string[];
  format: "askmira" | "chat";
  active: boolean;
}

interface Delivery {
  id: string;
  event: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  last_status_code: number | null;
  last_error: string | null;
  created_at: string | null;
}

const SCOPES: Record<string, string> = {
  "employees:read": "Directory",
  "employees:write": "Add and update employees",
  "org:read": "Departments, locations and holidays",
  "leave:read": "Leave and balances",
  "attendance:read": "Attendance days",
  "attendance:write": "Push attendance punches",
  "hiring:read": "Open roles",
};

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/** The record types a webhook sends, as its row shows them. */
function sendsOf(hook: WebhookRow): string {
  return hook.entity_types.length ? hook.entity_types.join(", ") : "Every change";
}

const DELIVERY_COLUMNS: ColumnDef<Delivery>[] = [
  { accessorKey: "event", header: "Event", meta: { cellClassName: "font-mono text-xs" } },
  {
    accessorKey: "status",
    header: "Status",
    meta: { text: (row) => (row.last_error ? `${row.status} · ${row.last_error}` : row.status) },
    cell: ({ row }) => (
      <>
        <Badge
          variant={row.original.status === "sent" ? "success" : row.original.status === "failed" ? "warning" : "outline"}
        >
          {row.original.status}
        </Badge>
        {row.original.last_error && (
          <p className="max-w-60 truncate text-xs text-muted-foreground">{row.original.last_error}</p>
        )}
      </>
    ),
  },
  { accessorKey: "attempts", header: "Tries", meta: { cellClassName: "tabular-nums" } },
  {
    accessorKey: "created_at",
    header: "When",
    meta: { cellClassName: "text-xs", text: (row) => (row.created_at ? formatDate(row.created_at) : "") },
    cell: ({ row }) => (row.original.created_at ? formatDate(row.original.created_at) : ""),
  },
];

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied.");
  } catch {
    toast.error("Could not copy. Select it and copy by hand.");
  }
}

function ShownOnce({ label, value, onClose }: { label: string; value: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>Shown once. Only a fingerprint is kept, so it cannot be shown again.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input readOnly value={value} aria-label={label} className="font-mono" />
          <Button size="icon" variant="outline" aria-label="Copy" onClick={() => void copy(value)}>
            <Copy />
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>I have saved it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** API keys for the customer API, and webhooks for change events. Admin only. */
/**
 * Connecting an AI assistant (AI-04): AskMira is an MCP server at /api/v1/mcp.
 * The key decides which tools appear; every tool reads, and every call is in
 * the audit trail as an MCP action.
 */
function McpCard() {
  const [origin, setOrigin] = useState("https://your-askmira-host");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/api/v1/mcp`;
  const command = `claude mcp add --transport http askmira ${url} --header "Authorization: Bearer amk_…"`;
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied.");
    } catch {
      toast.error("Could not copy; select the text instead.");
    }
  };
  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-4" /> Use AskMira from Claude or another AI assistant
        </CardTitle>
        <CardDescription>
          AskMira is an MCP server. Create a key above with only the reads the assistant needs; its tools
          read the directory, departments, locations, who is on leave and attendance summaries. They never
          change anything, and never return pay, bank, tax, health or leave reasons.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-center gap-2">
          <Input readOnly value={url} aria-label="MCP server address" className="font-mono text-xs" />
          <Button size="sm" variant="outline" onClick={() => void copy(url)}>
            <Copy /> Copy
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input readOnly value={command} aria-label="Claude Code command" className="font-mono text-xs" />
          <Button size="sm" variant="outline" onClick={() => void copy(command)}>
            <Copy /> Copy
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          In claude.ai or ChatGPT, add a custom connector with just the address above: each person signs in to
          AskMira and approves, and the assistant then reads as them, within what their role may see. They can
          disconnect it under Profile → Account and security. With Claude Code or a script, use a key as a Bearer
          token instead. Transport: Streamable HTTP. Slack and Teams apps are not built; their incoming webhooks
          work with the chat format below.
        </p>
      </CardContent>
    </Card>
  );
}

export function IntegrationsPanel() {
  const keys = useApiQuery<ApiKeyRow[]>("/admin/integrations/api-keys");
  const hooks = useApiQuery<WebhookRow[]>("/admin/integrations/webhooks");
  const [creatingKey, setCreatingKey] = useState(false);
  const [creatingHook, setCreatingHook] = useState(false);
  const [shown, setShown] = useState<{ label: string; value: string } | null>(null);
  const [viewing, setViewing] = useState<WebhookRow | null>(null);

  const revoke = async (key: ApiKeyRow) => {
    try {
      await post(`/admin/integrations/api-keys/${key.id}/revoke`);
      toast.success("Key revoked.");
      keys.reload();
    } catch (caught) {
      toast.error(failure(caught, "The key could not be revoked."));
    }
  };

  const toggle = async (hook: WebhookRow) => {
    try {
      await patch(`/admin/integrations/webhooks/${hook.id}`, { active: !hook.active });
      hooks.reload();
    } catch (caught) {
      toast.error(failure(caught, "The webhook could not be changed."));
    }
  };

  const keyColumns: ColumnDef<ApiKeyRow>[] = [
    {
      accessorKey: "name",
      header: "Key",
      meta: { text: (row) => `${row.name} ${row.key_hint}` },
      cell: ({ row }) => (
        <>
          <p className="font-medium">{row.original.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.original.key_hint}</p>
        </>
      ),
    },
    {
      id: "reads",
      header: "Reads",
      accessorFn: (row) => row.scopes.map((s) => SCOPES[s] ?? s).join(", "),
      meta: { cellClassName: "text-sm" },
    },
    {
      accessorKey: "last_used_at",
      header: "Last used",
      meta: {
        cellClassName: "text-sm",
        text: (row) => (row.last_used_at ? formatDate(row.last_used_at) : "Never"),
      },
      cell: ({ row }) => (row.original.last_used_at ? formatDate(row.original.last_used_at) : "Never"),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) =>
        row.original.revoked_at ? (
          <Badge variant="muted">Revoked</Badge>
        ) : (
          <Button size="sm" variant="outline" onClick={() => void revoke(row.original)}>
            Revoke
          </Button>
        ),
    },
  ];

  const hookColumns: ColumnDef<WebhookRow>[] = [
    {
      accessorKey: "name",
      header: "Webhook",
      meta: { text: (row) => `${row.name} ${row.url}` },
      cell: ({ row }) => (
        <>
          <p className="font-medium">{row.original.name}</p>
          <p className="max-w-80 truncate text-xs text-muted-foreground">{row.original.url}</p>
        </>
      ),
    },
    {
      id: "sends",
      header: "Sends",
      accessorFn: sendsOf,
      meta: {
        cellClassName: "text-sm",
        text: (row) => `${sendsOf(row)}${row.format === "chat" ? " · Chat" : ""}`,
      },
      cell: ({ row }) => (
        <>
          {sendsOf(row.original)}
          {row.original.format === "chat" && (
            <Badge variant="outline" className="ml-2">
              Chat
            </Badge>
          )}
        </>
      ),
    },
    {
      accessorKey: "active",
      header: "On",
      cell: ({ row }) => (
        <Switch
          aria-label={`${row.original.name} on`}
          checked={row.original.active}
          onCheckedChange={() => void toggle(row.original)}
        />
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={() => setViewing(row.original)}>
          Deliveries
        </Button>
      ),
    },
  ];

  return (
    <div className="grid gap-6">
      {/* No Export on either list: key hints and webhook URLs (a Slack or Teams
          address carries its own token) stay on screen, not in a file. */}
      <DataTable
        tier="tier1"
        title="API keys"
        description="Keys for your own systems: send one as a Bearer token to /api/v1/ext/…. A key can do only what its scopes name; changes are audited as the key."
        columns={keyColumns}
        data={keys.data ?? []}
        noun="keys"
        exportName={false}
        searchPlaceholder="Search keys"
        rowClassName={(row) => (row.revoked_at ? "opacity-60" : undefined)}
        actions={
          <Button size="sm" className="h-9" onClick={() => setCreatingKey(true)}>
            <Plus /> New key
          </Button>
        }
        isLoading={keys.isLoading && !keys.data}
        error={keys.error?.detail}
        onRetry={keys.reload}
        empty={{ icon: KeyRound, title: "No API keys" }}
      />

      <McpCard />

      <DataTable
        tier="tier1"
        title="Webhooks"
        description="Each committed change is sent to your endpoint, signed with its secret (X-AskMira-Signature: sha256=…). A Slack or Teams incoming-webhook URL works with the chat format."
        columns={hookColumns}
        data={hooks.data ?? []}
        noun="webhooks"
        exportName={false}
        searchPlaceholder="Search webhooks"
        actions={
          <Button size="sm" className="h-9" onClick={() => setCreatingHook(true)}>
            <Plus /> New webhook
          </Button>
        }
        isLoading={hooks.isLoading && !hooks.data}
        error={hooks.error?.detail}
        onRetry={hooks.reload}
        empty={{ icon: Webhook, title: "No webhooks" }}
      />

      {viewing && <Deliveries hook={viewing} onClose={() => setViewing(null)} />}
      {creatingKey && (
        <NewKeyDialog
          onClose={() => setCreatingKey(false)}
          onCreated={(value) => {
            setCreatingKey(false);
            setShown({ label: "Your API key", value });
            keys.reload();
          }}
        />
      )}
      {creatingHook && (
        <NewWebhookDialog
          onClose={() => setCreatingHook(false)}
          onCreated={(value) => {
            setCreatingHook(false);
            setShown({ label: "Your webhook signing secret", value });
            hooks.reload();
          }}
        />
      )}
      {shown && <ShownOnce label={shown.label} value={shown.value} onClose={() => setShown(null)} />}
    </div>
  );
}

function Deliveries({ hook, onClose }: { hook: WebhookRow; onClose: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<Delivery[]>(
    `/admin/integrations/webhooks/${hook.id}/deliveries`,
  );
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Deliveries to {hook.name}</DialogTitle>
          <DialogDescription>The latest 100. Failures are retried with growing gaps, eight times.</DialogDescription>
        </DialogHeader>
        <DataTable
          columns={DELIVERY_COLUMNS}
          data={data ?? []}
          noun="deliveries"
          exportName="webhook-deliveries"
          searchPlaceholder="Search deliveries"
          isLoading={isLoading && !data}
          error={error?.detail}
          onRetry={reload}
          empty={{ icon: Webhook, title: "No deliveries yet" }}
        />
      </DialogContent>
    </Dialog>
  );
}

function NewKeyDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (key: string) => void }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<string>>(new Set(["employees:read"]));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const created = await post<{ key: string }>("/admin/integrations/api-keys", { name: name.trim(), scopes: [...scopes] });
      onCreated(created.key);
    } catch (caught) {
      toast.error(failure(caught, "The key could not be created."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New API key</DialogTitle>
          <DialogDescription>Give it only what the system using it needs. Write scopes change records.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="key-name" label="Name">
            <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Payroll sync" />
          </FormField>
          <div className="grid gap-2">
            {Object.entries(SCOPES).map(([scope, label]) => (
              <div key={scope} className="flex items-center gap-2">
                <Checkbox
                  id={`scope-${scope}`}
                  checked={scopes.has(scope)}
                  onCheckedChange={(on) =>
                    setScopes((c) => {
                      const next = new Set(c);
                      if (on) next.add(scope);
                      else next.delete(scope);
                      return next;
                    })
                  }
                />
                <Label htmlFor={`scope-${scope}`} className="font-normal">
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || name.trim().length < 2 || scopes.size === 0} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewWebhookDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (secret: string) => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [types, setTypes] = useState("");
  const [format, setFormat] = useState<"askmira" | "chat">("askmira");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const created = await post<{ secret: string }>("/admin/integrations/webhooks", {
        name: name.trim(),
        url: url.trim(),
        format,
        entity_types: types.split(",").map((t) => t.trim()).filter(Boolean),
      });
      onCreated(created.secret);
    } catch (caught) {
      toast.error(failure(caught, "The webhook could not be added."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New webhook</DialogTitle>
          <DialogDescription>https only. Addresses inside a private network are refused.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="hook-name" label="Name">
            <Input id="hook-name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField htmlFor="hook-url" label="Endpoint URL">
            <Input id="hook-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </FormField>
          <FormField htmlFor="hook-types" label="Only these record types" optional hint="Comma separated, e.g. employee, leave_request. Empty sends every change.">
            <Input id="hook-types" value={types} onChange={(e) => setTypes(e.target.value)} />
          </FormField>
          <FormField htmlFor="hook-format" label="Format">
            <Select value={format} onValueChange={(v) => setFormat(v as "askmira" | "chat")}>
              <SelectTrigger id="hook-format" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="askmira">AskMira JSON (signed)</SelectItem>
                <SelectItem value="chat">Slack / Teams message</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {format === "chat" && (
            <Alert>
              <AlertTitle>Messages carry the change summary</AlertTitle>
              <AlertDescription>Summaries can name people. Send them to a channel only HR can read.</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || name.trim().length < 2 || !url.trim().startsWith("https://")} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
