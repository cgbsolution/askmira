"use client";

import { Clock, CornerDownLeft, Loader2, Search, UserRound, X, type LucideIcon } from "lucide-react";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { matchWords, normalise, rankSuggestions } from "@/lib/predictive";
import { cn } from "@/lib/utils";

/** One line in the drop-down under a search box. */
export interface Suggestion {
  /** Unique within one list. */
  id: string;
  /** What the line reads, and what the typed words are matched against. */
  label: string;
  /** What picking the line puts in the box. Defaults to `label`. */
  value?: string;
  /** A second, quieter line: a person's title, a page's section. */
  description?: string;
  /** Small text at the right: which column a value came from, an employee code. */
  hint?: string;
  /** More words the line answers to without showing them ("salary slip" for Payslips). */
  keywords?: string;
  /** Lines with the same group sit together under it as a heading. */
  group?: string;
  icon?: LucideIcon;
  /** Something to draw instead of an icon (an avatar). */
  leading?: React.ReactNode;
  /** Picking the line runs this instead of filling the box (open a page, a person). */
  onSelect?: () => void;
}

export {
  matchScore,
  rankSuggestions,
  suggestableText,
  valueSuggestions,
} from "@/lib/predictive";

/** What a person line needs: a directory entry, a colleague and a picker row all have it. */
export interface SuggestablePerson {
  id: string;
  employee_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  designation?: string | null;
  work_email?: string | null;
}

export function suggestedPersonName(person: SuggestablePerson): string {
  return (
    person.display_name ||
    person.full_name ||
    [person.first_name, person.last_name].filter(Boolean).join(" ") ||
    person.work_email ||
    person.employee_code ||
    "—"
  );
}

/**
 * One line per person, already found by the server, so not ranked again here:
 * name, title, code at the right. Picking a line calls `onPick` with the person.
 */
export function peopleSuggestions<T extends SuggestablePerson>(
  people: readonly T[] | null | undefined,
  onPick: (person: T) => void,
  group?: string,
): Suggestion[] {
  return (people ?? []).map((person) => ({
    id: `person:${person.id}`,
    label: suggestedPersonName(person),
    description: person.designation ?? undefined,
    hint: person.employee_code ?? undefined,
    keywords: [person.employee_code, person.work_email].filter(Boolean).join(" "),
    icon: UserRound,
    group,
    onSelect: () => onPick(person),
  }));
}

/** The label with the typed words in bold. */
export function Highlighted({ text, term }: { text: string; term: string }) {
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const token of matchWords(term)) {
    const at = lower.indexOf(token);
    if (at >= 0) ranges.push([at, at + token.length]);
  }
  if (ranges.length === 0) return <>{text}</>;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  const parts: React.ReactNode[] = [];
  let from = 0;
  merged.forEach(([start, end], index) => {
    if (start > from) parts.push(text.slice(from, start));
    parts.push(
      <strong key={index} className="font-semibold text-foreground">
        {text.slice(start, end)}
      </strong>,
    );
    from = end;
  });
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}

/* ── Recent searches ──────────────────────────────────────────────────────── */

// Kept for the browser tab only: searches name people, and a shared office
// computer should not show the next person who sat there what HR looked up.
const RECENT_PREFIX = "askmira.recent-search.";
const RECENT_LIMIT = 5;

function readRecent(key: string | undefined): string[] {
  if (!key) return [];
  try {
    const raw = window.sessionStorage.getItem(RECENT_PREFIX + key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeRecent(key: string | undefined, term: string): void {
  const value = term.trim();
  if (!key || value.length < 2) return;
  try {
    const next = [value, ...readRecent(key).filter((item) => normalise(item) !== normalise(value))].slice(
      0,
      RECENT_LIMIT,
    );
    window.sessionStorage.setItem(RECENT_PREFIX + key, JSON.stringify(next));
  } catch {
    // Storage blocked: the box still searches, it just doesn't remember.
  }
}

/* ── The box ──────────────────────────────────────────────────────────────── */

export interface PredictiveSearchProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "onSubmit" | "type" | "ref"> {
  value: string;
  onValueChange: (value: string) => void;
  /**
   * Lines to offer for what is typed. An array is ranked against the typed
   * words here; a function is trusted to have done that itself.
   */
  suggestions?: readonly Suggestion[] | ((term: string) => readonly Suggestion[]);
  /** Lines from the server for what is typed, asked for once typing pauses. */
  loadSuggestions?: (term: string) => Promise<readonly Suggestion[]>;
  /** Enter with no line chosen. */
  onSubmit?: (term: string) => void;
  /** Called when a line is picked, after the box takes its value. */
  onPick?: (suggestion: Suggestion) => void;
  /** Remembers this box's searches for the tab, and offers them before anything is typed. */
  historyKey?: string;
  /** Letters needed before lines are offered (the server's own rule, say). */
  minChars?: number;
  maxSuggestions?: number;
  /** Shown when nothing matches; without it the drop-down simply closes. */
  emptyText?: string;
  /** Under the lines: what Enter does ("Search the directory for …"). */
  submitLabel?: (term: string) => string;
  /** Drawn at the right of the box instead of the clear button (a ⌘K hint). */
  trailing?: React.ReactNode;
  icon?: LucideIcon;
  /** Classes for the wrapper; `className` styles the input itself. */
  wrapperClassName?: string;
  iconClassName?: string;
  /** Classes for the drop-down. */
  listClassName?: string;
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * A search box that offers matches as you type: the closest values first, the
 * typed letters in bold, ↑ ↓ to move, Enter to pick, Esc to close. With
 * nothing typed it offers the tab's recent searches. Every search box in the
 * portal is this one, so they all behave alike.
 */
export function PredictiveSearch({
  value,
  onValueChange,
  suggestions,
  loadSuggestions,
  onSubmit,
  onPick,
  historyKey,
  minChars = 1,
  maxSuggestions = 8,
  emptyText,
  submitLabel,
  trailing,
  icon: Icon = Search,
  wrapperClassName,
  iconClassName,
  listClassName,
  className,
  disabled,
  placeholder,
  ref,
  onKeyDown,
  onFocus,
  onBlur,
  ...input
}: PredictiveSearchProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<{ term: string; items: readonly Suggestion[] }>({ term: "", items: [] });
  const [loading, setLoading] = useState(false);

  const term = value.trim();
  const enough = term.length >= minChars;

  // Server lines, once typing pauses; a slower answer to older words is dropped.
  useEffect(() => {
    if (!loadSuggestions || !enough || !open) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      loadSuggestions(term)
        .then((items) => {
          if (!cancelled) setLoaded({ term, items });
        })
        .catch(() => {
          if (!cancelled) setLoaded({ term, items: [] });
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadSuggestions, term, enough, open]);

  const lines = useMemo<Suggestion[]>(() => {
    if (!term) {
      return recent.map((item) => ({ id: `recent:${item}`, label: item, group: "Recent searches", icon: Clock }));
    }
    if (!enough) return [];
    const local =
      typeof suggestions === "function"
        ? [...suggestions(term)].slice(0, maxSuggestions)
        : suggestions
          ? rankSuggestions(suggestions, term, maxSuggestions)
          : [];
    const remote = loadSuggestions && normalise(loaded.term) === normalise(term) ? loaded.items : [];
    const seen = new Set(local.map((line) => line.id));
    const all = [...local, ...remote.filter((line) => !seen.has(line.id))];
    // Each group's lines together, the groups in the order of their best line.
    const order = [...new Set(all.map((line) => line.group))];
    return order.flatMap((group) => all.filter((line) => line.group === group));
  }, [term, enough, recent, suggestions, loadSuggestions, loaded, maxSuggestions]);

  // A new list starts with nothing chosen, so Enter still searches what was typed.
  useEffect(() => setActive(-1), [term]);

  const showEmpty = Boolean(emptyText) && enough && !loading && lines.length === 0;
  const showSubmit = Boolean(submitLabel && onSubmit && term);
  const visible = open && !disabled && (lines.length > 0 || loading || showEmpty || showSubmit);

  const pick = (line: Suggestion) => {
    if (line.onSelect) {
      line.onSelect();
      writeRecent(historyKey, term || line.label);
    } else {
      const next = line.value ?? line.label;
      onValueChange(next);
      writeRecent(historyKey, next);
    }
    onPick?.(line);
    setOpen(false);
  };

  const submit = () => {
    writeRecent(historyKey, value);
    onSubmit?.(value.trim());
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setRecent(readRecent(historyKey));
        setOpen(true);
        return;
      }
      setActive((at) => (lines.length ? (at + 1) % lines.length : -1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((at) => (lines.length ? (at <= 0 ? lines.length - 1 : at - 1) : -1));
    } else if (event.key === "Enter") {
      if (visible && active >= 0 && lines[active]) {
        event.preventDefault();
        pick(lines[active]);
      } else if (onSubmit) {
        event.preventDefault();
        submit();
      } else {
        writeRecent(historyKey, value);
        setOpen(false);
      }
    } else if (event.key === "Escape") {
      if (visible) {
        // Close the list only — a dialog around the box stays open.
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  const groups: { name: string | undefined; items: { line: Suggestion; index: number }[] }[] = [];
  lines.forEach((line, index) => {
    const last = groups[groups.length - 1];
    if (last && last.name === line.group) last.items.push({ line, index });
    else groups.push({ name: line.group, items: [{ line, index }] });
  });

  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <Popover open={visible} onOpenChange={(next) => !next && setOpen(false)}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} data-slot="predictive-search" className={cn("relative", wrapperClassName)}>
          <Icon
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground",
              iconClassName,
            )}
          />
          <Input
            {...input}
            ref={(node) => {
              inputRef.current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) (ref as React.RefObject<HTMLInputElement | null>).current = node;
            }}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={visible}
            aria-controls={visible ? listId : undefined}
            aria-activedescendant={visible && active >= 0 ? optionId(active) : undefined}
            autoComplete="off"
            spellCheck={false}
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(event) => {
              onValueChange(event.target.value);
              setOpen(true);
            }}
            onFocus={(event) => {
              setRecent(readRecent(historyKey));
              setOpen(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              // A table filtered as you type is a search too, Enter or not.
              if (!onSubmit) writeRecent(historyKey, value);
              onBlur?.(event);
            }}
            onClick={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className={cn("pl-10", (trailing || value) && "pr-10", className)}
          />
          {trailing ??
            (value && !disabled ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Clear search"
                className="absolute top-1/2 right-1.5 size-7 -translate-y-1/2 text-muted-foreground"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onValueChange("");
                  inputRef.current?.focus();
                }}
              >
                <X className="size-4" />
              </Button>
            ) : null)}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        // Focus stays in the box: typing carries on while the list is open.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (anchorRef.current?.contains(event.target as Node)) event.preventDefault();
        }}
        onMouseDown={(event) => event.preventDefault()}
        className={cn(
          "w-[max(var(--radix-popover-trigger-width),18rem)] max-w-[calc(100vw-2rem)] p-1",
          listClassName,
        )}
      >
        <div id={listId} role="listbox" aria-label={placeholder ?? "Suggestions"} className="max-h-80 overflow-y-auto">
          {groups.map((group, groupIndex) => (
            <div key={`${group.name ?? ""}-${groupIndex}`} role="group" aria-label={group.name}>
              {group.name && (
                <p className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">{group.name}</p>
              )}
              {group.items.map(({ line, index }) => {
                const LineIcon = line.icon;
                return (
                  <div
                    key={line.id}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === active}
                    data-active={index === active || undefined}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => pick(line)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground select-none",
                      "data-[active]:bg-muted data-[active]:text-foreground",
                    )}
                  >
                    {line.leading ??
                      (LineIcon ? <LineIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null)}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-foreground/90">
                        <Highlighted text={line.label} term={term} />
                      </span>
                      {line.description && (
                        <span className="block truncate text-xs text-muted-foreground">{line.description}</span>
                      )}
                    </span>
                    {line.hint && <span className="shrink-0 text-xs text-muted-foreground">{line.hint}</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {loading && (
            <p className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Searching…
            </p>
          )}
          {showEmpty && <p className="px-2 py-2 text-sm text-muted-foreground">{emptyText}</p>}
        </div>
        {showSubmit && submitLabel && (
          <div className={cn(lines.length > 0 || loading || showEmpty ? "mt-1 border-t border-border pt-1" : "")}>
          <Button
            type="button"
            variant="ghost"
            onClick={submit}
            className="h-auto w-full justify-start gap-2 rounded-lg px-2 py-2 text-left text-sm font-normal text-muted-foreground hover:text-foreground"
          >
            <CornerDownLeft aria-hidden className="size-4 shrink-0" />
            <span className="truncate">{submitLabel(term)}</span>
          </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
