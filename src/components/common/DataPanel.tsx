import type { LucideIcon } from "lucide-react";
import React from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The standard container for a list or table: header, optional toolbar, and
 * the loading / error / empty / content states handled in one place.
 *
 *   <DataPanel title="Runs" isLoading={isLoading} error={error?.detail}
 *              onRetry={reload} isEmpty={rows.length === 0}
 *              empty={{ icon: Calculator, title: "No runs yet" }}>
 *     <Table>…</Table>
 *   </DataPanel>
 */
export function DataPanel({
  title,
  description,
  actions,
  toolbar,
  footer,
  tier = "tier1",
  isLoading = false,
  error,
  onRetry,
  isEmpty = false,
  empty,
  loadingRows = 4,
  className,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  tier?: "tier1" | "tier2";
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  empty?: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode };
  loadingRows?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <div className="space-y-2 p-5">
        {Array.from({ length: loadingRows }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  } else if (error) {
    body = <ErrorState message={error} onRetry={onRetry} />;
  } else if (isEmpty && empty) {
    body = <EmptyState tier={tier} {...empty} />;
  } else {
    body = children;
  }

  return (
    <Card tier={tier} className={cn("gap-0 py-0", className)}>
      {(title || actions) && (
        <CardHeader className="border-b border-border py-4">
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
          {actions && <CardAction className="flex flex-wrap gap-2">{actions}</CardAction>}
        </CardHeader>
      )}
      {toolbar && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
          {toolbar}
        </div>
      )}
      <CardContent className="p-0">{body}</CardContent>
      {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
    </Card>
  );
}
