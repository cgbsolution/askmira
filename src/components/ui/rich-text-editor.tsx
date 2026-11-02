"use client";

import DOMPurify from "dompurify";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Braces,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  SeparatorHorizontal,
  Underline,
  Undo2,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface RichTextField {
  token: string;
  label: string;
  group: string;
}

const TOKEN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_.]*)\s*\}\}/g;

/** What a stored template may carry into the editor: the letter's own markup, no script. */
function sanitise(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["data-token", "contenteditable", "cellspacing", "cellpadding", "colspan", "width"],
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input"],
  });
}

/** What may come in from a paste (Word, a web page): structure and emphasis only. */
function sanitisePaste(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "b", "em", "i", "u", "sup", "sub", "ul", "ol", "li",
      "h1", "h2", "h3", "table", "thead", "tbody", "tr", "td", "th",
    ],
    ALLOWED_ATTR: ["colspan"],
  });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function chip(token: string, labels: Map<string, string>): string {
  const label = labels.get(token) ?? token;
  return (
    `<span data-token="${escapeHtml(token)}" contenteditable="false" class="letter-token" ` +
    `title="${escapeHtml(token)}">${escapeHtml(label)}</span>`
  );
}

/** Stored template → editor: tokens in text become labelled chips. */
function toEditor(html: string, labels: Map<string, string>): string {
  const doc = new DOMParser().parseFromString(`<body>${sanitise(html)}</body>`, "text/html");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  for (const node of texts) {
    const value = node.nodeValue ?? "";
    if (!TOKEN.test(value)) continue;
    TOKEN.lastIndex = 0;
    const holder = doc.createElement("span");
    holder.innerHTML = escapeHtml(value).replace(TOKEN, (_, token: string) => chip(token, labels));
    node.replaceWith(...Array.from(holder.childNodes));
  }
  return doc.body.innerHTML;
}

/** Editor → stored template: chips back to {{tokens}}. */
function fromEditor(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc.querySelectorAll("span[data-token]").forEach((element) => {
    element.replaceWith(doc.createTextNode(`{{${element.getAttribute("data-token")}}}`));
  });
  return doc.body.innerHTML;
}

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          // Keep the caret in the letter: a mousedown on the button would take focus.
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * RichTextEditor — a document editor in place of a raw HTML textarea.
 *
 * Bold, headings, alignment, lists and page breaks from the toolbar; named
 * fields (`{{employee.designation}}`) from Insert field, shown as labelled chips
 * and written back as their tokens. The HTML underneath is kept as it is, so
 * tables and layouts a document already has survive editing. Stored HTML is
 * sanitised before it is shown, and a paste keeps structure and emphasis only.
 *
 *   <RichTextEditor id="body" value={html} onChange={setHtml} fields={fields} />
 */
function RichTextEditor({
  id,
  value,
  onChange,
  fields,
  disabled = false,
  "aria-label": ariaLabel = "Document text",
  className,
}: {
  id: string;
  "aria-label"?: string;
  value: string;
  onChange: (html: string) => void;
  fields: RichTextField[];
  disabled?: boolean;
  className?: string;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const savedRange = useRef<Range | null>(null);
  const labels = useMemo(() => new Map(fields.map((f) => [f.token, f.label])), [fields]);
  const groups = useMemo(() => {
    const byGroup = new Map<string, RichTextField[]>();
    for (const field of fields) {
      byGroup.set(field.group, [...(byGroup.get(field.group) ?? []), field]);
    }
    return Array.from(byGroup.entries());
  }, [fields]);

  // Load from outside (another template, the HTML tab) — never echo our own edits back.
  useEffect(() => {
    const element = editor.current;
    if (!element || value === emitted.current) return;
    element.innerHTML = toEditor(value.trim() ? value : "<p><br></p>", labels);
    emitted.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Field names that arrive (or change) after the text: relabel the chips where
  // they stand, so the caret and the text around them are untouched.
  useEffect(() => {
    editor.current?.querySelectorAll<HTMLElement>("span[data-token]").forEach((element) => {
      const label = labels.get(element.dataset.token ?? "");
      if (label && element.textContent !== label) element.textContent = label;
    });
  }, [labels]);

  const emit = useCallback(() => {
    const element = editor.current;
    if (!element) return;
    const html = fromEditor(element.innerHTML);
    emitted.current = html;
    onChange(html);
  }, [onChange]);

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editor.current?.contains(range.commonAncestorContainer)) {
      savedRange.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const element = editor.current;
    if (!element) return;
    element.focus();
    const selection = window.getSelection();
    if (savedRange.current && selection) {
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    }
  };

  const run = (command: string, argument?: string) => {
    restoreSelection();
    document.execCommand(command, false, argument);
    rememberSelection();
    emit();
  };

  const insertHtml = (html: string) => {
    restoreSelection();
    document.execCommand("insertHTML", false, html);
    rememberSelection();
    emit();
  };

  /**
   * Put a field chip where the caret was, without needing focus: the Insert
   * field menu holds focus while it is open, so execCommand cannot be used.
   * No caret yet: the chip goes at the end of the letter.
   */
  const insertField = (token: string) => {
    const element = editor.current;
    if (!element) return;
    let range = savedRange.current;
    if (!range || !element.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
    }
    range.deleteContents();
    const holder = document.createElement("span");
    holder.innerHTML = chip(token, labels);
    const node = holder.firstChild as HTMLElement;
    const space = document.createTextNode(" ");
    range.insertNode(space);
    range.insertNode(node);
    const caret = document.createRange();
    caret.setStartAfter(space);
    caret.collapse(true);
    savedRange.current = caret;
    emit();
    // Back to typing, after the menu has given focus back to its button.
    setTimeout(() => {
      element.focus();
      const selection = window.getSelection();
      if (selection && savedRange.current) {
        selection.removeAllRanges();
        selection.addRange(savedRange.current);
      }
    }, 0);
  };

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    if (html) {
      document.execCommand("insertHTML", false, toEditor(sanitisePaste(html), labels));
    } else {
      document.execCommand("insertText", false, text);
    }
    emit();
  };

  return (
    <div data-slot="rich-text-editor" className={cn("overflow-hidden rounded-lg border border-input bg-background", className)}>
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1"
      >
        <ToolButton label="Bold" disabled={disabled} onClick={() => run("bold")}>
          <Bold />
        </ToolButton>
        <ToolButton label="Italic" disabled={disabled} onClick={() => run("italic")}>
          <Italic />
        </ToolButton>
        <ToolButton label="Underline" disabled={disabled} onClick={() => run("underline")}>
          <Underline />
        </ToolButton>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolButton label="Heading" disabled={disabled} onClick={() => run("formatBlock", "h2")}>
          <Heading2 />
        </ToolButton>
        <ToolButton label="Normal text" disabled={disabled} onClick={() => run("formatBlock", "p")}>
          <Pilcrow />
        </ToolButton>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolButton label="Align left" disabled={disabled} onClick={() => run("justifyLeft")}>
          <AlignLeft />
        </ToolButton>
        <ToolButton label="Centre" disabled={disabled} onClick={() => run("justifyCenter")}>
          <AlignCenter />
        </ToolButton>
        <ToolButton label="Align right" disabled={disabled} onClick={() => run("justifyRight")}>
          <AlignRight />
        </ToolButton>
        <ToolButton label="Justify" disabled={disabled} onClick={() => run("justifyFull")}>
          <AlignJustify />
        </ToolButton>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolButton label="Bulleted list" disabled={disabled} onClick={() => run("insertUnorderedList")}>
          <List />
        </ToolButton>
        <ToolButton label="Numbered list" disabled={disabled} onClick={() => run("insertOrderedList")}>
          <ListOrdered />
        </ToolButton>
        <ToolButton
          label="Page break"
          disabled={disabled}
          onClick={() => insertHtml('<div class="page-break"></div><p><br></p>')}
        >
          <SeparatorHorizontal />
        </ToolButton>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolButton label="Undo" disabled={disabled} onClick={() => run("undo")}>
          <Undo2 />
        </ToolButton>
        <ToolButton label="Redo" disabled={disabled} onClick={() => run("redo")}>
          <Redo2 />
        </ToolButton>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || fields.length === 0}
                onMouseDown={() => rememberSelection()}
              >
                <Braces /> Insert field
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-80 w-72 overflow-y-auto"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              {groups.map(([group, items], index) => (
                <DropdownMenuGroup key={group}>
                  {index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-xs text-muted-foreground">{group}</DropdownMenuLabel>
                  {items.map((field) => (
                    <DropdownMenuItem
                      key={field.token}
                      onSelect={() => insertField(field.token)}
                    >
                      <span className="truncate">{field.label}</span>
                      <span className="ml-auto truncate font-mono text-[10px] text-muted-foreground">
                        {field.token}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div
        id={id}
        ref={editor}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emit}
        // Enter starts a paragraph, as a letter is written, not a bare <div>.
        onFocus={() => document.execCommand("defaultParagraphSeparator", false, "p")}
        onBlur={() => {
          rememberSelection();
          emit();
        }}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onPaste={onPaste}
        className={cn(
          "max-h-[60vh] min-h-72 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-foreground outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring/40",
          "[&_p]:mb-2 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold",
          "[&_h3]:mb-2 [&_h3]:font-semibold [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-6",
          "[&_table]:mb-2 [&_table]:w-full [&_td]:px-1 [&_td]:py-0.5 [&_th]:px-1 [&_th]:py-0.5",
          "[&_td.line]:border-b [&_td.line]:border-foreground/60",
          "[&_table.grid_td]:border [&_table.grid_td]:border-border [&_table.grid_th]:border [&_table.grid_th]:border-border [&_table.grid_th]:bg-muted",
          "[&_.page-break]:my-4 [&_.page-break]:border-t-2 [&_.page-break]:border-dashed [&_.page-break]:border-border",
          "[&_.page-break]:before:block [&_.page-break]:before:text-center [&_.page-break]:before:text-[10px] [&_.page-break]:before:uppercase [&_.page-break]:before:tracking-wider [&_.page-break]:before:text-muted-foreground [&_.page-break]:before:content-['New_page']",
          "[&_.letter-token]:mx-0.5 [&_.letter-token]:inline-block [&_.letter-token]:rounded [&_.letter-token]:bg-accent [&_.letter-token]:px-1.5 [&_.letter-token]:text-xs [&_.letter-token]:font-medium [&_.letter-token]:text-accent-foreground",
          disabled && "cursor-not-allowed opacity-60",
        )}
      />
    </div>
  );
}

export { RichTextEditor };
