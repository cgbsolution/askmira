"use client";

import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { clearTokens, post, setTokens, USER_KEY, getToken } from "@/lib/api";
import type { AuthResponse, AuthUser, Tenant, UserRole } from "@/lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  tenant: Tenant | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => void;
  /** True when the user holds any of the given roles. Platform admin passes always. */
  hasRole: (...roles: UserRole[]) => boolean;
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

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Rehydrate from the cookie on mount so a refresh does not bounce the user
  // to sign-in while the first API call is still in flight.
  useEffect(() => {
    try {
      const cached = Cookies.get(USER_KEY);
      if (cached && getToken()) {
        const parsed = JSON.parse(cached) as { user: AuthUser; tenant: Tenant };
        setUser(parsed.user);
        setTenant(parsed.tenant);
      }
    } catch {
      // Corrupt cookie — treat as signed out rather than crashing the shell.
      clearTokens();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persist = useCallback((response: AuthResponse) => {
    setTokens(response.access_token, response.refresh_token, response.expires_in);
    Cookies.set(USER_KEY, JSON.stringify({ user: response.user, tenant: response.tenant }), {
      expires: 30,
      sameSite: "lax",
    });
    setUser(response.user);
    setTenant(response.tenant);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await post<AuthResponse>(
        "/auth/login",
        { email, password },
        { skipAuth: true },
      );
      persist(response);
      router.push("/");
    },
    [persist, router],
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      const response = await post<AuthResponse>("/auth/signup", input, { skipAuth: true });
      persist(response);
      router.push("/");
    },
    [persist, router],
  );

  const logout = useCallback(() => {
    // Fire-and-forget: the token is stateless, so a failed call here must not
    // prevent the user from signing out locally.
    void post("/auth/logout").catch(() => undefined);
    clearTokens();
    setUser(null);
    setTenant(null);
    router.push("/signin");
  }, [router]);

  const hasRole = useCallback(
    (...roles: UserRole[]) =>
      user ? user.role === "platform_admin" || roles.includes(user.role) : false,
    [user],
  );

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
      hasRole,
      hasModule,
    }),
    [user, tenant, isLoading, login, signup, logout, hasRole, hasModule],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside an AuthProvider");
  return context;
}
