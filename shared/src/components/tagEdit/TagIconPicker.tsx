import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Tag as TagIcon } from "lucide-react";
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
             strong border + lg shadow + z-50 popover stacking Menu.tsx uses. */
          className={cn(
            "absolute left-0 top-9 z-50 rounded-lumen-md p-2",
            "border border-lumen-border-strong bg-lumen-bg-secondary shadow-lumen-lg",
          )}
        >
          <div className="grid grid-cols-6 gap-1">
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
