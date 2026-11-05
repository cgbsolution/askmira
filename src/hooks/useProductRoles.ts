"use client";

import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { ProductRoles } from "@/lib/access";

const NONE: ProductRoles = {};

/**
 * The signed-in person's role in each linked product that says who is who there:
 * Saleinx and ProcureFlow roles, and the helpdesk's IT team (engineer, admin).
 * Read from the product's last people sync; the product checks again itself.
 */
export function useProductRoles(): ProductRoles {
  const { tenant } = useAuth();
  const linked = Object.values(tenant?.linked_products ?? {}).some(Boolean);
  const { data } = useApiQuery<{ roles: ProductRoles }>(
    linked ? "/products/roles/me" : null,
  );
  return data?.roles ?? NONE;
}
