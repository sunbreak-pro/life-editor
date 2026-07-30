import { Search } from "lucide-react";
import { cn } from "../cn";

/*
 * Name-filter field (#283, extracted from SidebarListControls in #368).
 *
 * The filter row the Materials lists carry inside <SidebarListControls>, split
 * into its own component so a surface that wants ONLY a filter can mount it
 * alone. The tag master list (#368) is that surface: `allTags` already arrives
 * name-ordered from the service query, so the panel needs the narrowing input
 * and deliberately NO sort controls (D-20260728-main-3 scoped #368 down to
 * "name filter only").
 *
 * Pure presentation, DataService-free (§3.1): a controlled input driven only by
 * onChange (NO keydown/Enter — IME safety, §Gotchas) with already-translated
 * copy as props (§6.4). lumen-* tokens only, opaque surfaces (§5).
 *
 * `size` is a preset for the surrounding surface rather than a free knob, since
 * `cn` is a plain joiner (no tailwind-merge) and a caller's className cannot
 * override the defaults:
 *   - "sm" — the 12.5px sidebar row on a sunken surface (Notes / Daily).
 *   - "md" — the 14px modal row on the panel surface, so it matches the inputs
 *     it sits next to (the tag editor's add field is `bg-lumen-bg` + border).
 */

export interface SidebarFilterConfig {
  /** Controlled input value (host owns the query state). */
  value: string;
  /** Fires on every keystroke with the raw value (onChange-only, IME-safe). */
  onChange: (value: string) => void;
  /** Already-translated placeholder + aria-label (§6.4). */
  placeholder: string;
  ariaLabel: string;
}

export interface SidebarFilterFieldProps extends SidebarFilterConfig {
  /** Surface preset — "sm" = sidebar row (default), "md" = modal row. */
  size?: "sm" | "md";
  className?: string;
}

export function SidebarFilterField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  size = "sm",
  className,
}: SidebarFilterFieldProps) {
  const md = size === "md";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lumen-md border border-lumen-border",
        md ? "h-9 bg-lumen-bg px-3" : "h-8 bg-lumen-surface-sunken px-2.5",
        // Focus affordance on the modal preset only (#368 QA): every control
        // beside it inside a dialog draws a ring, so an unringed field loses
        // the keyboard user. The sidebar preset stays ringless to match the
        // hand-rolled search boxes it sits next to.
        md && "focus-within:ring-2 focus-within:ring-lumen-accent",
        className,
      )}
    >
      <Search
        size={md ? 14 : 13}
        aria-hidden
        className="shrink-0 text-lumen-text-tertiary"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-lumen-text placeholder:text-lumen-text-tertiary focus:outline-none",
          md ? "text-sm" : "text-[12.5px]",
        )}
      />
    </div>
  );
}
