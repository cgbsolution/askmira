"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MessageSquareText, Plus, Send, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { BoardFormDialog } from "@/components/hiring/BoardFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, patch, post, put } from "@/lib/api";

interface MetaTemplate {
  id: string;
  meta_name: string;
  locale: string;
  category: string;
  status: string;
  parameter_names: string[];
  rejection_reason: string | null;
  events: string[];
}

interface Overview {
  templates: MetaTemplate[];
  events: { event_key: string; label: string; template_id: string | null }[];
  categories: string[];
  connected: boolean;
}

const NOT_ON_WHATSAPP = "__none__";
const STATUS: Record<
  string,
  { label: string; variant: "success" | "warning" | "outline" | "muted" }
> = {
  approved: { label: "Approved", variant: "success" },
  pending: { label: "Waiting for Meta", variant: "warning" },
  rejected: { label: "Rejected by Meta", variant: "muted" },
  draft: { label: "Draft", variant: "outline" },
};

function detail(caught: unknown, fallback: string) {
  return caught instanceof ApiError ? caught.detail : fallback;
}

function AddTemplateDialog({
  categories,
  onSaved,
}: {
  categories: string[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [locale, setLocale] = useState("en");
  const [category, setCategory] = useState("UTILITY");
  const [params, setParams] = useState("");
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError("Enter the template's name exactly as Meta shows it.");
      return false;
    }
    try {
      await post("/integrations/whatsapp/templates", {
        meta_name: name.trim(),
        locale: locale.trim(),
        category,
        parameter_names: params
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        approved,
      });
      toast.success(`${name.trim()} registered`);
      onSaved();
      return true;
    } catch (caught) {
      toast.error(detail(caught, "Could not register the template."));
      return false;
    }
  };

  return (
    <BoardFormDialog
      trigger={
        <Button size="sm">
          <Plus /> Add template
        </Button>
      }
      title="Register a Meta template"
      description="Create and get the template approved in Meta's WhatsApp Manager first, then register it here exactly as Meta shows it."
      submitLabel="Register"
      onSubmit={submit}
      onClosed={() => {
        setName("");
        setParams("");
        setApproved(false);
        setError(null);
      }}
    >
      <FormField
        htmlFor="wa-tpl-name"
        label="Template name"
        error={error}
        hint="Lower-case, as in Meta: leave_approved"
      >
        <Input
          id="wa-tpl-name"
          value={name}
          maxLength={512}
          onChange={(e) => setName(e.target.value)}
        />
      </FormField>
      <FormField
        htmlFor="wa-tpl-locale"
        label="Language code"
        hint="As registered in Meta: en, en_US, hi"
      >
        <Input
          id="wa-tpl-locale"
          value={locale}
          maxLength={16}
          onChange={(e) => setLocale(e.target.value)}
        />
      </FormField>
      <FormField htmlFor="wa-tpl-category" label="Category">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="wa-tpl-category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        htmlFor="wa-tpl-params"
        label="Values for {{1}}, {{2}}…"
        optional
        hint="The event's field names in order, separated by commas: employee_name, start_date"
      >
        <Input
          id="wa-tpl-params"
          value={params}
          onChange={(e) => setParams(e.target.value)}
        />
      </FormField>
      <div className="flex items-center gap-3">
        <Switch
          id="wa-tpl-approved"
          checked={approved}
          onCheckedChange={setApproved}
        />
        <Label htmlFor="wa-tpl-approved" className="text-sm font-normal">
          Meta shows this template as approved
        </Label>
      </div>
    </BoardFormDialog>
  );
}

function TestDialog({ template }: { template: MetaTemplate }) {
  const [phone, setPhone] = useState("");
  const [values, setValues] = useState<string[]>(
    template.parameter_names.map(() => ""),
  );
  const submit = async () => {
    try {
      const result = await post<{ message_id: string }>(
        `/integrations/whatsapp/templates/${template.id}/test`,
        {
          phone,
          values,
        },
      );
      toast.success("WhatsApp accepted the test message", {
        description: result.message_id,
      });
      return true;
    } catch (caught) {
      toast.error(detail(caught, "The test was not sent."));
      return false;
    }
  };
  return (
    <BoardFormDialog
      trigger={
        <Button
          size="sm"
          variant="outline"
          disabled={template.status !== "approved"}
        >
          <Send /> Send a test
        </Button>
      }
      title={`Send ${template.meta_name} as a test`}
      description="Sent now to the number below through your business number. Use your own phone."
      submitLabel="Send test"
      onSubmit={submit}
    >
      <FormField
        htmlFor={`wa-test-phone-${template.id}`}
        label="Phone number"
        hint="With the country code: +91 98765 43210"
      >
        <Input
          id={`wa-test-phone-${template.id}`}
          value={phone}
          maxLength={32}
          onChange={(e) => setPhone(e.target.value)}
        />
      </FormField>
      {template.parameter_names.map((name, index) => (
        <FormField
          key={name}
          htmlFor={`wa-test-${template.id}-${index}`}
          label={`{{${index + 1}}} ${name}`}
        >
          <Input
            id={`wa-test-${template.id}-${index}`}
            value={values[index] ?? ""}
            onChange={(e) =>
              setValues((current) =>
                current.map((v, i) => (i === index ? e.target.value : v)),
              )
            }
          />
        </FormField>
      ))}
    </BoardFormDialog>
  );
}

/**
 * Settings → Notifications → WhatsApp: the Meta-approved templates this
 * workspace sends with, and which AskMiraa notifications go by WhatsApp.
 */
export function WhatsAppTemplatesPanel() {
  const { data, error, isLoading, reload } = useApiQuery<Overview>(
    "/integrations/whatsapp/templates",
  );
  const [removing, setRemoving] = useState<MetaTemplate | null>(null);

  const setStatus = async (template: MetaTemplate, approved: boolean) => {
    try {
      await patch(`/integrations/whatsapp/templates/${template.id}`, {
        approved,
      });
      reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not update the template."));
    }
  };

  const link = async (eventKey: string, templateId: string) => {
    try {
      await put(
        `/integrations/whatsapp/events/${encodeURIComponent(eventKey)}`,
        {
          template_id: templateId === NOT_ON_WHATSAPP ? null : templateId,
        },
      );
      toast.success(
        templateId === NOT_ON_WHATSAPP
          ? "No longer sent by WhatsApp"
          : "Will be sent by WhatsApp",
      );
      reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not save."));
    }
  };

  const approvedTemplates = (data?.templates ?? []).filter(
    (t) => t.status === "approved",
  );

  const templateColumns: ColumnDef<MetaTemplate>[] = [
    {
      id: "name",
      header: "Template",
      accessorFn: (row) => row.meta_name,
      cell: ({ row }) => (
        <div>
          <p className="font-mono text-sm">{row.original.meta_name}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.locale} · {row.original.category.toLowerCase()}
            {row.original.parameter_names.length > 0 &&
              ` · ${row.original.parameter_names.join(", ")}`}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Meta status",
      accessorFn: (row) => STATUS[row.status]?.label ?? row.status,
      cell: ({ row }) => (
        <Badge variant={STATUS[row.original.status]?.variant ?? "outline"}>
          {STATUS[row.original.status]?.label ?? row.original.status}
        </Badge>
      ),
    },
    {
      id: "events",
      header: "Sends",
      accessorFn: (row) => row.events.join(", "),
      meta: {
        cellClassName:
          "max-w-64 whitespace-normal text-xs text-muted-foreground",
      },
      cell: ({ row }) => row.original.events.join(", ") || "—",
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <div className="flex flex-wrap justify-end gap-2">
          {row.original.status === "approved" ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void setStatus(row.original, false)}
            >
              Mark waiting
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void setStatus(row.original, true)}
            >
              Mark approved
            </Button>
          )}
          <TestDialog template={row.original} />
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Remove ${row.original.meta_name}`}
            onClick={() => setRemoving(row.original)}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  const eventColumns: ColumnDef<Overview["events"][number]>[] = [
    {
      id: "event",
      header: "Notification",
      accessorFn: (row) => `${row.label} ${row.event_key}`,
      meta: { cellClassName: "whitespace-normal" },
      cell: ({ row }) => (
        <div>
          <p className="text-sm">{row.original.label}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {row.original.event_key}
          </p>
        </div>
      ),
    },
    {
      id: "template",
      header: "Send by WhatsApp with",
      enableSorting: false,
      meta: { text: false },
      cell: ({ row }) => (
        <Select
          value={row.original.template_id ?? NOT_ON_WHATSAPP}
          onValueChange={(value) => void link(row.original.event_key, value)}
        >
          <SelectTrigger
            className="h-9 w-64"
            aria-label={`WhatsApp template for ${row.original.event_key}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NOT_ON_WHATSAPP}>Not on WhatsApp</SelectItem>
            {approvedTemplates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.meta_name} ({t.locale})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
  ];

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareText className="size-4" /> Message templates
        </CardTitle>
        <CardDescription>
          WhatsApp lets a business start a conversation only with a template
          Meta has approved. Register yours here, then choose which
          notifications go by WhatsApp. People receive them only after opting
          in.
          {data && !data.connected && " Turn WhatsApp on above before sending."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <DataTable
          title="Registered templates"
          columns={templateColumns}
          data={data?.templates ?? []}
          getRowId={(row) => row.id}
          noun="templates"
          exportName={false}
          searchPlaceholder={false}
          isLoading={isLoading}
          error={error?.detail}
          onRetry={reload}
          paginate={false}
          actions={
            <AddTemplateDialog
              categories={data?.categories ?? ["UTILITY"]}
              onSaved={reload}
            />
          }
          empty={{
            icon: MessageSquareText,
            title: "No templates yet",
            description: "Add the templates Meta approved for your number.",
          }}
        />
        <DataTable
          title="Which notifications go by WhatsApp"
          columns={eventColumns}
          data={data?.events ?? []}
          getRowId={(row) => row.event_key}
          noun="notifications"
          exportName={false}
          searchPlaceholder="Search notifications"
          isLoading={isLoading}
          pageSize={10}
          empty={{ icon: MessageSquareText, title: "No notifications" }}
        />
      </CardContent>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.meta_name ?? "this template"}?`}
        description="Only the registration here is removed; the template stays in Meta."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!removing) return;
          try {
            await del(`/integrations/whatsapp/templates/${removing.id}`);
            toast.success("Template removed");
            reload();
          } catch (caught) {
            toast.error(detail(caught, "Could not remove it."));
            throw caught;
          }
        }}
      />
    </Card>
  );
}
