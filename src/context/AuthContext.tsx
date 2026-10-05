"use client";

import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ApiError, get, post } from "@/lib/api";
import { roleAllows } from "@/lib/access";
import type { Audience, AuthResponse, AuthUser, Tenant } from "@/lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  tenant: Tenant | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, next?: string | null) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
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

export interface SignupInput {
  company_name: string;
  full_name: string;
  email: string;
  password: string;
  phone?: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const reloadSession = useCallback(async () => {
    try {
      const session = await get<{ user: AuthUser; tenant: Tenant }>("/auth/session", {
        skipAuthRedirect: true,
      });
      setUser(session.user);
      setTenant(session.tenant);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status === 401 || error.status === 403) {
        setUser(null);
        setTenant(null);
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
  }, []);

  const login = useCallback(
    async (email: string, password: string, next?: string | null) => {
      const response = await post<AuthResponse>(
        "/auth/login",
        { email, password },
        { skipAuthRedirect: true },
      );
      accept(response);
      router.push(safeNextPath(next));
    },
    [accept, router],
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      const response = await post<AuthResponse>("/auth/signup", input, { skipAuthRedirect: true });
      accept(response);
      router.push("/");
    },
    [accept, router],
  );

  const logout = useCallback(async () => {
    // The server clears the httpOnly cookies; the page cannot do that itself.
    await post("/auth/logout", undefined, { skipAuthRedirect: true }).catch(() => undefined);
    setUser(null);
    setTenant(null);
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
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      signup,
      logout,
      reloadSession,
      hasRole,
      hasModule,
    }),
    [user, tenant, isLoading, login, signup, logout, reloadSession, hasRole, hasModule],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside an AuthProvider");
  return context;
}
