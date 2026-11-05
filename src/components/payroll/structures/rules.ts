import type { TemplateCondition, TemplateMethod, TemplateRule } from "@/lib/types/payroll";

/** A line's rule as the editor holds it: every box a string, "none" = not in the structure. */
export interface RuleDraft {
  method: "none" | TemplateMethod;
  value: string;
  of: string;
  basis: "monthly" | "annual";
  ceiling: string;
  useWhen: boolean;
  whenOn: string;
  whenOp: "up_to" | "above";
  whenAmount: string;
  /** The last slab's `up_to` is always empty: it covers the rest. */
  slabs: { up_to: string; amount: string }[];
  rounding: "nearest" | "up" | "down";
}

export const EMPTY_RULE: RuleDraft = {
  method: "none",
  value: "",
  of: "CTC",
  basis: "monthly",
  ceiling: "",
  useWhen: false,
  whenOn: "GROSS",
  whenOp: "up_to",
  whenAmount: "",
  slabs: [
    { up_to: "", amount: "" },
    { up_to: "", amount: "" },
  ],
  rounding: "nearest",
};

/** The figures a rule can read besides another line. */
export const FIGURES: { value: string; label: string }[] = [
  { value: "CTC", label: "CTC" },
  { value: "GROSS", label: "Gross" },
  { value: "PF_WAGES", label: "PF wages" },
  { value: "ESI_WAGES", label: "ESI wages" },
];

/** Salary-master wage types that stand in for a statutory deduction. */
export const STATUTORY_CODES = new Set(["PF_MANUAL", "ESIC_MANUAL", "PT_MANUAL", "LWF_MANUAL", "TDS_MANUAL"]);

export function toDraft(rule: TemplateRule | null | undefined): RuleDraft {
  if (!rule) return { ...EMPTY_RULE };
  const when: TemplateCondition | null | undefined = rule.when;
  const slabs = (rule.slabs ?? []).map((slab) => ({ up_to: slab.up_to ?? "", amount: slab.amount ?? "" }));
  return {
    method: rule.method,
    value: rule.value ?? "",
    of: rule.of ?? (rule.method === "slab" ? "GROSS" : "CTC"),
    basis: rule.basis ?? "monthly",
    ceiling: rule.ceiling ?? "",
    useWhen: Boolean(when),
    whenOn: when?.on ?? "GROSS",
    whenOp: when?.op ?? "up_to",
    whenAmount: when?.amount ?? "",
    slabs: slabs.length ? slabs : EMPTY_RULE.slabs.map((slab) => ({ ...slab })),
    rounding: rule.rounding ?? "nearest",
  };
}

/** What the API takes. Empty boxes go as null, so the server names the one to fill. */
export function fromDraft(draft: RuleDraft): TemplateRule | null {
  if (draft.method === "none") return null;
  const rule: TemplateRule = { method: draft.method };
  const blank = (value: string) => (value.trim() === "" || value.trim() === "." ? null : value.trim());
  if (draft.method === "percent" || draft.method === "fixed") rule.value = blank(draft.value);
  if (draft.method === "percent" || draft.method === "slab") rule.of = draft.of;
  if (draft.method === "fixed") rule.basis = draft.basis;
  if (draft.method === "percent" && blank(draft.ceiling)) rule.ceiling = blank(draft.ceiling);
  if (draft.method !== "balance" && draft.useWhen) {
    rule.when = { on: draft.whenOn, op: draft.whenOp, amount: blank(draft.whenAmount) };
  }
  if (draft.method === "slab") {
    rule.slabs = draft.slabs.map((slab, index) => ({
      up_to: index === draft.slabs.length - 1 ? null : blank(slab.up_to),
      amount: blank(slab.amount),
    }));
  }
  if (draft.rounding !== "nearest" && draft.method !== "balance") rule.rounding = draft.rounding;
  return rule;
}

/** "₹15,000" from "15000" for the limit summaries; the server's words are the record. */
export function rupees(value: string): string {
  const [whole, paise] = value.split(".");
  const digits = whole.replace(/^0+(?=\d)/, "");
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  const grouped = rest ? `${rest},${last3}` : last3;
  return `₹${grouped}${paise && /[1-9]/.test(paise) ? `.${paise}` : ""}`;
}

export function figureLabel(code: string, names: Record<string, string>): string {
  return FIGURES.find((figure) => figure.value === code)?.label ?? names[code] ?? code;
}

const FIGURE_WORD: Record<string, string> = {
  CTC: "CTC",
  GROSS: "gross",
  PF_WAGES: "PF wages",
  ESI_WAGES: "ESI wages",
};

/** The figure as it reads mid-sentence: "gross", "ESI wages", "CTC", a line's name. */
export function figureWord(code: string, names: Record<string, string>): string {
  return FIGURE_WORD[code] ?? names[code] ?? code;
}

/**
 * What still has to be typed before a rule can be worked out, or null. Checked
 * in the browser so a half-typed rule waits quietly instead of asking the server
 * (which checks everything again on save).
 */
export function draftProblem(draft: RuleDraft, label: string): string | null {
  const empty = (value: string) => value.trim() === "" || value.trim() === ".";
  if (draft.method === "percent" && empty(draft.value)) return `${label}: enter the percentage`;
  if (draft.method === "fixed" && empty(draft.value)) return `${label}: enter the amount`;
  if (draft.method === "slab") {
    const last = draft.slabs.length - 1;
    if (draft.slabs.some((slab, index) => empty(slab.amount) || (index < last && empty(slab.up_to)))) {
      return `${label}: fill in the slabs`;
    }
  }
  if (draft.method !== "none" && draft.method !== "balance" && draft.useWhen && empty(draft.whenAmount)) {
    return `${label}: enter the amount in "Apply only when"`;
  }
  return null;
}

/** The limits, condition and rounding of a rule in a few words, for its button. */
export function limitSummary(draft: RuleDraft, names: Record<string, string>): string | null {
  const parts: string[] = [];
  if (draft.method === "percent" && draft.ceiling.trim()) parts.push(`Base up to ${rupees(draft.ceiling.trim())}`);
  if (draft.useWhen) {
    const amount = draft.whenAmount.trim() ? rupees(draft.whenAmount.trim()) : "…";
    parts.push(`Only if ${figureWord(draft.whenOn, names)} ${draft.whenOp === "up_to" ? "≤" : ">"} ${amount}`);
  }
  if (draft.rounding === "up") parts.push("Round up");
  if (draft.rounding === "down") parts.push("Round down");
  return parts.length ? parts.join(" · ") : null;
}
