import { Search } from "lucide-react";
import { cn } from "./cn";

/*
 * CommandSearchField (Issue #306) — the header-mounted command palette trigger.
 * Renders as a wide, input-styled button (search icon + placeholder + optional
 * ⌘K keycap); clicking / Enter / Space opens the existing CommandPalette
 * overlay (this field never renders inline results). Below `md` it collapses to
 * an icon-only button so the affordance survives on narrow widths.
 *
 * Focus does NOT open the palette: the overlay restores focus to this button on
 * close, so an onFocus-opens would reopen in a loop. Click / keyboard activate
 * is the trigger.
 *
 * Pure presentation (§3.1/§6.4): no DataService, no useTranslation. `onOpen`
 * and copy are injected. lumen-* tokens only; the field surface is opaque (§5).
 */

export interface CommandSearchFieldProps {
  /** Open the command palette overlay. */
  onOpen: () => void;
  /** Already-translated placeholder shown in the wide field. */
  placeholder: string;
  /** Already-translated a11y label (used for the icon-only narrow button too). */
  label: string;
  /** Optional keyboard-shortcut hint keycap (e.g. "⌘K"). */
  shortcutHint?: string;
  className?: string;
}

export function CommandSearchField({
  onOpen,
  placeholder,
  label,
  shortcutHint,
  className,
}: CommandSearchFieldProps) {
  return (
    <>
      {/* Wide (md+): input-styled trigger. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className={cn(
          "hidden w-52 items-center gap-2 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-2.5 py-1.5 text-left text-xs text-lumen-text-secondary transition-colors hover:border-lumen-border-strong hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent md:flex md:w-72 xl:w-96",
          className,
        )}
      >
        <Search aria-hidden className="size-3.5 shrink-0" />
        <span className="flex-1 truncate">{placeholder}</span>
        {shortcutHint && (
          <kbd className="shrink-0 rounded border border-lumen-border bg-lumen-bg px-1.5 py-px text-[10px] font-medium text-lumen-text-tertiary">
            {shortcutHint}
          </kbd>
        )}
      </button>
      {/* Narrow (< md): icon-only fallback. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className="flex size-8 items-center justify-center rounded-lumen-md border border-lumen-border text-lumen-text-secondary transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent md:hidden"
      >
        <Search aria-hidden className="size-4" />
      </button>
    </>
  );
}
