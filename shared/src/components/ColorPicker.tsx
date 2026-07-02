/*
 * ColorPicker — the shared color-change control (promoted from the Kanban's
 * KanbanColorControl so folder / tag / any future surface use ONE component,
 * matching the Desktop UnifiedColorPicker). Pure presentation (§6.4): the
 * palette is a shared constant, the chosen color is reported via onPick, and
 * all copy arrives as props. No DataService / no useTranslation here.
 *
 * Affordances (Desktop parity):
 *   - a curated preset swatch grid (KANBAN_COLOR_PRESETS by default)
 *   - a native <input type="color"> for a free-form custom hue
 *   - a "clear / default color" option
 *
 * Layout note: the trigger expands an INLINE panel below itself (not a
 * floating popover) so a parent with `overflow-hidden` (e.g. a Kanban column)
 * never clips it. Click-outside + Esc close it.
 *
 * Color is user data, applied via inline style (allowed — see Kanban/colors).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { cn } from "./cn";
import { KANBAN_COLOR_PRESETS } from "./Kanban/colors";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export interface ColorPickerProps {
  /** Current color (so the active swatch shows a check / the custom input
   *  seeds its value). */
  current?: string;
  /** Trigger + group label, already translated (§6.4). */
  label: string;
  /** "Clear / default color" option label, already translated. */
  clearLabel: string;
  /** Custom (free-form hex) input label, already translated. */
  customLabel: string;
  /** Pick a preset / custom color, or null to clear it. */
  onPick: (color: string | null) => void;
  /** Override the preset palette. Defaults to the shared 12-hue set. */
  presets?: readonly string[];
}

export function ColorPicker({
  current,
  label,
  clearLabel,
  customLabel,
  onPick,
  presets = KANBAN_COLOR_PRESETS,
}: ColorPickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Esc while open.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Preset pick closes the panel; custom-hue tweaks keep it open so the user
  // can fine-tune via the native picker without it snapping shut.
  const pickPreset = useCallback(
    (color: string | null) => {
      onPick(color);
      setOpen(false);
    },
    [onPick],
  );

  // Preview swatches on the trigger: the current color, or the first three
  // presets as a hint when no color is set yet.
  const previews = current ? [current] : presets.slice(0, 3);
  const customSeed = current && HEX_RE.test(current) ? current : "#808080";

  // The native color input streams onChange on every drag tick. Keep a local
  // value for instant visual feedback and commit (onPick) on a trailing
  // debounce so one drag is ONE persist — not a write storm + last-response-
  // wins race (the tag-color path is a network UPDATE per tick otherwise).
  const [customValue, setCustomValue] = useState(customSeed);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Re-seed when the committed color changes from outside (or on (re)open).
  useEffect(() => {
    setCustomValue(customSeed);
  }, [customSeed]);
  // Flush any pending commit timer on unmount.
  useEffect(
    () => () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    },
    [],
  );
  const onCustomInput = useCallback(
    (value: string) => {
      setCustomValue(value);
      if (commitTimer.current) clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(() => onPick(value), 200);
    },
    [onPick],
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink-border-strong",
          "px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-text-secondary",
          "transition-colors hover:bg-ink-hover hover:text-ink-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-accent",
        )}
      >
        <span aria-hidden className="inline-flex items-center gap-0.5">
          {previews.map((c, i) => (
            <span
              key={`${c}-${i}`}
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: c }}
            />
          ))}
        </span>
        {label}
      </button>

      {open && (
        <div
          role="group"
          aria-label={label}
          className={cn(
            "mt-2 rounded-lg border border-ink-border bg-ink-bg p-2 shadow-ink-md",
          )}
        >
          <div className="grid grid-cols-6 gap-1.5">
            {presets.map((color) => {
              const active = current?.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  aria-pressed={active}
                  title={color}
                  onClick={() => pickPreset(color)}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-md",
                    "transition-transform hover:scale-110",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-accent",
                    active &&
                      "ring-2 ring-ink-text ring-offset-1 ring-offset-ink-bg",
                  )}
                  style={{ backgroundColor: color }}
                >
                  {active && (
                    <Check
                      size={13}
                      aria-hidden
                      className="text-ink-on-accent"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom (free-form hex) via the native color input — Desktop parity. */}
          <label
            className={cn(
              "mt-2 flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1",
              "text-[0.75rem] font-medium text-ink-text-secondary",
              "transition-colors hover:bg-ink-hover hover:text-ink-text",
            )}
          >
            <input
              type="color"
              value={customValue}
              onChange={(e) => onCustomInput(e.target.value)}
              aria-label={customLabel}
              className="h-5 w-5 shrink-0 cursor-pointer rounded border border-ink-border bg-transparent p-0"
            />
            {customLabel}
          </label>

          <button
            type="button"
            onClick={() => pickPreset(null)}
            className={cn(
              "mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1",
              "text-[0.75rem] font-medium text-ink-text-secondary",
              "transition-colors hover:bg-ink-hover hover:text-ink-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-accent",
            )}
          >
            <Palette size={13} aria-hidden />
            {clearLabel}
          </button>
        </div>
      )}
    </div>
  );
}
