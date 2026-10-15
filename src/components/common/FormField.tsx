import React from "react";

import { Label } from "@/components/ui/label";
import { Tr } from "@/lib/i18n/Tr";
import { cn } from "@/lib/utils";

/**
 * One labelled form control, with an optional hint and error.
 *
 * Wraps any shadcn control (Input, Select, Textarea, Switch…). Pass the same
 * `id` to the control that you pass here as `htmlFor`, so the label is clickable
 * and screen readers announce it.
 */
export function FormField({
  htmlFor,
  label,
  hint,
  error,
  optional = false,
  required = false,
  className,
  children,
}: {
  htmlFor: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  /** Marks the label with an asterisk. The control still needs its own `required`. */
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn("grid content-start gap-1.5", className)} aria-describedby={describedBy}>
      <Label htmlFor={htmlFor}>
        {typeof label === "string" ? <Tr text={label} /> : label}
        {optional && (
          <span className="font-normal text-muted-foreground">
            (<Tr text="optional" />)
          </span>
        )}
        {required && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {typeof hint === "string" ? <Tr text={hint} /> : hint}
        </p>
      ) : null}
    </div>
  );
}
