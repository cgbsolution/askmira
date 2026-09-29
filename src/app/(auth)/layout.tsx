import React from "react";

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
 * Fields on these pages are the tall 48px kind, set here once for every form
 * the shell holds rather than on each input.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-card">
      <main className="flex w-full flex-col lg:w-1/2">
        <div className="flex items-center gap-2.5 px-6 pt-6 lg:hidden">
          <BrandMark />
          <span className="font-display text-xl font-semibold">AskMira</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-md [&_[data-slot=input]]:h-12 [&_[data-slot=input]]:bg-muted/40">
            {children}
          </div>
        </div>
      </main>

      <aside className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-brand-700 lg:flex dark:bg-brand-900">
        <div aria-hidden className="auth-grid absolute inset-0">
          {FILLED_CELLS.map((position) => (
            <span key={position} className={`absolute size-[52px] bg-white/[0.06] ${position}`} />
          ))}
        </div>

        <div className="relative flex max-w-sm flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <BrandMark large />
            <span className="font-display text-4xl font-semibold tracking-tight text-white">
              AskMira
            </span>
          </div>
          <p className="mt-5 text-[15px] leading-relaxed text-white/65">
            Compliance you can prove. Culture you can see.
          </p>
        </div>

        <p className="absolute bottom-8 text-xs text-brand-200">Data hosted in India by default.</p>
      </aside>
    </div>
  );
}

function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <span
      className={
        large
          ? "flex size-12 items-center justify-center rounded-xl bg-accent text-xl font-bold text-accent-foreground"
          : "flex size-9 items-center justify-center rounded-lg bg-accent text-base font-bold text-accent-foreground"
      }
    >
      A
    </span>
  );
}
