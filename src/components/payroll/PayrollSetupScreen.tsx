"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import React from "react";

import { PageShell } from "@/components/common/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { PAYROLL_SETUP } from "@/lib/access";
import { useT } from "@/lib/i18n";

/**
 * /payroll/setup — payroll's set-up pages in one place, so the menu keeps to
 * the monthly cycle (runs, salaries, adjustments, filings, bank files).
 */
export function PayrollSetupScreen() {
  const t = useT();
  return (
    <PageShell
      title="Payroll setup"
      description="Set up once, changed a few times a year: structures, statutory rules, accounting and the pay programmes."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PAYROLL_SETUP.map((page) => (
          <Link
            key={page.path}
            href={page.path}
            className="group rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Card tier="tier1" className="h-full transition-colors group-hover:border-primary/40">
              <CardContent className="flex items-start gap-3">
                <div className="grid flex-1 gap-1">
                  <p className="font-semibold">{t(page.name)}</p>
                  <p className="text-sm text-muted-foreground">{page.description}</p>
                </div>
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
