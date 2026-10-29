/** Client accounts and their P&L. Amounts arrive as strings and stay strings. */

export interface ClientAccount {
  id: string;
  code: string;
  name: string;
  client_name: string | null;
  legal_entity_id: string | null;
  legal_entity_name: string | null;
  owner_employee_id: string | null;
  owner_name: string | null;
  is_active: boolean;
  notes: string | null;
  /** People mapped to it today, and their shares added up (two at 50% = "1.00"). */
  people_now: number;
  mapped_fte: string;
  created_at: string | null;
}

export type AccountEntryKind = "billing" | "cost";

export interface AccountEntry {
  id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  kind: AccountEntryKind;
  /** YYYY-MM. */
  month: string;
  amount: string;
  reference: string | null;
  entry_date: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface AccountAllocation {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department_name: string | null;
  account_id: string;
  account_code: string;
  account_name: string;
  percent: string;
  effective_from: string;
  effective_to: string | null;
  active: boolean;
}

export interface AccountPnlRow {
  account_id: string;
  code: string;
  name: string;
  billed: string;
  people_cost: string;
  other_cost: string;
  total_cost: string;
  margin: string;
  margin_pct: string | null;
  people: number;
}

export interface AccountPnl {
  start: string;
  end: string;
  months: string[];
  accounts: AccountPnlRow[];
  totals: AccountPnlRow | null;
  payroll_cost: string;
  unmapped_cost: string;
  notes: string[];
}

export interface AccountPnlMonth {
  month: string;
  billed: string;
  people_cost: string;
  other_cost: string;
  total_cost: string;
  margin: string;
  margin_pct: string | null;
}

export interface AccountPnlPerson {
  employee_id: string;
  employee_code: string;
  name: string;
  share_pct: string;
  cost: string;
}

export interface AccountPnlDetail {
  account: ClientAccount;
  start: string;
  end: string;
  summary: AccountPnlRow;
  months: AccountPnlMonth[];
  people: AccountPnlPerson[];
  notes: string[];
}

export interface AccountImportRow {
  row: number;
  status: "ready" | "error" | "skipped";
  account_code: string | null;
  kind: AccountEntryKind | null;
  month: string | null;
  amount: string | null;
  reference: string | null;
  message: string | null;
}

export interface AccountImport {
  filename: string;
  rows: AccountImportRow[];
  ready: number;
  errors: number;
  skipped: number;
  saved: number;
}
