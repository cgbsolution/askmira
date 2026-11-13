/**
 * What step one of sign-in hands to step two: the email or mobile typed, kept
 * in this tab's session storage rather than in the address bar, where it would
 * land in history and logs.
 */
const LOGIN_KEY = "askmira_signin_login";

export function rememberLogin(value: string): void {
  try {
    window.sessionStorage.setItem(LOGIN_KEY, value);
  } catch {
    // A browser that refuses storage just asks again on step two.
  }
}

export function recalledLogin(): string {
  try {
    return window.sessionStorage.getItem(LOGIN_KEY) ?? "";
  } catch {
    return "";
  }
}

interface PasswordCredentialConstructor {
  new (data: { id: string; password: string; name?: string }): Credential;
}

/**
 * Asks the browser to offer "Save password?" for a password that was just
 * accepted. Sign-in posts with `fetch`, so a browser cannot always tell that a
 * sign-in happened; the Credential Management API tells it outright (Chrome,
 * Edge). Elsewhere the form's `autocomplete` attributes still let it offer.
 * The browser keeps one entry per email, so each workspace's login is saved
 * and filled in separately.
 */
export function offerToSavePassword(login: string, password: string, name?: string): void {
  try {
    const Credential = (window as unknown as { PasswordCredential?: PasswordCredentialConstructor })
      .PasswordCredential;
    if (!Credential || !navigator.credentials?.store || !login || !password) return;
    void navigator.credentials.store(new Credential({ id: login, password, name })).catch(() => undefined);
  } catch {
    // A browser without it, or one that refuses: nothing to do.
  }
}

export interface WorkspaceBranding {
  name: string;
  workspace: string;
  logo_url: string | null;
  sso: {
    provider_id: string;
    name: string;
    type: "oidc" | "saml";
    required: boolean;
    start_url: string;
  } | null;
  social: string[];
}

export const SOCIAL_LABEL: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
};
