"use client";

import { Eye, EyeOff, Lock, type LucideIcon } from "lucide-react";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * An Input with an icon inside its left edge, and room for one control at the
 * right (a show-password toggle, say).
 */
export function IconInput({
  icon: Icon,
  trailing,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { icon: LucideIcon; trailing?: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground"
      />
      <Input className={cn("pl-10", trailing && "pr-11", className)} {...props} />
      {trailing && <div className="absolute top-1/2 right-1.5 -translate-y-1/2">{trailing}</div>}
    </div>
  );
}

/** A password field with a lock icon and a show/hide toggle. */
export function PasswordInput(props: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <IconInput
      icon={Lock}
      type={visible ? "text" : "password"}
      trailing={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setVisible((previous) => !previous)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="text-muted-foreground"
        >
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      }
      {...props}
    />
  );
}
