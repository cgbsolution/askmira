import React from "react";

/**
 * Split auth shell: a solid Deep Teal brand panel beside the form.
 *
 * Tier 1 treatment — this is the trust surface, so it stays flat and precise
 * rather than adopting the soft, rounded warmth of the culture screens.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="relative hidden w-[45%] flex-col justify-between bg-brand-500 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-base font-bold text-accent-foreground">
            A
          </span>
          <span className="font-display text-xl font-semibold">AskMira</span>
        </div>

        <div className="max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight">
            Compliance you can prove. Culture you can see.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-brand-100">
            India-native statutory payroll, an AI-native people layer, and the analytics to
            connect them — built for companies of 100 to 1,000.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-brand-100">
            {[
              "PF, ESI, Professional Tax and TDS, versioned by effective date",
              "Recognition and clubs, tied to the employee record",
              "Every AI-assisted action written to an immutable audit trail",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-brand-200">Data hosted in India by default.</p>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
