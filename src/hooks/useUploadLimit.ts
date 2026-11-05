"use client";

import { useOptionalAuth } from "@/context/AuthContext";
import { DEFAULT_UPLOAD_MB, sizeLabel, tooLarge } from "@/lib/uploads";

export interface UploadLimit {
  /** The largest file anyone in this workspace can upload, in MB. */
  mb: number;
  bytes: number;
  /** "10 MB", for hints such as "PDF, PNG or JPEG, up to 10 MB". */
  label: string;
  /** Why this file is too large, or null when it fits. */
  check: (file: File) => string | null;
}

/**
 * The workspace's upload limit, set by its admin under Settings → Company →
 * Workspace and carried by the session. Pages without a signed-in workspace
 * (public careers pages) get the default unless they pass their own `mb`.
 */
export function useUploadLimit(mb?: number): UploadLimit {
  const auth = useOptionalAuth();
  const value = mb ?? auth?.tenant?.max_upload_mb ?? DEFAULT_UPLOAD_MB;
  const bytes = value * 1024 * 1024;
  return { mb: value, bytes, label: sizeLabel(bytes), check: (file) => tooLarge(file, bytes) };
}
