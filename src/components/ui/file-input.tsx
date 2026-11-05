"use client";

import { Loader2, UploadIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useUploadLimit } from "@/hooks/useUploadLimit";
import { shrinkPhoto, tooLarge } from "@/lib/uploads";
import { cn } from "@/lib/utils";

type NativeFileProps = Omit<React.ComponentProps<"input">, "type" | "value">;

interface UploadRules {
  /**
   * The largest file accepted, in bytes. Defaults to the workspace's upload
   * limit (Settings → Company → Workspace); `false` turns the check off, for a
   * camera capture that sizes its own frames.
   */
  maxBytes?: number | false;
  /** Shrink JPEG and WebP photos before they are handed on. On by default. */
  shrink?: boolean;
}

/**
 * Every chosen file passes through here before the screen sees it: photos
 * are shrunk (the server compresses everything again before storing it), and
 * a file over the limit is refused with the reason at once, before a slow
 * upload, and is never handed on.
 */
function usePreparedChange(
  onChange: React.ChangeEventHandler<HTMLInputElement> | undefined,
  { maxBytes, shrink = true }: UploadRules,
) {
  const workspace = useUploadLimit();
  const limit = maxBytes === undefined ? workspace.bytes : maxBytes;
  const [preparing, setPreparing] = React.useState(false);

  const handle = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const picked = Array.from(input.files ?? []);
      const needsWork = shrink && picked.some((file) => file.type === "image/jpeg" || file.type === "image/webp");
      let files = picked;
      if (needsWork) {
        setPreparing(true);
        try {
          files = await Promise.all(picked.map(shrinkPhoto));
        } finally {
          setPreparing(false);
        }
      }
      const problem = limit === false ? null : files.map((file) => tooLarge(file, limit)).find(Boolean);
      if (problem) {
        toast.error(problem);
        input.value = "";
        return false;
      }
      if (files.some((file, index) => file !== picked[index])) {
        const transfer = new DataTransfer();
        files.forEach((file) => transfer.items.add(file));
        input.files = transfer.files;
      }
      onChange?.(event);
      return true;
    },
    [limit, onChange, shrink],
  );

  return { handle, preparing };
}

/**
 * FileInput — a "Choose file" button with the chosen file's name, in place of
 * the browser's own file box. Files can also be dropped onto it.
 *
 * It keeps the native `onChange(event)` contract, so `event.target.files` works
 * as before; the files in it are already shrunk and within the upload limit.
 * Pass `file` when the screen holds the chosen file in state, so the name
 * clears when the screen clears it.
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
  maxBytes,
  shrink,
  ...props
}: NativeFileProps &
  UploadRules & {
    /** The file the screen holds; controls the name shown. */
    file?: File | null;
    placeholder?: string;
    buttonLabel?: string;
  }) {
  const inner = React.useRef<HTMLInputElement | null>(null);
  const [chosen, setChosen] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const { handle, preparing } = usePreparedChange(onChange, { maxBytes, shrink });

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
      aria-busy={preparing || undefined}
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
        disabled={disabled || preparing}
        multiple={multiple}
        onChange={(event) => {
          const input = event.target;
          // A refused file leaves the last good choice showing: the screen still holds it.
          void handle(event).then((kept) => kept && remember(input.files));
        }}
        {...props}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        tabIndex={-1}
        disabled={disabled || preparing}
        onClick={() => inner.current?.click()}
      >
        {preparing ? <Loader2 className="animate-spin" /> : <UploadIcon />}
        {buttonLabel}
      </Button>
      <span className={cn("min-w-0 truncate", shown && !preparing ? "text-foreground" : "text-muted-foreground")}>
        {preparing ? "Preparing the photo…" : (shown ?? placeholder)}
      </span>
    </div>
  );
}

/**
 * The bare file chooser, hidden, for screens that open it from their own Button
 * (`ref.current?.click()`), such as a camera capture or an "Upload" action.
 * Chosen files are shrunk and held to the upload limit as in `FileInput`.
 */
function HiddenFileInput({ className, onChange, maxBytes, shrink, ...props }: NativeFileProps & UploadRules) {
  const { handle } = usePreparedChange(onChange, { maxBytes, shrink });
  return (
    <input
      type="file"
      tabIndex={-1}
      className={cn("sr-only", className)}
      onChange={(event) => void handle(event)}
      {...props}
    />
  );
}

export { FileInput, HiddenFileInput };
