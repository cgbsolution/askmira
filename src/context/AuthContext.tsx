"use client";

import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { ApiError, get, post } from "@/lib/api";
import { roleAllows } from "@/lib/access";
import type { Audience, AuthResponse, AuthUser, CompanyBrand, SavedAccount, Tenant } from "@/lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  tenant: Tenant | null;
  /** The company they work for (their legal entity), drawn at the top of the navigation. */
  company: CompanyBrand | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /**
   * Signs in. With two-step sign-in on, resolves to the token for the second
   * step instead of signing in; finish with `completeMfa`.
   */
  login: (
    login: string,
    password: string,
    next?: string | null,
    workspace?: string | null,
  ) => Promise<{ mfaToken: string } | null>;
  /** The second step: the token from `login` and a code from the authenticator app. */
  completeMfa: (mfaToken: string, code: string, next?: string | null) => Promise<void>;
  /** Take a session another provider completed (SSO, Google, Microsoft) and open the portal. */
  completeExternal: (response: AuthResponse, next?: string | null) => void;
  /** Sign out of this account here; `everyAccount` also signs out every other account saved on this browser. */
  logout: (options?: { everyAccount?: boolean }) => Promise<void>;
  /** The accounts signed in on this browser, for the account switcher. */
  savedAccounts: () => Promise<SavedAccount[]>;
  /**
   * Make another account signed in on this browser the active one, then open
   * `next` (home by default) with a full page load, so nothing from the
   * previous workspace stays on screen. Rejects with the server's reason.
   */
  switchAccount: (userId: string, next?: string | null) => Promise<void>;
  /** Re-read the signed-in user and workspace from the server. */
  reloadSession: () => Promise<void>;
  /**
   * True when the user holds any of the given roles, or `manager` is listed and
   * somebody reports to them. Super admin passes always.
   */
  hasRole: (...roles: Audience[]) => boolean;
  /** True when the workspace has this module switched on. */
  hasModule: (module: string) => boolean;
}

/** Cookies from the earlier client, which kept tokens where scripts could read them. */
const LEGACY_COOKIES = ["askmira_token", "askmira_refresh", "askmira_user"];

/**
 * Only same-origin, path-only destinations after sign-in.
 *
 * `?next=https://evil.example` or `//evil.example` would otherwise turn the
 * sign-in page into an open redirect for phishing.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Every tab shares the browser's session cookies, so when one tab switches
 * account, signs in or signs out, the others are suddenly someone else. They
 * are told here and reload — a page left showing one workspace's data while
 * its requests go to another would be the worst kind of confusing.
 */
const SESSION_CHANNEL = "askmira-session";

interface SessionMessage {
  /** Who is signed in now; null after a sign-out. */
  userId: string | null;
}

function announceSession(userId: string | null): void {
  try {
    const channel = new BroadcastChannel(SESSION_CHANNEL);
    channel.postMessage({ userId } satisfies SessionMessage);
    channel.close();
  } catch {
    // No BroadcastChannel (very old browser): other tabs find out on their next request.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [company, setCompany] = useState<CompanyBrand | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);

  const reloadSession = useCallback(async () => {
    try {
      const session = await get<{ user: AuthUser; tenant: Tenant; company?: CompanyBrand | null }>(
        "/auth/session",
        { skipAuthRedirect: true },
      );
      setUser(session.user);
      setTenant(session.tenant);
      setCompany(session.company ?? null);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status === 401 || error.status === 403) {
        setUser(null);
        setTenant(null);
        setCompany(null);
      }
    }
  }, []);

  // The session is whatever the server says it is — never a copy the page kept.
  useEffect(() => {
    LEGACY_COOKIES.forEach((name) => Cookies.remove(name));
    // A scanned showcase QR code is a public sandbox: no session to look for,
    // and asking would only put a 401 in every visitor's console.
    if (window.location.pathname.startsWith("/showcase/")) {
      setIsLoading(false);
      return;
    }
    void reloadSession().finally(() => setIsLoading(false));
  }, [reloadSession]);

  // Another tab changed who is signed in: follow it, from home, not this page.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(SESSION_CHANNEL);
    channel.onmessage = (event: MessageEvent<SessionMessage>) => {
      const signedInHere = userIdRef.current;
      if (signedInHere === null || event.data?.userId === signedInHere) return;
      window.location.assign(event.data?.userId ? "/" : "/signin");
    };
    return () => channel.close();
  }, []);

  const accept = useCallback((response: AuthResponse) => {
    setUser(response.user);
    setTenant(response.tenant);
    setCompany(response.company ?? null);
    announceSession(response.user.id);
  }, []);

  const login = useCallback(
    async (identifier: string, password: string, next?: string | null, workspace?: string | null) => {
      const response = await post<AuthResponse | { mfa_required: true; mfa_token: string }>(
        "/auth/login",
        { login: identifier, password, workspace: workspace ?? null },
        { skipAuthRedirect: true },
      );
      if ("mfa_required" in response && response.mfa_required) {
        return { mfaToken: response.mfa_token };
      }
      accept(response as AuthResponse);
      router.push(safeNextPath(next));
      return null;
    },
    [accept, router],
  );

  const completeMfa = useCallback(
    async (mfaToken: string, code: string, next?: string | null) => {
      const response = await post<AuthResponse>(
        "/auth/login/mfa",
        { mfa_token: mfaToken, code },
        { skipAuthRedirect: true },
      );
      accept(response);
      router.push(safeNextPath(next));
    },
    [accept, router],
  );

  const completeExternal = useCallback(
    (response: AuthResponse, next?: string | null) => {
      accept(response);
      router.push(safeNextPath(next));
    },
    [accept, router],
  );

  const logout = useCallback(
    async (options?: { everyAccount?: boolean }) => {
      // The server clears the httpOnly cookies; the page cannot do that itself.
      const query = options?.everyAccount ? "?every_account=true" : "";
      await post(`/auth/logout${query}`, undefined, { skipAuthRedirect: true }).catch(() => undefined);
      setUser(null);
      setTenant(null);
      setCompany(null);
      announceSession(null);
      // Accounts still signed in here are offered on the sign-in page.
      router.push("/signin");
    },
    [router],
  );

  const savedAccounts = useCallback(async () => {
    const result = await get<{ accounts: SavedAccount[] }>("/auth/accounts", { skipAuthRedirect: true });
    return result.accounts;
  }, []);

  const switchAccount = useCallback(async (userId: string, next?: string | null) => {
    const response = await post<AuthResponse>(
      "/auth/accounts/switch",
      { user_id: userId },
      { skipAuthRedirect: true },
    );
    announceSession(response.user.id);
    // A full load: every list, cache and open form belonged to the other account.
    window.location.assign(safeNextPath(next));
  }, []);

  const hasRole = useCallback((...roles: Audience[]) => roleAllows(user, roles), [user]);

  const hasModule = useCallback(
    (module: string) => Boolean(tenant?.enabled_modules?.[module]),
    [tenant],
  );

  const value = useMemo(
    () => ({
      user,
      tenant,
      company,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      completeMfa,
      completeExternal,
      logout,
      savedAccounts,
      switchAccount,
      reloadSession,
      hasRole,
      hasModule,
    }),
    [
      user,
      tenant,
      company,
      isLoading,
      login,
      completeMfa,
      completeExternal,
      logout,
      savedAccounts,
      switchAccount,
      reloadSession,
      hasRole,
      hasModule,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside an AuthProvider");
  return context;
}

/** The session when there is one, for shared components that also appear on public pages. */
export function useOptionalAuth(): AuthContextValue | undefined {
  return useContext(AuthContext);
}
