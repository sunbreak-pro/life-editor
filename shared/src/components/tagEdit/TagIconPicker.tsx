import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Tag as TagIcon } from "lucide-react";
import { useEscapeLayer } from "../../hooks/useDialogA11y";
import { cn } from "../cn";
import { resolveTagIcon, TAG_ICON_CHOICES } from "../tagIcon";
import { TagHeadingIcon } from "../TagHeadingIcon";
import { type TagEditModalLabels } from "./types";

interface TagIconPickerProps {
  current: string | null;
  color: string | null;
  onPick: (icon: string | null) => void;
  labels: TagEditModalLabels;
}

/** Inline icon picker: a trigger showing the current (resolved) icon, opening a
 *  curated grid below itself. Mirrors ColorPicker's open/close semantics. */
export function TagIconPicker({
  current,
  color,
  onPick,
  labels,
}: TagIconPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  // Escape closes the grid and stops there. The panel this picker lives in is a
  // dialog whose own Escape handler sits on `document` in the capture phase, so
  // a listener of our own would never be reached — one keypress used to take
  // the grid AND the tag edit modal, throwing away the unsaved name beside it
  // (#1342). Joining the dialog layer stack makes the topmost surface the only
  // one Escape reaches, so a second press is what closes the panel.
  const close = useCallback(() => setOpen(false), []);
  useEscapeLayer({ open, onEscape: close });

  const pick = useCallback(
    (name: string | null) => {
      onPick(name);
      setOpen(false);
    },
    [onPick],
  );

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={labels.iconLabel}
        aria-expanded={open}
        title={labels.iconLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lumen-md border border-lumen-border bg-lumen-bg text-lumen-text-secondary",
          "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
        )}
      >
        {/* Resolved through TagHeadingIcon (not a capitalized local) so the
            trigger draws the same glyph as a tag heading without declaring a
            component during render — see that file's note (#364 / #421). */}
        <TagHeadingIcon icon={current} color={color} />
      </button>

      {open && (
        <div
          role="group"
          aria-label={labels.iconLabel}
          /* Floats over the Modal panel, which is itself bg-lumen-bg — painting
             the popover with the same token left it with zero surface contrast,
             so the rows behind read straight through it (#552). It was never
             literally translucent; bg-secondary is the opaque step that makes
             the lift visible in BOTH themes (#f5ebda / #18243c), with the
             strong border + lg shadow + z-50 popover stacking Menu.tsx uses.
             `w-max` is load-bearing, not a tidy-up (#1289): this box is
             ABSOLUTE, so its containing block is the trigger — 32px wide — and
             an auto width there shrink-to-fits into whatever that block allows,
             floored by the content's MIN-content width. Tailwind's grid columns
             are `repeat(n, minmax(0, 1fr))`, whose min is literally 0, so the
             floor was the gaps alone and the panel painted ~32px wide while its
             28px icon buttons spilled out of their zero-width tracks across the
             name field beside it. That is what "the icon editor breaks and the
             background falls transparent" was: not a token that resolved to
             nothing, but an opaque surface drawn at a sixth of the width of the
             content sitting on it. ColorPicker never showed it because its
             panel is IN FLOW, so its own width feeds the flex item's. */
          className={cn(
            "absolute left-0 top-9 z-50 w-max rounded-lumen-md p-2",
            "border border-lumen-border-strong bg-lumen-bg-secondary shadow-lumen-lg",
          )}
        >
          {/* Scroll frame (#1366). The curated set went 26 → 56, and a grid
              with no cap grows a 28px row per 8 icons — the popover would hang
              past the bottom of the modal, and every future icon would push it
              further. Capping the frame at ~5 rows fixes the panel at roughly
              the height it had with 26 choices no matter how long
              TAG_ICON_CHOICES gets, and the row clipped at the fold is the
              affordance that says there is more below. `overscroll-contain`
              keeps a flick past the end from scrolling the tag list behind the
              modal. The explicit width is what makes the scrollbar safe: the
              panel's `w-max` measures THIS box, and an overflow box does not
              reserve gutter in its max-content width, so an auto width would
              let the bar eat into the last column. 17rem leaves every one of
              the 8 tracks ≥ the 28px button even with a bar drawn. */}
          <div className="max-h-[10.5rem] w-[17rem] overflow-y-auto overscroll-contain">
            <div className="grid grid-cols-8 justify-items-center gap-1">
              {TAG_ICON_CHOICES.map((choiceName) => {
                const Choice = resolveTagIcon(choiceName) ?? TagIcon;
                const active = current === choiceName;
                return (
                  <button
                    key={choiceName}
                    type="button"
                    aria-label={choiceName}
                    aria-pressed={active}
                    title={choiceName}
                    onClick={() => pick(choiceName)}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lumen-sm text-lumen-text-secondary",
                      "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                      active && "bg-lumen-accent-subtle text-lumen-accent",
                    )}
                  >
                    <Choice size={15} aria-hidden />
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => pick(null)}
            className={cn(
              "mt-1.5 flex w-full items-center gap-1.5 rounded-lumen-sm px-2 py-1 text-[0.75rem] font-medium text-lumen-text-secondary",
              "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            )}
          >
            <Check
              size={13}
              aria-hidden
              className={current ? "opacity-0" : ""}
            />
            {labels.clearIconLabel}
          </button>
        </div>
      )}
    </div>
  );
}
