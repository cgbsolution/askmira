import React from "react";

import { AskMiraLogo } from "@/components/brand/AskMiraLogo";

/** Cells filled in on the brand panel — multiples of the 52px grid, so they sit on its lines. */
const FILLED_CELLS = [
  "left-[208px] top-[364px]",
  "left-[260px] top-[416px]",
  "left-[468px] top-[312px]",
  "left-[572px] top-[468px]",
  "left-[104px] top-[468px]",
  "left-[364px] top-[260px]",
];

/**
 * Split auth shell: the form on the left half, the brand on the right.
 *
 * The brand panel is the ink of the nav rail — the logo's own dark-background
 * treatment. Fields on these pages are the tall 48px kind, set here once for
 * every form the shell holds rather than on each input.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-card">
      <main className="flex w-full flex-col lg:w-1/2">
        <div className="flex items-center px-6 pt-6 lg:hidden">
          <AskMiraLogo priority className="h-10" />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-md [&_[data-slot=input]]:h-12 [&_[data-slot=input]]:bg-muted/40">
            {children}
          </div>
        </div>
      </main>

      <aside className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-sidebar lg:flex">
        <div aria-hidden className="auth-grid absolute inset-0">
          {FILLED_CELLS.map((position) => (
            <span key={position} className={`absolute size-[52px] bg-white/[0.06] ${position}`} />
          ))}
        </div>

        <div className="relative flex max-w-sm flex-col items-center text-center">
          <AskMiraLogo priority className="h-24" />
          <p className="mt-6 text-[15px] leading-relaxed text-white/70">
            Compliance you can prove. Culture you can see.
          </p>
        </div>

        <p className="absolute bottom-8 text-xs text-sidebar-muted">Data hosted in India by default.</p>
      </aside>
    </div>
  );
}
