"use client";

import { Copy, Plus, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { IdentityProvider, ServiceProviderDetails } from "@/lib/types/sso";

import { BreakGlassCard } from "./BreakGlassCard";
import { ProviderDialog } from "./ProviderDialog";
import { ScimTokensPanel } from "./ScimTokensPanel";

/**
 * Settings → Sign-in & SSO.
 *
 * Enforcing SSO is the change most capable of locking a workspace out of its
 * own account, so the break-glass account is not a footnote here: it is on the
 * same screen, above the providers, and the API refuses enforcement until one
 * exists. The untested-against-a-live-IdP caveat is shown rather than left for
 * a pilot customer to discover.
 */
export function SsoScreen() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const providers = useApiQuery<IdentityProvider[]>("/sso/providers");
  const serviceProvider = useApiQuery<ServiceProviderDetails>("/sso/service-provider");

  const [form, setForm] = useState<{ open: boolean; editing: IdentityProvider | null }>({
    open: false,
    editing: null,
  });

  const enforcing = (providers.data ?? []).some((row) => row.enforce_sso && row.enabled);

  return (
    <PageShell
      title="Sign-in & SSO"
      description="Identity providers, the break-glass account, and directory sync tokens."
    >
      {serviceProvider.data && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Tested against a mock identity provider, not a live one</AlertTitle>
          <AlertDescription>{serviceProvider.data.note}</AlertDescription>
        </Alert>
      )}

      <BreakGlassCard canManage={isAdmin} enforcing={enforcing} />

      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">Identity providers</TabsTrigger>
          <TabsTrigger value="directory">Directory sync</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints for your IdP</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="mt-4">
          <DataPanel
            title="Identity providers"
            description="Roles are always assigned in AskMira. There is deliberately no mapping from an IdP role claim — that would be a path to granting yourself payroll access from outside."
            actions={
              isAdmin ? (
                <Button size="sm" onClick={() => setForm({ open: true, editing: null })}>
                  <Plus /> Add provider
                </Button>
              ) : undefined
            }
            isLoading={providers.isLoading}
            error={providers.error?.detail ?? null}
            onRetry={providers.reload}
            isEmpty={(providers.data ?? []).length === 0}
            empty={{
              icon: ShieldCheck,
              title: "No identity provider configured",
              description: "Everyone signs in with an email address and password.",
            }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Email domains</TableHead>
                  <TableHead>Behaviour</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(providers.data ?? []).map((row) => (
                  <TableRow key={row.id} className={row.enabled ? undefined : "opacity-60"}>
                    <TableCell>
                      <div className="font-medium text-foreground">{row.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.idp_type === "saml" ? row.entity_id : row.issuer}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase">
                        {row.idp_type}
                      </Badge>
                      {!row.enabled && (
                        <Badge variant="outline" className="ml-1">
                          Disabled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.allowed_email_domains.length > 0 ? (
                        row.allowed_email_domains.join(", ")
                      ) : (
                        <span className="text-muted-foreground">Any domain</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col gap-1">
                        {row.enforce_sso && <Badge>SSO enforced</Badge>}
                        {row.jit_provisioning && (
                          <span className="text-muted-foreground">
                            Creates a login on first sign-in
                          </span>
                        )}
                        {row.idp_type === "oidc" && !row.has_client_secret && (
                          <span className="text-destructive">No client secret stored</span>
                        )}
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setForm({ open: true, editing: row })}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataPanel>
        </TabsContent>

        <TabsContent value="directory" className="mt-4">
          <ScimTokensPanel canManage={isAdmin} />
        </TabsContent>

        <TabsContent value="endpoints" className="mt-4">
          <DataPanel
            title="What your IdP administrator needs"
            description="Paths are relative to this API's public address."
            isLoading={serviceProvider.isLoading}
            error={serviceProvider.error?.detail ?? null}
            onRetry={serviceProvider.reload}
          >
            {serviceProvider.data && (
              <dl className="grid gap-4 p-5">
                <CopyableFact
                  label="SAML assertion consumer service (per provider)"
                  value={serviceProvider.data.saml_acs_url_template}
                  hint="Replace {provider_id} with the provider's id once it is created."
                />
                <CopyableFact
                  label="OIDC redirect URI"
                  value={serviceProvider.data.oidc_redirect_path}
                />
                <CopyableFact
                  label="SCIM base path"
                  value={serviceProvider.data.scim_base_path}
                  hint="Used with a directory token from the Directory sync tab."
                />
                <CopyableFact label="Workspace id" value={serviceProvider.data.tenant_id} />
              </dl>
            )}
          </DataPanel>
        </TabsContent>
      </Tabs>

      <ProviderDialog
        open={form.open}
        editing={form.editing}
        onOpenChange={(open) => setForm({ open, editing: open ? form.editing : null })}
        onSaved={providers.reload}
      />
    </PageShell>
  );
}

function CopyableFact({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied.");
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  };

  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-3 py-2 font-mono text-xs text-foreground">
          {value}
        </code>
        <Button variant="outline" size="sm" onClick={copy} aria-label={`Copy ${label}`}>
          <Copy />
        </Button>
      </dd>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
