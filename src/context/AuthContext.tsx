"use client";

import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ApiError, get, post } from "@/lib/api";
import { roleAllows } from "@/lib/access";
import type { Audience, AuthResponse, AuthUser, CompanyBrand, Tenant } from "@/lib/types";

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
  logout: () => Promise<void>;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [company, setCompany] = useState<CompanyBrand | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

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
    void reloadSession().finally(() => setIsLoading(false));
  }, [reloadSession]);

  const accept = useCallback((response: AuthResponse) => {
    setUser(response.user);
    setTenant(response.tenant);
    setCompany(response.company ?? null);
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

  const logout = useCallback(async () => {
    // The server clears the httpOnly cookies; the page cannot do that itself.
    await post("/auth/logout", undefined, { skipAuthRedirect: true }).catch(() => undefined);
    setUser(null);
    setTenant(null);
    setCompany(null);
    router.push("/signin");
  }, [router]);

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
