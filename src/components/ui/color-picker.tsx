"use client";

import { CheckIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * ColorPicker — a swatch button that opens preset colours and a hex field, in
 * place of the browser's `<input type="color">`.
 *
 * The value is the customer's own data (an email accent, say), not a design
 * token, so the swatch is painted with an inline background here and nowhere else.
 *
 *   <ColorPicker value={accent} presets={EMAIL_ACCENT_PRESETS} onChange={setAccent} />
 */
function ColorPicker({
  value,
  onChange,
  presets = [],
  disabled = false,
  "aria-label": ariaLabel = "Pick a colour",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  presets?: readonly string[];
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(value);
  const shown = HEX.test(value) ? value : undefined;

  React.useEffect(() => setText(value), [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn("p-1.5", className)}
        >
          <span
            data-slot="color-swatch"
            className="size-full rounded-sm border border-border"
            style={{ backgroundColor: shown }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-3">
        {presets.length > 0 && (
          <div className="mb-3 grid grid-cols-6 gap-1.5">
            {presets.map((preset) => {
              const chosen = preset.toUpperCase() === value.toUpperCase();
              return (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={preset}
                  aria-pressed={chosen}
                  className="p-1"
                  onClick={() => {
                    onChange(preset.toUpperCase());
                    setOpen(false);
                  }}
                >
                  <span
                    className="flex size-full items-center justify-center rounded-sm text-primary-foreground drop-shadow-sm"
                    style={{ backgroundColor: preset }}
                  >
                    {chosen ? <CheckIcon className="size-3.5" /> : null}
                  </span>
                </Button>
              );
            })}
          </div>
        )}
        <Input
          aria-label="Hex colour"
          value={text}
          maxLength={7}
          placeholder="#RRGGBB"
          className="h-9 font-mono"
          onChange={(event) => {
            const next = event.target.value.trim();
            setText(next);
            if (HEX.test(next)) onChange(next.toUpperCase());
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export { ColorPicker };
