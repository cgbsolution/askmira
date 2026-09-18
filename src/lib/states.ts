/**
 * Indian states and union territories, by the code the API accepts.
 *
 * The codes mirror `INDIAN_STATE_CODES` in `backend/app/schemas/org.py` — a
 * code this list offers but that set rejects is a form that fails on submit,
 * so the two are kept identical. Several states appear under two codes because
 * different statutory portals spell them differently (Odisha files as OR on
 * some returns and OD on others); both are accepted, and the label says which
 * is which rather than offering the same state twice with no explanation.
 */
export interface IndianState {
  code: string;
  name: string;
}

export const INDIAN_STATES: IndianState[] = [
  { code: "AN", name: "Andaman & Nicobar Islands" },
  { code: "AP", name: "Andhra Pradesh" },
  { code: "AR", name: "Arunachal Pradesh" },
  { code: "AS", name: "Assam" },
  { code: "BR", name: "Bihar" },
  { code: "CH", name: "Chandigarh" },
  { code: "CG", name: "Chhattisgarh" },
  { code: "CT", name: "Chhattisgarh (alternate code CT)" },
  { code: "DN", name: "Dadra & Nagar Haveli" },
  { code: "DD", name: "Daman & Diu" },
  { code: "DH", name: "Dadra & Nagar Haveli and Daman & Diu (merged)" },
  { code: "DL", name: "Delhi" },
  { code: "GA", name: "Goa" },
  { code: "GJ", name: "Gujarat" },
  { code: "HR", name: "Haryana" },
  { code: "HP", name: "Himachal Pradesh" },
  { code: "JK", name: "Jammu & Kashmir" },
  { code: "JH", name: "Jharkhand" },
  { code: "KA", name: "Karnataka" },
  { code: "KL", name: "Kerala" },
  { code: "LA", name: "Ladakh" },
  { code: "LD", name: "Lakshadweep" },
  { code: "MP", name: "Madhya Pradesh" },
  { code: "MH", name: "Maharashtra" },
  { code: "MN", name: "Manipur" },
  { code: "ML", name: "Meghalaya" },
  { code: "MZ", name: "Mizoram" },
  { code: "NL", name: "Nagaland" },
  { code: "OD", name: "Odisha" },
  { code: "OR", name: "Odisha (alternate code OR)" },
  { code: "PY", name: "Puducherry" },
  { code: "PB", name: "Punjab" },
  { code: "RJ", name: "Rajasthan" },
  { code: "SK", name: "Sikkim" },
  { code: "TN", name: "Tamil Nadu" },
  { code: "TG", name: "Telangana" },
  { code: "TS", name: "Telangana (alternate code TS)" },
  { code: "TR", name: "Tripura" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "UK", name: "Uttarakhand" },
  { code: "UT", name: "Uttarakhand (alternate code UT)" },
  { code: "WB", name: "West Bengal" },
];

const BY_CODE = new Map(INDIAN_STATES.map((state) => [state.code, state.name]));

export function stateName(code: string): string {
  return BY_CODE.get(code.toUpperCase()) ?? code;
}
