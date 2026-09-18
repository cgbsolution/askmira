/**
 * Single sign-on and directory sync, as the API exposes it.
 *
 * Mirrors `app/api/v1/routers/sso.py`. Note what is absent: there is no read
 * path for a client secret or a SCIM token anywhere in these types, because
 * there is none in the API.
 */

export type IdpType = "saml" | "oidc";

export interface IdentityProvider {
  id: string;
  name: string;
  idp_type: IdpType;
  enabled: boolean;

  /** SAML. */
  entity_id: string | null;
  sso_url: string | null;

  /** OIDC. */
  issuer: string | null;
  discovery_url: string | null;
  client_id: string | null;

  /**
   * When true, only the break-glass account may still sign in with a password.
   * A provider cannot enforce this until a break-glass account is designated.
   */
  enforce_sso: boolean;
  /** Empty means any domain. */
  allowed_email_domains: string[];
  /** Create a login on first successful sign-in rather than requiring it up front. */
  jit_provisioning: boolean;
  /** Whether a secret is stored — never the secret itself. */
  has_client_secret: boolean;
}

export interface ServiceProviderDetails {
  saml_acs_url_template: string;
  oidc_redirect_path: string;
  scim_base_path: string;
  tenant_id: string;
  note: string;
}

export interface ScimToken {
  id: string;
  name: string;
  /** The last few characters, so a token can be recognised without being readable. */
  hint: string;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface ScimTokenCreated extends ScimToken {
  /** Returned once, on creation, and never again. */
  token: string;
}
