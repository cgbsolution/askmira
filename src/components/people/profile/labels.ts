import type {
  BloodGroup,
  EducationLevel,
  MaritalStatus,
  NomineePurpose,
  ProfileChangeStatus,
  ProfileSection,
  Relationship,
} from "@/lib/types/people";

type BadgeVariant = "success" | "warning" | "muted" | "outline" | "destructive" | "secondary";

export const SECTION_TITLE: Record<ProfileSection, string> = {
  identity: "Legal name and date of birth",
  personal: "Personal details",
  addresses: "Addresses",
  emergency_contacts: "Emergency contacts",
  family_members: "Family members",
  nominees: "Nominees",
  education: "Education",
  previous_employment: "Previous employment",
  statutory: "Statutory identifiers",
  bank_account: "Salary bank account",
};

/** Why a section goes through HR when the employee changes it. */
export const WHY_HR: Partial<Record<ProfileSection, string>> = {
  identity: "Your legal name and date of birth appear on Form 16, PF and ESI records.",
  addresses: "Your address decides Professional Tax and appears on Form 16 and PF KYC.",
  nominees: "Nominations are statutory declarations for PF, gratuity and insurance.",
  statutory: "PAN, UAN, Aadhaar, PF and ESI numbers go into statutory returns.",
  bank_account: "Your salary is credited to this account.",
};

export const MARITAL_STATUS: Record<MaritalStatus, string> = {
  single: "Single",
  married: "Married",
  separated: "Separated",
  divorced: "Divorced",
  widowed: "Widowed",
  undisclosed: "Prefer not to say",
};

export const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const RELATIONSHIP: Record<Relationship, string> = {
  spouse: "Spouse",
  child: "Child",
  father: "Father",
  mother: "Mother",
  sibling: "Sibling",
  father_in_law: "Father-in-law",
  mother_in_law: "Mother-in-law",
  grandparent: "Grandparent",
  friend: "Friend",
  other: "Other",
};

export const NOMINEE_PURPOSE: Record<NomineePurpose, string> = {
  pf: "Provident Fund",
  eps: "Pension (EPS)",
  gratuity: "Gratuity",
  insurance: "Insurance",
  superannuation: "Superannuation",
};

export const EDUCATION_LEVEL: Record<EducationLevel, string> = {
  secondary: "Secondary (10th)",
  higher_secondary: "Higher secondary (12th)",
  diploma: "Diploma",
  graduate: "Graduate",
  postgraduate: "Postgraduate",
  doctorate: "Doctorate",
  certification: "Certification",
  other: "Other",
};

export const FAMILY_GENDER: Record<"female" | "male" | "non_binary" | "undisclosed", string> = {
  female: "Female",
  male: "Male",
  non_binary: "Non-binary",
  undisclosed: "Prefer not to say",
};

export const CHANGE_STATUS: Record<ProfileChangeStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Waiting for HR", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
  withdrawn: { label: "Withdrawn", variant: "muted" },
};

/** Labels for the keys that appear in a change request's proposed/current values. */
export const FIELD_LABEL: Record<string, string> = {
  first_name: "First name",
  last_name: "Last name",
  date_of_birth: "Date of birth",
  pan: "PAN",
  uan: "UAN",
  aadhaar_last4: "Aadhaar",
  aadhaar: "Aadhaar",
  pf_number: "PF number",
  esi_number: "ESI number",
  account_number_masked: "Account number",
  account_number: "Account number",
  ifsc: "IFSC",
  account_holder_name: "Account holder",
  bank_name: "Bank",
  father_name: "Father's name",
  spouse_name: "Spouse's name",
  marital_status: "Marital status",
  blood_group: "Blood group",
  nationality: "Nationality",
  alternate_phone: "Alternate phone",
  current: "Current address",
  permanent: "Permanent address",
  permanent_same_as_current: "Permanent same as current",
  entries: "Entries",
};
