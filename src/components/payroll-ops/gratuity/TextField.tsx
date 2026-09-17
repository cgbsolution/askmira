"use client";

import React from "react";

import { FormField } from "@/components/common/FormField";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** A labelled text input for a configuration value; figures get tabular digits. */
export function TextField({
  id,
  label,
  value,
  onChange,
  hint,
  disabled,
  required = false,
  optional = false,
  numeric = false,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  optional?: boolean;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <FormField htmlFor={id} label={label} optional={optional} hint={hint} className={className}>
      <Input
        id={id}
        value={value}
        required={required}
        disabled={disabled}
        inputMode={numeric ? "decimal" : undefined}
        className={cn(numeric && "tabular-nums")}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}
