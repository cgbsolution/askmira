/**
 * Predictive search: how a typed term is matched against the lines a search
 * box can offer, and how those lines are ranked. Plain functions with no React
 * in them, so `npm run test:search` can run them under Node directly.
 * The box itself is `components/common/PredictiveSearch.tsx`.
 */

/** What a line needs for matching. */
export interface MatchableLine {
  label: string;
  /** More words the line answers to without showing them. */
  keywords?: string;
}

/** A line made from a value in a list: its text and which field it came from. */
export interface ValueLine {
  id: string;
  label: string;
  hint: string;
}

export function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** The typed words, lower-cased. */
export function matchWords(term: string): string[] {
  return normalise(term).split(" ").filter(Boolean);
}

/** The worst score at which every typed word starts a word of the line. */
export const WORD_START = 3.5;

/**
 * How well `label` answers `term`: lower is better, null is no match. Every
 * typed word must appear in the label (or its keywords); a label that starts
 * with what was typed beats one where a word does, which beats one that only
 * contains it. Plain text comparison: no typed character is special.
 */
export function matchScore(term: string, label: string, keywords = ""): number | null {
  const typed = normalise(term);
  if (!typed) return 0;
  const text = normalise(label);
  const extra = normalise(keywords);
  const tokens = matchWords(term);
  const inLabel = tokens.every((token) => text.includes(token));
  if (!inLabel && !tokens.every((token) => text.includes(token) || extra.includes(token))) return null;
  const startsWord = (haystack: string, token: string) =>
    haystack.startsWith(token) || haystack.includes(` ${token}`);
  if (text === typed) return 0;
  if (text.startsWith(typed)) return 1;
  if (text.includes(` ${typed}`)) return 2;
  if (inLabel && tokens.every((token) => startsWord(text, token))) return 3;
  // Through the words a line answers to as well ("Payroll" for its pages).
  if (tokens.every((token) => startsWord(text, token) || startsWord(extra, token))) return WORD_START;
  if (inLabel) return 4;
  return 5;
}

/**
 * The best `limit` of `items` for `term`, best first. With no term, nothing:
 * a box that has had nothing typed shows recent searches, not a list of everything.
 * `wordStart` keeps only lines where every typed word starts a word.
 */
export function rankSuggestions<T extends MatchableLine>(
  items: readonly T[],
  term: string,
  limit = 8,
  { wordStart = false }: { wordStart?: boolean } = {},
): T[] {
  if (!normalise(term)) return [];
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const score = matchScore(term, item.label, item.keywords);
    // Names (pages, say) answer only to words they start: "ra" is not Calibration.
    if (score !== null && (!wordStart || score <= WORD_START)) scored.push({ item, score });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.item.label.length - b.item.label.length ||
      a.item.label.localeCompare(b.item.label),
  );
  return scored.slice(0, limit).map(({ item }) => item);
}

/**
 * A value as a line can offer it, or null for one nobody would type: a dash,
 * a single letter, a paragraph.
 */
export function suggestableText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.replace(/\s+/g, " ").trim();
  if (label.length < 2 || label.length > 80 || !/[\p{L}\p{N}]/u.test(label)) return null;
  return label;
}

/**
 * Lines from the values in a list the screen already has: each distinct value
 * of each field (case aside), with the field's name as its hint.
 *
 *   valueSuggestions(assets, { Tag: (a) => a.asset_tag, Serial: (a) => a.serial_number })
 */
export function valueSuggestions<T>(
  rows: readonly T[] | null | undefined,
  fields: Record<string, (row: T) => string | null | undefined>,
  max = 5000,
): ValueLine[] {
  const seen = new Map<string, ValueLine>();
  for (const [hint, read] of Object.entries(fields)) {
    for (const row of rows ?? []) {
      if (seen.size >= max) break;
      const label = suggestableText(read(row));
      if (!label) continue;
      const key = label.toLowerCase();
      if (!seen.has(key)) seen.set(key, { id: `${hint}:${key}`, label, hint });
    }
  }
  return [...seen.values()];
}
