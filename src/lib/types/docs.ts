/** Document vault and letter types. Mirror backend/app/schemas/{documents,letters}.py. */

export type DocumentCategory =
  | "id_proof"
  | "address_proof"
  | "education"
  | "experience"
  | "contract"
  | "offer_letter"
  | "policy_ack"
  | "payslip"
  | "tax"
  | "medical"
  | "bank"
  | "other";

export interface DocumentCategoryOption {
  value: DocumentCategory;
  label: string;
}

export interface VaultDocument {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  category: string;
  title: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  /** The number on the document: passport, PAN or cheque number. */
  document_number: string | null;
  remark: string | null;
  /** Set when the document belongs to one of the employee's dependants. */
  dependant_name: string | null;
  /** When the document was issued; `valid_until` is when it expires. */
  issued_on: string | null;
  valid_until: string | null;
  is_expired: boolean;
  is_employee_visible: boolean;
  uploaded_by_user_id: string | null;
  created_at: string;
  /** "not_required" for what HR uploaded; the employee's own uploads start "pending". */
  verification_status: DocumentVerification;
  self_uploaded: boolean;
  verified_at: string | null;
  verification_note: string | null;
}

export type DocumentVerification = "not_required" | "pending" | "verified" | "rejected";

/** A company document: a policy or handbook, not about any one person. */
export interface CompanyDocument {
  id: string;
  document_type: string;
  title: string;
  document_number: string | null;
  remark: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  issued_on: string | null;
  valid_until: string | null;
  is_expired: boolean;
  /** Published to employees (policy lookup). */
  is_employee_visible: boolean;
  created_at: string;
}

export type LetterCategory =
  | "offer"
  | "appointment"
  | "confirmation"
  | "transfer"
  | "promotion"
  | "relieving"
  | "experience"
  | "salary_certificate"
  | "warning"
  | "pip"
  | "custom";

export type LetterStatus = "draft" | "pending_approval" | "approved" | "sent" | "signed" | "revoked";

export type FieldSource = "employee" | "salary" | "tenant" | "manual" | "computed";

export interface TemplateField {
  token: string;
  label: string;
  source: FieldSource;
  required: boolean;
}

export interface LetterTemplate {
  id: string;
  code: string;
  name: string;
  category: LetterCategory;
  version: number;
  active: boolean;
  requires_approval: boolean;
  requires_signature: boolean;
  is_seed: boolean;
  fields: TemplateField[];
}

export interface LetterTemplateDetail extends LetterTemplate {
  body_html: string;
  header_html: string | null;
  footer_html: string | null;
  approver_roles: string[];
  signatory_role: string | null;
  created_at: string;
}

export interface TemplateVersion {
  id: string;
  version: number;
  name: string;
  active: boolean;
  created_at: string;
}

export interface TemplateContentInput {
  name: string;
  category: LetterCategory;
  body_html: string;
  header_html: string | null;
  footer_html: string | null;
  requires_approval: boolean;
  approver_roles: string[];
  requires_signature: boolean;
  signatory_role: string | null;
  fields: (TemplateField & { source_path?: string | null })[];
}

export interface MergeFields {
  sources: Record<string, string[]>;
  computed: string[];
  manual_note: string;
}

export interface LetterPreview {
  html: string;
  problems: string[];
  is_sample: boolean;
  employee_label: string | null;
  as_of: string;
}

export interface IssuedLetter {
  id: string;
  employee_id: string | null;
  candidate_id: string | null;
  recipient_name: string;
  template_id: string;
  template_name: string;
  template_version: number;
  category: LetterCategory;
  reference_number: string;
  content_hash: string;
  status: LetterStatus;
  issued_at: string | null;
  approved_at: string | null;
  signed_at: string | null;
  signature_provider: string | null;
  has_pdf: boolean;
  has_signed_pdf: boolean;
  revoked_reason: string | null;
  /** In-portal acknowledgement — separate from e-signature. */
  acknowledged_at: string | null;
  /** The name the employee typed when they accepted. */
  acknowledged_name: string | null;
  acknowledgement_requested_at: string | null;
  /** True when the caller is the employee and may acknowledge it now. */
  can_acknowledge: boolean;
}

export interface LetterContent {
  reference_number: string;
  merged_html: string;
  intact: boolean;
}

export interface LetterVerify {
  reference_number: string;
  content_hash: string;
  intact: boolean;
}

export interface BulkLetterJob {
  id: string;
  template_id: string;
  total: number;
  succeeded: number;
  failed: number;
  status: string;
  results: { employee_id: string; reference_number: string | null; error: string | null }[];
}

export interface SignatureProviderStatus {
  provider: string;
  connected: boolean;
  detail: string;
}
