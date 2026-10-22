"use client";

import { Check } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A row of numbered steps joined by a line: done steps show a tick, the
 * current one is filled, later ones are outlined. A done step can be clicked
 * to go back to it; a later one cannot be jumped to.
 *
 * shadcn has no stepper of its own; this follows its conventions (new-york,
 * CSS variables, `data-slot`) so it sits with the other primitives.
 */
function Stepper({
  steps,
  current,
  onStepClick,
  className,
  ...props
}: Omit<React.ComponentProps<"ol">, "children"> & {
  steps: { title: string; description?: string }[];
  /** Zero-based index of the step on show. */
  current: number;
  /** Called with a done step's index when it is clicked. */
  onStepClick?: (index: number) => void;
}) {
  return (
    <ol
      data-slot="stepper"
      aria-label="Progress"
      className={cn("flex w-full items-start", className)}
      {...props}
    >
      {steps.map((step, index) => {
        const state = index < current ? "complete" : index === current ? "current" : "upcoming";
        const clickable = state === "complete" && Boolean(onStepClick);
        const marker = (
          <span
            data-slot="stepper-marker"
            className={cn(
              "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
              state === "complete" && "border-primary bg-primary text-primary-foreground",
              state === "current" && "border-primary bg-background text-primary ring-4 ring-primary/15",
              state === "upcoming" && "border-border bg-background text-muted-foreground",
            )}
          >
            {state === "complete" ? <Check className="size-4" /> : index + 1}
          </span>
        );
        const label = (
          <span className="mt-2 grid gap-0.5 px-1 text-center">
            <span
              className={cn(
                "text-xs font-semibold sm:text-sm",
                state === "upcoming" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {step.title}
            </span>
            {step.description && (
              <span className="hidden text-xs text-muted-foreground sm:block">
                {step.description}
              </span>
            )}
          </span>
        );
        return (
          <li
            key={step.title}
            data-slot="stepper-item"
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
            className="relative flex flex-1 flex-col items-center"
          >
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-[18px] right-1/2 left-[-50%] h-0.5 -translate-y-1/2",
                  index <= current ? "bg-primary" : "bg-border",
                )}
              />
            )}
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick?.(index)}
                className="flex flex-col items-center rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {marker}
                {label}
              </button>
            ) : (
              <>
                {marker}
                {label}
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export { Stepper };
