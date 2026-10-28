import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * FieldSet / FieldLegend — shadcn/ui (new-york) Field primitives for a group of
 * related controls (a row of checkboxes, a set of weekdays) under one heading.
 *
 *   <FieldSet>
 *     <FieldLegend>Weekly off days</FieldLegend>
 *     …checkboxes…
 *   </FieldSet>
 */
function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...props}
    />
  );
}

function FieldLegend({ className, ...props }: React.ComponentProps<"legend">) {
  return <legend data-slot="field-legend" className={cn("mb-1 text-sm font-medium", className)} {...props} />;
}

export { FieldLegend, FieldSet };
