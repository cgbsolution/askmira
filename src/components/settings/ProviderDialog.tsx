"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch, post } from "@/lib/api";
import type { TenantSettings } from "@/lib/types/admin";
import type { IdentityProvider, IdpType } from "@/lib/types/sso";

import { errorDetail } from "./settingsShared";

interface Values {
  name: string;
  idp_type: IdpType;
  enabled: boolean;
  entity_id: string;
  sso_url: string;
  slo_url: string;
  x509_cert: string;
  issuer: string;
  discovery_url: string;
  client_id: string;
  enforce_sso: boolean;
  allowed_email_domains: string;
  jit_provisioning: boolean;
}

const EMPTY: Values = {
  name: "",
  idp_type: "oidc",
  enabled: true,
  entity_id: "",
  sso_url: "",
  slo_url: "",
  x509_cert: "",
  issuer: "",
  discovery_url: "",
  client_id: "",
  enforce_sso: false,
  allowed_email_domains: "",
  jit_provisioning: true,
};

/**
 * Create or edit an identity provider.
 *
 * `enforce_sso` is gated here as well as on the API: without a break-glass
 * account, turning it on is a lockout waiting for an IdP outage, so the switch
 * is disabled with the reason attached rather than allowed and then refused.
 * The client secret is write-only everywhere — omitted on save keeps the
 * stored one.
 */
export function ProviderDialog({
  open,
  editing,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editing: IdentityProvider | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const tenant = useApiQuery<TenantSettings>(open ? "/admin/tenant" : null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [clientSecret, setClientSecret] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const breakGlassSet = Boolean(tenant.data?.settings?.break_glass_email);

  useEffect(() => {
    if (!open) return;
    setClientSecret("");
    setValues(
      editing
        ? {
            name: editing.name,
            idp_type: editing.idp_type,
            enabled: editing.enabled,
            entity_id: editing.entity_id ?? "",
            sso_url: editing.sso_url ?? "",
            // Neither is returned by the API; blank means "leave as it is".
            slo_url: "",
            x509_cert: "",
            issuer: editing.issuer ?? "",
            discovery_url: editing.discovery_url ?? "",
            client_id: editing.client_id ?? "",
            enforce_sso: editing.enforce_sso,
            allowed_email_domains: editing.allowed_email_domains.join(", "),
            jit_provisioning: editing.jit_provisioning,
          }
        : EMPTY,
    );
  }, [open, editing]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const isSaml = values.idp_type === "saml";

  const domains = values.allowed_email_domains
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  const blank = (value: string) => (value.trim() === "" ? undefined : value.trim());

  const submit = async () => {
    setIsBusy(true);
    const common = {
      name: values.name.trim(),
      enabled: values.enabled,
      enforce_sso: values.enforce_sso,
      allowed_email_domains: domains,
      jit_provisioning: values.jit_provisioning,
      ...(isSaml
        ? {
            entity_id: blank(values.entity_id),
            sso_url: blank(values.sso_url),
            slo_url: blank(values.slo_url),
            x509_cert: blank(values.x509_cert),
          }
        : {
            issuer: blank(values.issuer),
            discovery_url: blank(values.discovery_url),
            client_id: blank(values.client_id),
          }),
      // Omitted keeps the stored secret; only a typed one replaces it.
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    };
    try {
      if (editing) {
        await patch(`/sso/providers/${editing.id}`, common);
        toast.success("Provider updated.");
      } else {
        await post("/sso/providers", { ...common, idp_type: values.idp_type });
        toast.success("Provider created.");
      }
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the provider."));
    } finally {
      setIsBusy(false);
    }
  };

  const incomplete = isSaml
    ? !values.name.trim() || (!editing && (!values.entity_id.trim() || !values.sso_url.trim()))
    : !values.name.trim() || (!editing && !values.issuer.trim() && !values.discovery_url.trim());

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "Add an identity provider"}</DialogTitle>
          <DialogDescription>
            Roles are always assigned in AskMira — there is no mapping from an IdP role or group
            claim, by design.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="provider-name" label="Display name">
            <Input
              id="provider-name"
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Acme Azure AD"
            />
          </FormField>
          <FormField
            htmlFor="provider-type"
            label="Protocol"
            hint={editing ? "The protocol cannot be changed after creation." : undefined}
          >
            <Select
              value={values.idp_type}
              onValueChange={(next) => set("idp_type", next as IdpType)}
              disabled={editing !== null}
            >
              <SelectTrigger id="provider-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oidc">OpenID Connect</SelectItem>
                <SelectItem value="saml">SAML 2.0</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          {isSaml ? (
            <>
              <FormField htmlFor="provider-entity" label="IdP entity id">
                <Input
                  id="provider-entity"
                  value={values.entity_id}
                  onChange={(event) => set("entity_id", event.target.value)}
                  className="font-mono text-xs"
                />
              </FormField>
              <FormField htmlFor="provider-sso-url" label="Sign-in URL">
                <Input
                  id="provider-sso-url"
                  value={values.sso_url}
                  onChange={(event) => set("sso_url", event.target.value)}
                  className="font-mono text-xs"
                />
              </FormField>
              <FormField htmlFor="provider-slo-url" label="Sign-out URL" optional>
                <Input
                  id="provider-slo-url"
                  value={values.slo_url}
                  onChange={(event) => set("slo_url", event.target.value)}
                  className="font-mono text-xs"
                  placeholder={editing ? "Leave blank to keep the stored one" : ""}
                />
              </FormField>
              <FormField
                htmlFor="provider-cert"
                label="Signing certificate (PEM)"
                optional={editing !== null}
                className="sm:col-span-2"
                hint={
                  editing
                    ? "Leave blank to keep the stored certificate."
                    : "Assertions are rejected unless signed by this certificate."
                }
              >
                <Textarea
                  id="provider-cert"
                  value={values.x509_cert}
                  onChange={(event) => set("x509_cert", event.target.value)}
                  rows={4}
                  className="font-mono text-[11px]"
                  placeholder="-----BEGIN CERTIFICATE-----"
                />
              </FormField>
            </>
          ) : (
            <>
              <FormField htmlFor="provider-issuer" label="Issuer">
                <Input
                  id="provider-issuer"
                  value={values.issuer}
                  onChange={(event) => set("issuer", event.target.value)}
                  className="font-mono text-xs"
                  placeholder="https://login.microsoftonline.com/…/v2.0"
                />
              </FormField>
              <FormField htmlFor="provider-discovery" label="Discovery URL" optional>
                <Input
                  id="provider-discovery"
                  value={values.discovery_url}
                  onChange={(event) => set("discovery_url", event.target.value)}
                  className="font-mono text-xs"
                  placeholder="…/.well-known/openid-configuration"
                />
              </FormField>
              <FormField htmlFor="provider-client-id" label="Client id">
                <Input
                  id="provider-client-id"
                  value={values.client_id}
                  onChange={(event) => set("client_id", event.target.value)}
                  className="font-mono text-xs"
                />
              </FormField>
              <FormField
                htmlFor="provider-client-secret"
                label="Client secret"
                optional={editing !== null}
                hint={
                  editing?.has_client_secret
                    ? "A secret is stored. Leave blank to keep it."
                    : "Stored encrypted; no endpoint ever returns it."
                }
              >
                <Input
                  id="provider-client-secret"
                  type="password"
                  value={clientSecret}
                  onChange={(event) => setClientSecret(event.target.value)}
                  placeholder={editing?.has_client_secret ? "••••••••" : ""}
                  autoComplete="new-password"
                />
              </FormField>
            </>
          )}

          <FormField
            htmlFor="provider-domains"
            label="Allowed email domains"
            optional
            className="sm:col-span-2"
            hint="Comma separated. Empty means any domain the provider vouches for."
          >
            <Input
              id="provider-domains"
              value={values.allowed_email_domains}
              onChange={(event) => set("allowed_email_domains", event.target.value)}
              placeholder="acme.com, acme.co.in"
            />
          </FormField>

          <div className="flex flex-col gap-3 sm:col-span-2">
            <div className="flex items-center gap-3">
              <Switch
                id="provider-enabled"
                checked={values.enabled}
                onCheckedChange={(next) => set("enabled", next)}
              />
              <Label htmlFor="provider-enabled" className="text-sm font-normal">
                Enabled. A disabled provider keeps its configuration but is not offered at sign-in.
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="provider-jit"
                checked={values.jit_provisioning}
                onCheckedChange={(next) => set("jit_provisioning", next)}
              />
              <Label htmlFor="provider-jit" className="text-sm font-normal">
                Create a login the first time somebody signs in successfully. They arrive as an
                employee; roles are granted here.
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="provider-enforce"
                checked={values.enforce_sso}
                disabled={!breakGlassSet && !values.enforce_sso}
                onCheckedChange={(next) => set("enforce_sso", next)}
              />
              <Label htmlFor="provider-enforce" className="text-sm font-normal">
                Require SSO. Passwords stop working for everyone except the break-glass account.
              </Label>
            </div>
          </div>

          {!breakGlassSet && (
            <Alert className="sm:col-span-2">
              <TriangleAlert />
              <AlertTitle>Designate a break-glass account before enforcing SSO</AlertTitle>
              <AlertDescription>
                Without one, an identity provider outage locks the whole workspace out with no way
                back in. The API refuses enforcement until it is set.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || incomplete}>
            {isBusy && <Loader2 className="animate-spin" />}
            {editing ? "Save changes" : "Create provider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
