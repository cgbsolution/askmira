import React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";

const SIZE = {
  sm: { avatar: "size-7", fallback: "text-[10px]", name: "text-sm" },
  md: { avatar: "size-9", fallback: "text-xs", name: "text-sm" },
  lg: { avatar: "size-12", fallback: "text-sm", name: "text-base" },
} as const;

/** A person as shown everywhere in the portal: avatar, name, and one line under it. */
export function PersonCell({
  name,
  photoUrl,
  subtitle,
  size = "md",
  className,
}: {
  name: string;
  photoUrl?: string | null;
  subtitle?: React.ReactNode;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const s = SIZE[size];
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar className={s.avatar}>
        {photoUrl && <AvatarImage src={photoUrl} alt="" />}
        <AvatarFallback className={s.fallback}>{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className={cn("truncate font-medium text-foreground", s.name)}>{name}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
