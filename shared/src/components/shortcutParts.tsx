import { cn } from "./cn";
import type { ShortcutCategory } from "../types/shortcut";
import type { ShortcutRow } from "./SettingsShortcuts";

/** Fixed display order for the category groups. */
export const CATEGORY_ORDER: ShortcutCategory[] = [
  "global",
  "navigation",
  "edit",
];

/** Group rows by category, preserving CATEGORY_ORDER and dropping empty groups. */
export function groupByCategory(
  rows: ShortcutRow[],
): { category: ShortcutCategory; rows: ShortcutRow[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    rows: rows.filter((r) => r.category === category),
  })).filter((g) => g.rows.length > 0);
}

/** Small category caption above each group. */
export function CategoryLabel({ children }: { children: string }) {
  return (
    <div className="px-0.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-lumen-text-secondary">
      {children}
    </div>
  );
}

/**
 * Render an accelerator ("⌘ + K") as one kbd chip per key. Splitting on " + "
 * matches bindingToDisplayString's join, so ⌘ and K become separate chips.
 */
export function KbdChips({
  displayString,
  className,
}: {
  displayString: string;
  className?: string;
}) {
  const keys = displayString ? displayString.split(" + ") : ["—"];
  return (
    <span className={cn("flex items-center gap-1", className)}>
      {keys.map((k, i) => (
        <kbd
          key={`${k}-${i}`}
          className={cn(
            "inline-flex h-[22px] min-w-[22px] items-center justify-center",
            "rounded-lumen-sm border border-lumen-border bg-lumen-bg-secondary",
            "px-1.5 text-xs tabular-nums text-lumen-text-secondary",
          )}
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
