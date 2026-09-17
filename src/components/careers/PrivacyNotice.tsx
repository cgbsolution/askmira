import React from "react";

/**
 * The organisation's privacy notice as plain paragraphs, with the retention
 * period. No hooks, so it renders on the server page and inside the apply form.
 */
export function PrivacyNotice({
  paragraphs,
  retentionDays,
  version,
  className,
}: {
  paragraphs: string[];
  retentionDays: number;
  version?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Application data is kept for <span className="tabular-nums">{retentionDays}</span> days
        {version ? ` · Notice version ${version}` : ""}.
      </p>
    </div>
  );
}
