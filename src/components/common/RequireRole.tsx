"use client";

import React from "react";

import { useAuth } from "@/context/AuthContext";
import type { Audience } from "@/lib/types";

/**
 * Renders its children only for the given roles.
 *
 * For hiding an action the person cannot take — an "Approve" button, an admin
 * tab. It is presentation, not protection: the API refuses the request anyway.
 */
export function RequireRole({
  roles,
  children,
  fallback = null,
}: {
  roles: Audience[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasRole } = useAuth();
  return <>{hasRole(...roles) ? children : fallback}</>;
}
