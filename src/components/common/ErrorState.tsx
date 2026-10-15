import { AlertTriangle, RotateCw } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import { Tr } from "@/lib/i18n/Tr";
import { cn } from "@/lib/utils";

/** A failed load, said plainly, with a way to try again. */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-3 px-6 py-14 text-center", className)}
    >
      <span className="flex size-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </span>
      <div className="max-w-md">
        <p className="font-medium text-foreground">
          <Tr text="This could not be loaded" />
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> <Tr text="Try again" />
        </Button>
      )}
    </div>
  );
}
