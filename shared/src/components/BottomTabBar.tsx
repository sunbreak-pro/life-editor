import { useState } from "react";
import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "./cn";
import { BottomSheet } from "./BottomSheet";

export interface BottomTabSection {
  id: string;
  /** Already-translated label (§6.4). */
  label: string;
  /** Already-sized icon node. */
  icon: ReactNode;
}

export interface BottomTabActionRowProps {
  /** Already-translated row label (§6.4). */
  label: string;
  /** Already-sized icon node, drawn like a section row's icon. */
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}

export interface BottomTabBarLabels {
  more: string;
  /** Accessible title for the "More" sheet. */
  moreTitle: string;
  /** Name for the "More" sheet's close button (#525). */
  moreClose: string;
  /** Accessible label for the action group inside the sheet (#472). */
  actionsTitle?: string;
}

export interface BottomTabBarProps {
  sections: BottomTabSection[];
  activeSection: string;
  onNavigate: (id: string) => void;
  /** How many sections show as fixed tabs before overflowing into "More". */
  maxVisible?: number;
  labels: BottomTabBarLabels;
  /**
   * App-global rows rendered above the overflow sections in the "More" sheet
   * (#472), inside the sheet's own list. Gets `closeSheet` so a row that opens
   * another surface can get the sheet out of the way; repeatable rows
   * (undo/redo) ignore it and stay put, since closing on the first tap would
   * make a three-step undo three reopens. Actions alone are enough to surface
   * the More tab, so a host with four-or-fewer sections still reaches them.
   *
   * Return a COMPONENT (built from <BottomTabActionRow>), not inline hook
   * calls: the node renders inside THIS component, so hooks called in the
   * callback body would join BottomTabBar's hook list. The web host needs that
   * anyway — its UndoRedo Provider sits between the host's body and the shell,
   * so the rows must read context from their own component.
   */
  actions?: (closeSheet: () => void) => ReactNode;
}

/*
 * One row inside the "More" sheet — the same shape the overflow sections use,
 * exported (#472) so a host composes its action rows out of the sheet's own
 * styling instead of re-deriving it and drifting.
 */
const SHEET_ROW =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

export function BottomTabActionRow({
  label,
  icon,
  onSelect,
  disabled,
}: BottomTabActionRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className={cn(
          SHEET_ROW,
          "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "disabled:hover:bg-transparent disabled:hover:text-lumen-text-secondary",
        )}
      >
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </button>
    </li>
  );
}

/*
 * Narrow-layout bottom tab bar (W5 app shell). Shows the first
 * `maxVisible` sections as fixed tabs; the rest overflow into a "More"
 * tab that opens the shared BottomSheet. `env(safe-area-inset-bottom)`
 * keeps the bar clear of the iOS home indicator. Pure presentation:
 * sections + labels injected (§3.1 / §6.4), lumen-* tokens, opaque bar
 * background (§5).
 *
 * Since #472 the sheet also carries app-global `actions` above the overflow
 * sections — the narrow layout renders no header slot, so this is where
 * cross-section controls (undo/redo, the command palette) reach the user.
 */
export function BottomTabBar({
  sections,
  activeSection,
  onNavigate,
  maxVisible = 4,
  labels,
  actions,
}: BottomTabBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const visible = sections.slice(0, maxVisible);
  const overflow = sections.slice(maxVisible);
  const hasOverflow = overflow.length > 0;
  const hasActions = actions != null;
  // Actions alone justify the tab: a host with 4-or-fewer sections must still
  // be able to reach its undo/redo.
  const hasMore = hasOverflow || hasActions;
  const moreActive = overflow.some((s) => s.id === activeSection);

  const tabClass = (isActive: boolean) =>
    cn(
      "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
      isActive
        ? "text-lumen-accent"
        : "text-lumen-text-secondary hover:text-lumen-text",
    );

  return (
    <>
      {/*
       * The home-indicator strip (#791). The tabs already carry `py-2`, so
       * 0.5rem of clearance sits under the labels before this padding starts;
       * reserving the FULL inset here put 0.5rem + 34px between the labels and
       * the screen edge, and that surplus is the band of dead space the PWA
       * report called "wider than expected". Adding only the REMAINDER lands
       * the labels exactly `env(safe-area-inset-bottom)` above the edge — the
       * clearance iOS actually asks for, no more.
       *
       * `max(0px, …)` is what keeps every non-notched target byte-identical to
       * before: the inset is 0 in a desktop browser and in Chrome-on-iOS with
       * its toolbar up, so the whole expression collapses to 0 and the bar is
       * the `py-2` it has always been. The tabs keep their own padding, so no
       * touch target shrinks either.
       */}
      <nav
        aria-label={labels.moreTitle}
        className="flex shrink-0 border-t border-lumen-border bg-lumen-bg pb-[max(0px,calc(env(safe-area-inset-bottom)_-_0.5rem))]"
      >
        {visible.map((s) => {
          const isActive = activeSection === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onNavigate(s.id)}
              aria-label={s.label}
              aria-current={isActive ? "page" : undefined}
              className={tabClass(isActive)}
            >
              <span aria-hidden="true">{s.icon}</span>
              <span
                className={cn(
                  "max-w-full truncate px-1",
                  isActive && "font-medium",
                )}
              >
                {s.label}
              </span>
            </button>
          );
        })}
        {hasMore && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label={labels.more}
            aria-current={moreActive ? "page" : undefined}
            className={tabClass(moreActive)}
          >
            <span aria-hidden="true">
              <MoreHorizontal size={20} />
            </span>
            <span className="max-w-full truncate px-1">{labels.more}</span>
          </button>
        )}
      </nav>

      {hasMore && (
        <BottomSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          title={labels.moreTitle}
          closeLabel={labels.moreClose}
        >
          {/* App-global actions (#472) — above the sections, since they act on
              the current screen rather than navigating away from it. */}
          {hasActions && (
            <ul aria-label={labels.actionsTitle} className="space-y-0.5">
              {actions?.(() => setMoreOpen(false))}
            </ul>
          )}

          {hasActions && hasOverflow && (
            <div
              role="separator"
              className="my-2 border-t border-lumen-border"
            />
          )}

          {hasOverflow && (
            <ul className="space-y-0.5">
              {overflow.map((s) => {
                const isActive = activeSection === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate(s.id);
                        setMoreOpen(false);
                      }}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        SHEET_ROW,
                        isActive
                          ? "bg-lumen-hover font-medium text-lumen-text"
                          : "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "shrink-0",
                          isActive && "text-lumen-accent",
                        )}
                      >
                        {s.icon}
                      </span>
                      <span className="truncate">{s.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </BottomSheet>
      )}
    </>
  );
}
