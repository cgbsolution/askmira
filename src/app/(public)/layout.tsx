import React from "react";

/**
 * Public shell for candidates: careers page, candidate portal, self-scheduling.
 *
 * No admin chrome and no session requirement — a visitor here has no account.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-brand-500 text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-4 py-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
            A
          </span>
          <span className="font-display text-lg font-semibold">Careers</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-border">
        <p className="mx-auto max-w-5xl px-4 py-4 text-xs text-muted-foreground">
          Powered by AskMira
        </p>
      </footer>
    </div>
  );
}
