"use client";

import { UploadIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NativeFileProps = Omit<React.ComponentProps<"input">, "type" | "value">;

/**
 * FileInput — a "Choose file" button with the chosen file's name, in place of
 * the browser's own file box. Files can also be dropped onto it.
 *
 * It keeps the native `onChange(event)` contract, so `event.target.files` works
 * as before. Pass `file` when the screen holds the chosen file in state, so the
 * name clears when the screen clears it.
 *
 *   <FileInput id="doc" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
 */
function FileInput({
  className,
  ref,
  onChange,
  disabled,
  multiple,
  file,
  placeholder = "No file chosen",
  buttonLabel = "Choose file",
  ...props
}: NativeFileProps & {
  /** The file the screen holds; controls the name shown. */
  file?: File | null;
  placeholder?: string;
  buttonLabel?: string;
}) {
  const inner = React.useRef<HTMLInputElement | null>(null);
  const [chosen, setChosen] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const setRefs = React.useCallback(
    (node: HTMLInputElement | null) => {
      inner.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.RefObject<HTMLInputElement | null>).current = node;
    },
    [ref],
  );

  const shown = file !== undefined ? (file?.name ?? null) : chosen;

  function remember(list: FileList | null) {
    if (!list || list.length === 0) setChosen(null);
    else setChosen(list.length === 1 ? list[0].name : `${list.length} files`);
  }

  return (
    <div
      data-slot="file-input"
      aria-disabled={disabled || undefined}
      className={cn(
        "flex h-11 w-full min-w-0 items-center gap-3 rounded-lg border border-input bg-card pr-3 pl-1.5 text-sm shadow-xs transition-[color,box-shadow]",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40",
        "has-[input[aria-invalid=true]]:border-destructive",
        dragging && "border-ring ring-[3px] ring-ring/40",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const input = inner.current;
        if (disabled || !input || event.dataTransfer.files.length === 0) return;
        const transfer = new DataTransfer();
        const dropped = Array.from(event.dataTransfer.files);
        (multiple ? dropped : dropped.slice(0, 1)).forEach((item) => transfer.items.add(item));
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }}
    >
      <input
        ref={setRefs}
        type="file"
        data-slot="input"
        className="sr-only"
        disabled={disabled}
        multiple={multiple}
        onChange={(event) => {
          remember(event.target.files);
          onChange?.(event);
        }}
        {...props}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => inner.current?.click()}
      >
        <UploadIcon />
        {buttonLabel}
      </Button>
      <span className={cn("min-w-0 truncate", shown ? "text-foreground" : "text-muted-foreground")}>
        {shown ?? placeholder}
      </span>
    </div>
  );
}

/**
 * The bare file chooser, hidden, for screens that open it from their own Button
 * (`ref.current?.click()`), such as a camera capture or an "Upload" action.
 */
function HiddenFileInput({ className, ...props }: NativeFileProps) {
  return <input type="file" tabIndex={-1} className={cn("sr-only", className)} {...props} />;
}

export { FileInput, HiddenFileInput };
