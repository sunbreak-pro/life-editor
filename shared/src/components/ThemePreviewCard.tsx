import { Check } from "lucide-react";
import { cn } from "./cn";

/** How the miniature mock is painted: a fixed theme, or a light/dark split. */
export type ThemePreview = "light" | "dark" | "split";

export interface ThemePreviewCardProps<V extends string = string> {
  /** Which value this card selects (e.g. "light" / "dark" / "system"). */
  value: V;
  /** Already-translated card label (e.g. "ライト" / "Light"). */
  label: string;
  /** True when this is the active selection. */
  selected: boolean;
  onSelect: (value: V) => void;
  /**
   * Mock paint override. Defaults to the value when it is "light" / "dark";
   * "system" (or any non-theme value) falls back to a light/dark "split" mock
   * so the OS-follow option reads at a glance. Explicitly settable.
   */
  preview?: ThemePreview;
}

/*
 * Miniature theme-preview selection card (radio-equivalent). Pure /
 * props-injected (CLAUDE.md §6.4). lumen-* tokens only, opaque surfaces (§5).
 *
 * The miniature screen mock is wrapped in `data-theme` so its lumen-* tokens
 * resolve to THAT theme regardless of the app's current theme — the light card
 * always shows a light mock, the dark card a dark mock, and the "split" mock
 * (used by the "system" option) shows a light half + a dark half. This relies
 * on tokens.css exposing both `[data-theme="light"]` and `[data-theme="dark"]`
 * scopes (the light scope was added so a fixed-light preview works even while
 * the app itself is dark). The outer chrome (border / label / check) uses the
 * live app theme.
 */
export function ThemePreviewCard<V extends string = string>({
  value,
  label,
  selected,
  onSelect,
  preview,
}: ThemePreviewCardProps<V>) {
  const paint: ThemePreview =
    preview ??
    (value === "light" ? "light" : value === "dark" ? "dark" : "split");

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={() => onSelect(value)}
      className={cn(
        "relative flex flex-col gap-2 rounded-lumen-md bg-lumen-bg p-2.5 text-left",
        "transition-colors focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-lumen-accent",
        selected
          ? "border-2 border-lumen-accent"
          : "border border-lumen-border hover:border-lumen-border-strong",
      )}
    >
      {selected && (
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 grid h-[18px] w-[18px] place-items-center rounded-full bg-lumen-accent text-lumen-on-accent"
        >
          <Check size={11} strokeWidth={3} />
        </span>
      )}

      {/* Fixed-theme miniature screen mock (or a light|dark split for system). */}
      {paint === "split" ? (
        <div
          aria-hidden="true"
          className="flex h-[76px] overflow-hidden rounded-lumen-sm border border-lumen-border"
        >
          <div data-theme="light" className="w-1/2 bg-lumen-bg">
            <ThemeMockContent />
          </div>
          <div data-theme="dark" className="w-1/2 bg-lumen-bg">
            <ThemeMockContent />
          </div>
        </div>
      ) : (
        <div
          data-theme={paint}
          aria-hidden="true"
          className="flex h-[76px] overflow-hidden rounded-lumen-sm border border-lumen-border bg-lumen-bg"
        >
          <ThemeMockSidebar />
          <ThemeMockBody />
        </div>
      )}

      <span
        className={cn(
          "text-center text-sm",
          selected
            ? "font-medium text-lumen-text"
            : "text-lumen-text-secondary",
        )}
      >
        {label}
      </span>
    </button>
  );
}

/** Sidebar + body mock (the full miniature screen). */
function ThemeMockContent() {
  return (
    <div className="flex h-full">
      <ThemeMockSidebar />
      <ThemeMockBody />
    </div>
  );
}

function ThemeMockSidebar() {
  return (
    <div className="flex w-[26%] flex-col gap-[5px] border-r border-lumen-border bg-lumen-bg-subsidebar px-1.5 py-[7px]">
      <span className="h-[5px] w-4/5 rounded-full bg-lumen-accent-subtle" />
      <span className="h-[5px] w-[70%] rounded-full bg-lumen-border" />
      <span className="h-[5px] w-3/4 rounded-full bg-lumen-border" />
    </div>
  );
}

function ThemeMockBody() {
  return (
    <div className="flex flex-1 flex-col gap-1.5 px-2.5 py-[9px]">
      <span className="h-1.5 w-[70%] rounded-full bg-lumen-surface-sunken" />
      <span className="h-1.5 w-[52%] rounded-full bg-lumen-surface-sunken" />
      <span className="mt-1 h-[11px] w-[34px] rounded-full bg-lumen-accent" />
    </div>
  );
}
