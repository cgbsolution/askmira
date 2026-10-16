import { ExternalLink, Lock, PackageX } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PRODUCTS } from "@/lib/access";
import type { ProductKey } from "@/lib/types";

/** Shown in place of a page the signed-in person may not open. */
export function AccessDenied({
  reason,
  product,
}: {
  reason: "role" | "module" | "product";
  /** With reason "product": the linked product that now does this work. */
  product?: ProductKey;
}) {
  if (reason === "product" && product) {
    const name = PRODUCTS[product].name;
    return (
      <Card tier="tier2" className="mx-auto mt-10 max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ExternalLink className="size-6" />
          </span>
          <div>
            <p className="font-semibold text-foreground">Your workspace uses {name} for this</p>
            <p className="mt-1 text-sm text-muted-foreground">
              It opens in a new tab, already signed in.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href={`/launch/${product}`} target="_blank" rel="noopener">
                <ExternalLink /> Open {name}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const Icon = reason === "module" ? PackageX : Lock;
  return (
    <Card tier="tier1" className="mx-auto mt-10 max-w-lg">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-6" />
        </span>
        <div>
          <p className="font-semibold text-foreground">
            {reason === "module"
              ? "This module is not switched on for your workspace"
              : "You don't have access to this page"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {reason === "module"
              ? "An admin can enable it under Settings → Modules."
              : "If you think you should, ask your admin to check your role."}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
