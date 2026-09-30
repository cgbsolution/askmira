/**
 * Asset management contracts, matching `app/schemas/assets.py`.
 *
 * Money arrives as a decimal string and stays one: a purchase cost or a
 * recovery figure is never parsed into a JavaScript number.
 */

export type AssetStatus = "in_stock" | "assigned" | "in_repair" | "lost" | "retired" | "disposed";
export type AssetCondition = "new" | "good" | "fair" | "damaged";
export type AssignmentOutcome = "returned" | "lost" | "written_off";
export type AssetRequestStatus = "pending" | "approved" | "rejected" | "fulfilled" | "cancelled";

export interface AssetCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  custodian_user_id: string | null;
  custodian_name: string | null;
  depreciation_months: number | null;
  requires_acknowledgement: boolean;
  active: boolean;
  asset_count: number;
  in_stock_count: number;
}

export interface AssetCustodian {
  user_id: string;
  full_name: string;
  role: string;
}

export interface AssetAssignment {
  id: string;
  asset_id: string;
  asset_tag: string;
  asset_name: string;
  serial_number: string | null;
  category_name: string;
  requires_acknowledgement: boolean;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  assigned_at: string;
  assigned_by_name: string | null;
  expected_return_date: string | null;
  condition_out: AssetCondition;
  assignment_notes: string | null;
  acknowledged_at: string | null;
  returned_at: string | null;
  returned_to_name: string | null;
  condition_in: AssetCondition | null;
  return_notes: string | null;
  recovery_amount: string | null;
  exit_record_id: string | null;
  /** An exit clearance item is waiting on this hand-over; returning it signs that off. */
  exit_clearance_pending: boolean;
  closed_at: string | null;
  outcome: AssignmentOutcome | null;
  is_open: boolean;
  is_overdue: boolean;
  return_reminder_sent_at: string | null;
}

export interface Asset {
  id: string;
  asset_tag: string;
  name: string;
  category_id: string;
  category_code: string;
  category_name: string;
  serial_number: string | null;
  make: string | null;
  model: string | null;
  specs: string | null;
  notes: string | null;
  purchase_date: string | null;
  purchase_cost: string | null;
  vendor: string | null;
  invoice_number: string | null;
  warranty_until: string | null;
  location_id: string | null;
  location_name: string | null;
  status: AssetStatus;
  condition: AssetCondition;
  status_reason: string | null;
  status_changed_at: string | null;
  depreciation_months: number | null;
  book_value: string | null;
  book_value_basis: string | null;
  current_assignment: AssetAssignment | null;
  created_at: string;
  updated_at: string;
}

export interface AssetDetail extends Asset {
  history: AssetAssignment[];
}

export interface AssetPage {
  items: Asset[];
  total: number;
  page: number;
  page_size: number;
}

export interface AssetSummary {
  total: number;
  by_status: Record<AssetStatus, number>;
  assigned: number;
  in_stock: number;
  in_repair: number;
  lost: number;
  overdue_returns: number;
  unacknowledged: number;
  pending_requests: number;
  approved_awaiting_fulfilment: number;
  purchase_cost_total: string;
  book_value_total: string;
  assets_without_cost: number;
}

export interface MyAssets {
  current: AssetAssignment[];
  history: AssetAssignment[];
}

export interface AssetRequest {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  category_id: string;
  category_name: string;
  reason: string;
  needed_by: string | null;
  status: AssetRequestStatus;
  created_at: string;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  fulfilled_asset_id: string | null;
  fulfilled_asset_tag: string | null;
  fulfilled_at: string | null;
  can_decide: boolean;
  can_fulfil: boolean;
  can_cancel: boolean;
}

export interface AssetInput {
  category_id: string;
  asset_tag?: string;
  name: string;
  serial_number: string | null;
  make: string | null;
  model: string | null;
  specs: string | null;
  notes: string | null;
  purchase_date: string | null;
  purchase_cost: string | null;
  vendor: string | null;
  invoice_number: string | null;
  warranty_until: string | null;
  location_id: string | null;
  condition: AssetCondition;
}
