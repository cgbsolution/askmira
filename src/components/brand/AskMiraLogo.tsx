import Image from "next/image";

import { cn } from "@/lib/utils";

/*
 * The AskMira brand, drawn from the vector files in public/brand (traced from
 * the brand kit). One logo works on every surface: the red "Ask" bubble and
 * marigold "Mira" read on cream, white and the ink rail alike.
 *
 * Size them with a height class (`h-9`); the width follows the artwork.
 */

/** The full "Ask Mira" logo: red speech bubble plus marigold wordmark. */
export function AskMiraLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/askmira-logo.svg"
      alt="AskMira"
      width={1010}
      height={340}
      priority={priority}
      unoptimized
      className={cn("h-9 w-auto select-none", className)}
    />
  );
}

/**
 * The icon mark: the red bubble with an "A". For tight spaces — the collapsed
 * rail, small headers, and as Ask Mira's own avatar. Decorative by default;
 * pass `label` when it stands alone as the brand.
 */
export function AskMiraMark({ className, label }: { className?: string; label?: string }) {
  return (
    <Image
      src="/brand/askmira-mark.svg"
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      width={125}
      height={141}
      unoptimized
      className={cn("h-9 w-auto select-none", className)}
    />
  );
}
