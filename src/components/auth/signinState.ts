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
