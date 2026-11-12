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
  | "all_documents"
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
  /** Every employee must read and acknowledge it. */
  requires_acknowledgement: boolean;
  /** The caller's own state, where acknowledgement is required; else null. */
  acknowledged_by_me: boolean | null;
}

export interface AcknowledgementRegisterRow {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  acknowledged_at: string | null;
  typed_name: string | null;
}

export interface AcknowledgementRegister {
  document_id: string;
  title: string;
  content_sha256: string | null;
  acknowledged: number;
  pending: number;
  rows: AcknowledgementRegisterRow[];
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
  /** For a manual field: the field it starts from ("employee.notice_period"). */
  source_path?: string | null;
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
  /** Printed on the workspace letterhead. */
  use_letterhead: boolean;
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
  use_letterhead: boolean;
  fields: TemplateField[];
}

export interface MergeFields {
  sources: Record<string, string[]>;
  computed: string[];
  manual_note: string;
  /** "employee.designation" -> "Designation", for the Insert field menu. */
  labels: Record<string, string>;
}

export type LetterheadDesign = "wave" | "classic" | "none";

/** What every letter is printed on (Documents -> Letterhead). */
export interface LetterheadSettings {
  design: LetterheadDesign;
  primary_colour: string;
  secondary_colour: string;
  accent_colour: string;
  highlight_colour: string;
  company_name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  signatory_name: string;
  signatory_title: string;
  show_logo: boolean;
  show_reference: boolean;
}

/** Colours offered for the letterhead; any hex can be typed as well. */
export const LETTERHEAD_PRESETS = [
  "#1B5A92", "#4DAAF6", "#3A9E96", "#0F2A47", "#7D0712", "#F8A01A",
  "#271E1C", "#2E7D32", "#6A1B9A", "#C2185B", "#546E7A", "#E00000",
] as const;

export interface Letterhead extends LetterheadSettings {
  has_own_logo: boolean;
  has_workspace_logo: boolean;
  has_signature: boolean;
}

export interface LetterPrefill {
  values: Record<string, string>;
  as_of: string;
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
  /** Pages of the PDF shown (`/letters/{id}/pages/{n}`); 0 when none can be shown. */
  page_count: number;
  /** The pages are the signed copy printed when the letter was accepted. */
  showing_signed_copy: boolean;
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
