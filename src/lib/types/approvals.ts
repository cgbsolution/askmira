/** The unified approvals inbox. Mirrors `backend/app/schemas/approvals.py`. */

export interface ApprovalItem {
  source: string;
  source_label: string;
  id: string;
  title: string;
  subject_name: string | null;
  detail: string | null;
  submitted_at: string;
  due_on: string | null;
  /** The page where this is decided. The owning module stays the authority. */
  link: string;
}

export interface ApprovalSource {
  key: string;
  label: string;
  count: number;
  available: boolean;
  note: string | null;
}

export interface ApprovalInbox {
  items: ApprovalItem[];
  sources: ApprovalSource[];
  total: number;
}
