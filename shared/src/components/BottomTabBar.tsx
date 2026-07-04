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

export interface BottomTabBarLabels {
  more: string;
  /** Accessible title for the "More" sheet. */
  moreTitle: string;
}

export interface BottomTabBarProps {
  sections: BottomTabSection[];
  activeSection: string;
  onNavigate: (id: string) => void;
  /** How many sections show as fixed tabs before overflowing into "More". */
  maxVisible?: number;
  labels: BottomTabBarLabels;
}

/*
 * Narrow-layout bottom tab bar (W5 app shell). Shows the first
 * `maxVisible` sections as fixed tabs; the rest overflow into a "More"
 * tab that opens the shared BottomSheet. `env(safe-area-inset-bottom)`
 * keeps the bar clear of the iOS home indicator. Pure presentation:
 * sections + labels injected (§3.1 / §6.4), lumen-* tokens, opaque bar
 * background (§5).
 */
export function BottomTabBar({
  sections,
  activeSection,
  onNavigate,
  maxVisible = 4,
  labels,
}: BottomTabBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const visible = sections.slice(0, maxVisible);
  const overflow = sections.slice(maxVisible);
  const hasMore = overflow.length > 0;
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
      <nav
        aria-label={labels.moreTitle}
        className="flex shrink-0 border-t border-lumen-border bg-lumen-bg pb-[env(safe-area-inset-bottom)]"
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
              <span className="max-w-full truncate px-1">{s.label}</span>
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
        >
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
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm",
                      "transition-colors focus-visible:outline-none",
                      "focus-visible:ring-2 focus-visible:ring-lumen-accent",
                      isActive
                        ? "bg-lumen-hover font-medium text-lumen-text"
                        : "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn("shrink-0", isActive && "text-lumen-accent")}
                    >
                      {s.icon}
                    </span>
                    <span className="truncate">{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </BottomSheet>
      )}
    </>
  );
}
