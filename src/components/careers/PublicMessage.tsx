import type { LucideIcon } from "lucide-react";
import React from "react";

import { Card, CardContent } from "@/components/ui/card";

/** A friendly full-width message for candidate-facing pages (expired link, not found, error). */
export function PublicMessage({
  icon: Icon,
  title,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  return (
    <Card tier="tier2" className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-mint-100 text-brand-600">
          <Icon className="size-6" />
        </span>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
