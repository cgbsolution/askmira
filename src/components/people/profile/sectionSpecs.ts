import type { FieldSpec } from "@/components/people/profile/SpecFields";
import {
  BLOOD_GROUPS,
  EDUCATION_LEVEL,
  FAMILY_GENDER,
  MARITAL_STATUS,
  NOMINEE_PURPOSE,
  RELATIONSHIP,
} from "@/components/people/profile/labels";

const PHONE = /^[0-9+\-() ]{6,32}$/;
const PHONE_MESSAGE = "Digits, spaces, +, - and brackets; at least six.";

export const IDENTITY_FIELDS: FieldSpec[] = [
  { key: "first_name", label: "First name", maxLength: 128 },
  { key: "last_name", label: "Last name", optional: true, maxLength: 128 },
  { key: "date_of_birth", label: "Date of birth", kind: "date", optional: true },
];

export const PERSONAL_FIELDS: FieldSpec[] = [
  { key: "father_name", label: "Father's name", optional: true, maxLength: 255, hint: "EPF forms ask for it." },
  { key: "spouse_name", label: "Spouse's name", optional: true, maxLength: 255 },
  { key: "marital_status", label: "Marital status", kind: "select", options: MARITAL_STATUS, optional: true },
  {
    key: "blood_group",
    label: "Blood group",
    kind: "select",
    options: Object.fromEntries(BLOOD_GROUPS.map((g) => [g, g])),
    optional: true,
  },
  { key: "nationality", label: "Nationality", optional: true, maxLength: 64 },
  {
    key: "alternate_phone",
    label: "Alternate phone",
    optional: true,
    maxLength: 32,
    pattern: PHONE,
    patternMessage: PHONE_MESSAGE,
  },
];

export const ADDRESS_FIELDS: FieldSpec[] = [
  { key: "line1", label: "Address line 1", wide: true, maxLength: 255 },
  { key: "line2", label: "Address line 2", optional: true, wide: true, maxLength: 255 },
  { key: "city", label: "City", maxLength: 128 },
  { key: "district", label: "District", optional: true, maxLength: 128 },
  { key: "state_code", label: "State", kind: "state" },
  {
    key: "pincode",
    label: "PIN code",
    maxLength: 6,
    pattern: /^[1-9][0-9]{5}$/,
    patternMessage: "Six digits, not starting with 0.",
  },
];

export const EMERGENCY_FIELDS: FieldSpec[] = [
  { key: "name", label: "Name", maxLength: 255 },
  { key: "relationship", label: "Relationship", kind: "select", options: RELATIONSHIP },
  { key: "phone", label: "Phone", maxLength: 32, pattern: PHONE, patternMessage: PHONE_MESSAGE },
  {
    key: "alternate_phone",
    label: "Alternate phone",
    optional: true,
    maxLength: 32,
    pattern: PHONE,
    patternMessage: PHONE_MESSAGE,
  },
  { key: "email", label: "Email", optional: true, maxLength: 320 },
  { key: "is_primary", label: "Primary contact", kind: "switch" },
];

export const FAMILY_FIELDS: FieldSpec[] = [
  { key: "name", label: "Name", maxLength: 255 },
  { key: "relationship", label: "Relationship", kind: "select", options: RELATIONSHIP },
  { key: "date_of_birth", label: "Date of birth", kind: "date", optional: true },
  { key: "gender", label: "Gender", kind: "select", options: FAMILY_GENDER, optional: true },
  { key: "occupation", label: "Occupation", optional: true, maxLength: 128 },
  { key: "is_dependent", label: "Dependant", kind: "switch", hint: "Covered by insurance or benefits." },
];

export const NOMINEE_FIELDS: FieldSpec[] = [
  { key: "name", label: "Nominee name", maxLength: 255 },
  { key: "relationship", label: "Relationship", kind: "select", options: RELATIONSHIP },
  { key: "purpose", label: "Nominated for", kind: "select", options: NOMINEE_PURPOSE },
  {
    key: "share_percent",
    label: "Share (%)",
    kind: "number",
    hint: "Shares for each purpose must total 100%.",
  },
  { key: "date_of_birth", label: "Date of birth", kind: "date", optional: true },
  {
    key: "guardian_name",
    label: "Guardian's name",
    optional: true,
    maxLength: 255,
    hint: "Required when the nominee is under 18.",
  },
  { key: "address", label: "Address", kind: "textarea", optional: true, wide: true, maxLength: 512 },
];

export const EDUCATION_FIELDS: FieldSpec[] = [
  { key: "level", label: "Level", kind: "select", options: EDUCATION_LEVEL },
  { key: "qualification", label: "Qualification", maxLength: 255, hint: "For example B.Tech or CA." },
  { key: "specialisation", label: "Specialisation", optional: true, maxLength: 255 },
  { key: "institution", label: "Institution", maxLength: 255 },
  { key: "board_or_university", label: "Board or university", optional: true, maxLength: 255 },
  { key: "start_year", label: "Start year", kind: "number", optional: true },
  { key: "end_year", label: "End year", kind: "number", optional: true },
  { key: "grade", label: "Grade or score", optional: true, maxLength: 32 },
];

export const EXPERIENCE_FIELDS: FieldSpec[] = [
  { key: "employer", label: "Employer", maxLength: 255 },
  { key: "designation", label: "Designation", optional: true, maxLength: 255 },
  { key: "from_date", label: "From", kind: "date" },
  { key: "to_date", label: "To", kind: "date" },
  { key: "location", label: "Location", optional: true, maxLength: 128 },
  { key: "reason_for_leaving", label: "Reason for leaving", optional: true, maxLength: 500 },
];

export const STATUTORY_FIELDS: FieldSpec[] = [
  {
    key: "pan",
    label: "PAN",
    optional: true,
    maxLength: 10,
    pattern: /^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$/,
    patternMessage: "An individual's PAN: five letters with P fourth, four digits, a letter.",
  },
  {
    key: "uan",
    digits: true,
    label: "UAN",
    optional: true,
    maxLength: 12,
    pattern: /^[0-9]{12}$/,
    patternMessage: "Twelve digits.",
  },
  {
    key: "aadhaar",
    digits: true,
    label: "Aadhaar number",
    optional: true,
    maxLength: 14,
    pattern: /^[2-9][0-9]{11}$/,
    patternMessage: "Twelve digits, not starting with 0 or 1.",
  },
  { key: "pf_number", label: "PF member id", optional: true, maxLength: 32 },
  {
    key: "esi_number",
    digits: true,
    label: "ESI number",
    optional: true,
    maxLength: 10,
    pattern: /^[0-9]{10}$/,
    patternMessage: "Ten digits.",
  },
];

export const BANK_FIELDS: FieldSpec[] = [
  {
    key: "account_number",
    digits: true,
    label: "Account number",
    maxLength: 18,
    pattern: /^[0-9]{9,18}$/,
    patternMessage: "9 to 18 digits.",
  },
  {
    key: "ifsc",
    label: "IFSC",
    maxLength: 11,
    pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/,
    patternMessage: "Eleven characters with 0 fifth, as printed on the cheque.",
  },
  { key: "account_holder_name", label: "Account holder's name", maxLength: 255 },
  { key: "bank_name", label: "Bank", optional: true, maxLength: 128 },
];
