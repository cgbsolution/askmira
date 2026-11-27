"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, SearchIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/** Whether the list is open, so its search box can empty itself on close. */
const SelectOpenContext = React.createContext(false);

function Select({
  onValueChange,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  const [openState, setOpenState] = React.useState(props.defaultOpen ?? false);
  const open = props.open ?? openState;
  // Radix reports "" when a value is set before its option has rendered (a
  // choice made as a list arrives), which would clear that choice. No option
  // can have the empty value, so "" is never something a person picked.
  return (
    <SelectOpenContext.Provider value={open}>
      <SelectPrimitive.Root
        data-slot="select"
        onValueChange={onValueChange && ((value) => value !== "" && onValueChange(value))}
        onOpenChange={(next) => {
          setOpenState(next);
          onOpenChange?.(next);
        }}
        {...props}
      />
    </SelectOpenContext.Provider>
  );
}

function SelectGroup(props: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue(props: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none",
        "data-[size=default]:h-11 data-[size=sm]:h-8",
        "data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

/**
 * What the open list's search box holds. Items read it to hide themselves;
 * outside an open list (Radix renders the items off-screen while closed, to
 * name the chosen one in the trigger) it is empty, so nothing is hidden.
 */
const SelectSearchContext = React.createContext("");

/** Every word typed appears somewhere in the option's text, in any case. */
function matchesQuery(text: string, query: string) {
  const haystack = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** The words an option shows, from its children (strings, numbers, nested elements). */
function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (React.isValidElement(node)) {
    return textOf((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

/**
 * Every dropdown opens with a search box above its options. Typing filters
 * the list (also while an option has focus: the keys go to the box), the
 * arrow keys move into the list and Enter picks the first match.
 * `searchable={false}` leaves the box out.
 */
function SelectContent({
  className,
  children,
  position = "popper",
  align = "start",
  searchable = true,
  searchPlaceholder = "Search…",
  onKeyDown,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content> & {
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [noMatches, setNoMatches] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  // Each time the list opens it starts unfiltered.
  const open = React.useContext(SelectOpenContext);
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Whether anything is left to pick; and back to the top of the list.
  const typed = React.useRef(false);
  React.useLayoutEffect(() => {
    const viewport = viewportRef.current;
    // On opening, Radix scrolls to the chosen option; leave that alone.
    if (!viewport || (!typed.current && !query)) return;
    typed.current = true;
    viewport.scrollTop = 0;
    // Radix shows its scroll arrows from the last scroll; the list's length
    // just changed, so let them look again.
    viewport.dispatchEvent(new Event("scroll"));
    setNoMatches(query !== "" && !viewport.querySelector("[data-slot=select-item]:not([hidden])"));
  }, [query]);

  const firstMatch = () =>
    viewportRef.current?.querySelector<HTMLElement>(
      "[data-slot=select-item]:not([hidden]):not([data-disabled])",
    );

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-xl border bg-popover text-popover-foreground shadow-lg",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "max-h-[min(24rem,var(--radix-select-content-available-height))] data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        align={align}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!searchable || event.defaultPrevented || event.target === inputRef.current) return;
          // A letter typed while an option has focus goes into the search box
          // (instead of Radix jumping to the option that starts with it).
          const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
          if (plain && event.key.length === 1 && event.key !== " ") {
            event.preventDefault();
            setQuery((current) => current + event.key);
            inputRef.current?.focus();
          } else if (plain && event.key === "Backspace") {
            event.preventDefault();
            setQuery((current) => current.slice(0, -1));
            inputRef.current?.focus();
          }
        }}
        {...props}
      >
        {searchable && (
          <div data-slot="select-search" className="flex shrink-0 items-center gap-2 border-b px-3">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                // Arrows step into the list, Escape and Tab close it (Radix);
                // anything else is typing, kept from Radix's own type-ahead.
                if (["ArrowDown", "ArrowUp", "Escape", "Tab"].includes(event.key)) return;
                event.stopPropagation();
                if (event.key === "Enter") {
                  event.preventDefault();
                  firstMatch()?.click();
                }
              }}
              placeholder={searchPlaceholder}
              aria-label="Search options"
              autoComplete="off"
              spellCheck={false}
              className="h-10 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          ref={viewportRef}
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1",
          )}
        >
          <SelectSearchContext.Provider value={searchable ? query : ""}>
            {children}
          </SelectSearchContext.Provider>
          {noMatches && (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">No matches</div>
          )}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  // A group heading means little once the list is filtered.
  const query = React.useContext(SelectSearchContext);
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      hidden={query ? true : undefined}
      className={cn("px-2 py-1.5 text-xs font-semibold text-muted-foreground", className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  textValue,
  ref,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  const query = React.useContext(SelectSearchContext);
  const own = React.useRef<HTMLDivElement | null>(null);
  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      own.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  // The words searched: textValue, else the children's text, else what the
  // option shows on screen (one drawn by a component, e.g. a person's name).
  const hidden =
    query !== "" &&
    !matchesQuery(textValue ?? (textOf(children) || own.current?.textContent || ""), query);
  return (
    <SelectPrimitive.Item
      ref={setRef}
      data-slot="select-item"
      textValue={textValue}
      hidden={hidden || undefined}
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-lg py-1.5 pr-8 pl-2 text-sm outline-none select-none",
        "focus:bg-muted focus:text-foreground [&_svg:not([class*='text-'])]:text-muted-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "*:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  const query = React.useContext(SelectSearchContext);
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      hidden={query ? true : undefined}
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
