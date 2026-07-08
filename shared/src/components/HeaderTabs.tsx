import { useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "./cn";

export interface HeaderTab {
  id: string;
  /** Already-translated tab label (§6.4). */
  label: string;
  /**
   * Optional count / marker pill. Omit on tabs without a meaningful count
   * (target-IA: badges only on tabs where a number means something, e.g.
   * Materials → Tasks unfinished count).
   */
  badge?: number | string;
}

export interface HeaderTabsProps {
  tabs: HeaderTab[];
  activeTab: string;
  onSelect: (id: string) => void;
  /** Already-translated accessible name for the tablist (§6.4). */
  label?: string;
  /**
   * Optional trailing node pinned to the right end of the tab row (target-IA:
   * the rightSidebar open/close toggle, App Shell Turn 2). Kept OUTSIDE the
   * role="tablist" element (a11y: a tablist should contain only tabs), so the
   * row is wrapped: outer border-b flex row > inner tablist + trailing.
   */
  trailing?: ReactNode;
  className?: string;
}

/*
 * Desktop-standard underline tab strip (target-IA header tabs). Active tab =
 * 2px accent underline + primary text + font-medium; inactive = secondary
 * text, hover lifts to primary + hover surface. Optional accent-subtle badge
 * pill (tabular-nums). WAI-ARIA tablist with roving tabindex: ←/→ move focus
 * across tabs and activate (automatic activation). Pure presentation: labels
 * injected already-translated (§6.4), lumen-* tokens only (§5).
 */
export function HeaderTabs({
  tabs,
  activeTab,
  onSelect,
  label,
  trailing,
  className,
}: HeaderTabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Keeps the tablist keyboard-reachable when activeTab matches no tab:
  // the first tab falls back to tabindex 0 (roving-tabindex invariant).
  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  const handleKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    if (tabs.length === 0) return;
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (index + dir + tabs.length) % tabs.length;
    const nextTab = tabs[next];
    if (!nextTab) return;
    refs.current[next]?.focus();
    onSelect(nextTab.id);
  };

  return (
    <div className={cn("flex border-b border-lumen-border", className)}>
      <div role="tablist" aria-label={label} className="flex gap-2">
        {tabs.map((tab, i) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active || (activeIndex === -1 && i === 0) ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={cn(
                "-mb-px flex items-center gap-1.5 px-3 py-2 text-sm",
                "transition-colors focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-lumen-accent",
                active
                  ? "border-b-2 border-lumen-accent font-medium text-lumen-text"
                  : "rounded-t-[6px] border-b-2 border-transparent text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
              )}
            >
              <span>{tab.label}</span>
              {tab.badge != null && (
                <span className="inline-flex h-[18px] items-center rounded-lumen-sm bg-lumen-accent-subtle px-1.5 text-xs font-medium tabular-nums text-lumen-accent">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {trailing != null && (
        <div className="ml-auto self-center pl-2">{trailing}</div>
      )}
    </div>
  );
}
