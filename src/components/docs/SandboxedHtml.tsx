import React from "react";

import { cn } from "@/lib/utils";

/**
 * Letter HTML, shown the only way the portal shows it: inside a sandboxed frame.
 *
 * `sandbox=""` grants nothing — no scripts, no forms, no same-origin access, no
 * navigation — so template markup can never reach the portal's DOM or session.
 */
export function SandboxedHtml({
  html,
  title,
  className,
}: {
  html: string;
  title: string;
  className?: string;
}) {
  const document = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;background:white;color:black}
table{border-collapse:collapse}td,th{padding:4px 8px}
</style></head><body>${html}</body></html>`;
  return (
    <iframe
      sandbox=""
      srcDoc={document}
      title={title}
      referrerPolicy="no-referrer"
      className={cn("h-[60vh] w-full rounded-lg border border-border bg-card", className)}
    />
  );
}
