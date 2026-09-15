import { Lock, PackageX } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Shown in place of a page the signed-in person may not open. */
export function AccessDenied({ reason }: { reason: "role" | "module" }) {
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
              : "If you think you should, ask your HR admin to check your role."}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
