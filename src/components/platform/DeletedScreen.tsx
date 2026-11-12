"use client";

import { Archive } from "lucide-react";
import React from "react";

import { PageShell } from "@/components/common/PageShell";

import { DeletedWorkspacesPanel } from "./PlatformConsole";

/** Platform → Deleted organisations: each one's data until its purge date. */
export function DeletedScreen() {
  return (
    <PageShell
      title="Deleted organisations"
      eyebrow="Platform console"
      icon={Archive}
      description="Kept for 90 days after deletion so the data can be handed back to the company, then purged."
    >
      <DeletedWorkspacesPanel />
    </PageShell>
  );
}
