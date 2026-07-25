import { useState } from "react";
import { ArrowDownUp, Check, ChevronDown, Search } from "lucide-react";
import { cn } from "../cn";
import { Menu, MenuItem } from "../Menu";

/*
 * Sidebar list controls (#283). A compact sort + optional-filter header row the
 * Materials rightSidebar lists (Notes / Daily) mount above their item list.
 * Pure presentation, DataService-free (§3.1): the mode picker + direction
 * toggle fire host-injected callbacks, the filter is a controlled input driven
 * only by onChange (NO keydown/Enter — IME safety, §Gotchas), and all copy is
 * already-translated props (§6.4 — no useTranslation here). lumen-* tokens only,
 * opaque surfaces (§5), sized for a ~240px sidebar.
 *
 * The mode-picker dropdown owns its own open/close state (local UI state, like
 * NoteDetailPanel's title draft) — the host only owns the active mode + the
 * change callback. When `modes.length <= 1` the picker is hidden entirely (the
 * Daily list passes a single mode and only toggles direction).
 */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

export type SidebarSortDirection = "asc" | "desc";

export interface SidebarSortMode {
  /** Stable id passed back through onModeChange. */
  id: string;
  /** Already-translated label shown in the trigger + menu (§6.4). */
  label: string;
}

export interface SidebarFilterConfig {
  /** Controlled input value (host owns the query state). */
  value: string;
  /** Fires on every keystroke with the raw value (onChange-only, IME-safe). */
  onChange: (value: string) => void;
  /** Already-translated placeholder + aria-label (§6.4). */
  placeholder: string;
  ariaLabel: string;
}

export interface SidebarListControlsProps {
  /** Sort modes; when length <= 1 the mode picker is hidden. */
  modes: SidebarSortMode[];
  /** Currently active mode id (must match one of `modes`). */
  activeModeId: string;
  onModeChange: (id: string) => void;
  /** Already-translated aria-label for the mode picker trigger + menu (§6.4). */
  sortLabel: string;
  /** Current sort direction — drives the toggle's aria-pressed + arrow. */
  direction: SidebarSortDirection;
  onToggleDirection: () => void;
  /** Already-translated label for the CURRENT direction (display + aria). */
  directionLabel: string;
  /** Already-translated aria-label for the direction toggle action (§6.4). */
  directionToggleLabel: string;
  /** Optional filter input — omit to render no filter row. */
  filter?: SidebarFilterConfig;
  className?: string;
}

export function SidebarListControls({
  modes,
  activeModeId,
  onModeChange,
  sortLabel,
  direction,
  onToggleDirection,
  directionLabel,
  directionToggleLabel,
  filter,
  className,
}: SidebarListControlsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const showModePicker = modes.length > 1;
  const activeMode = modes.find((m) => m.id === activeModeId);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Control row — mode picker (optional) + direction toggle. */}
      <div className="flex items-center gap-1.5">
        {showModePicker && (
          <div className="relative min-w-0 flex-1">
            <button
              type="button"
              // Open-only, per the <Menu> contract: its capture-phase
              // outside-pointerdown close fires before this click, so a naive
              // toggle would re-open (flicker). Closing is owned by <Menu>
              // (outside click / Esc / Tab) + onSelect below.
              onClick={() => setMenuOpen(true)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={sortLabel}
              className={cn(
                "flex h-8 w-full items-center gap-1.5 rounded-lumen-md border border-lumen-border",
                "bg-lumen-surface-sunken px-2.5 text-[12.5px] text-lumen-text",
                "transition-colors hover:bg-lumen-hover",
                FOCUS_RING,
              )}
            >
              <span className="min-w-0 flex-1 truncate text-left">
                {activeMode?.label ?? sortLabel}
              </span>
              <ChevronDown
                size={13}
                aria-hidden
                className="shrink-0 text-lumen-text-tertiary"
              />
            </button>
            <Menu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              label={sortLabel}
              className="w-full min-w-0"
            >
              {modes.map((mode) => (
                <MenuItem
                  key={mode.id}
                  aria-checked={mode.id === activeModeId}
                  icon={
                    mode.id === activeModeId ? (
                      <Check size={13} className="text-lumen-accent" />
                    ) : (
                      <span className="inline-block h-[13px] w-[13px]" />
                    )
                  }
                  onSelect={() => {
                    onModeChange(mode.id);
                    setMenuOpen(false);
                  }}
                >
                  {mode.label}
                </MenuItem>
              ))}
            </Menu>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleDirection}
          aria-pressed={direction === "desc"}
          aria-label={directionToggleLabel}
          title={directionToggleLabel}
          className={cn(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-lumen-md border border-lumen-border",
            "bg-lumen-surface-sunken px-2.5 text-[12.5px] text-lumen-text-secondary",
            "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
            // Fill the row when the mode picker is hidden (single-mode Daily).
            showModePicker ? "" : "flex-1 justify-center",
            FOCUS_RING,
          )}
        >
          <ArrowDownUp size={13} aria-hidden className="shrink-0" />
          <span className="truncate">{directionLabel}</span>
        </button>
      </div>

      {/* Filter row — controlled input, onChange-only (IME-safe, §Gotchas).
          Matches the NotesView search-box visual language. */}
      {filter && (
        <div className="flex h-8 items-center gap-2 rounded-lumen-md border border-lumen-border bg-lumen-surface-sunken px-2.5">
          <Search
            size={13}
            aria-hidden
            className="shrink-0 text-lumen-text-tertiary"
          />
          <input
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            placeholder={filter.placeholder}
            aria-label={filter.ariaLabel}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-lumen-text placeholder:text-lumen-text-tertiary focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
