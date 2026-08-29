import { Fragment } from "react";
import type { ReactNode } from "react";
import { NavItem } from "./NavItem";
import { cn } from "./cn";

export interface SettingsTabItem {
  /** Stable tab id — the value handed back to `onSelect`. */
  id: string;
  /** Already-translated row label (§6.4). */
  label: string;
  /** Already-sized glyph (e.g. `<Settings size={16} />`). */
  icon: ReactNode;
  /**
   * The row opens a centered panel instead of swapping the body (#1174 — Tips).
   * It never draws as the current row (nothing under it stays on screen) and is
   * separated from the tab rows by a rule.
   */
  opensPanel?: boolean;
}

export interface SettingsTabsNavProps {
  tabs: SettingsTabItem[];
  /** Id of the tab whose body is on screen. */
  value: string;
  onSelect: (id: string) => void;
  /** Already-translated accessible name for the nav (§6.4). */
  label: string;
  className?: string;
}

/*
 * SettingsTabsNav — the Settings section's category list, pushed into the
 * shared rightSidebar detail panel via a single RightSidebarPortal (#1174).
 * Replaces the tips/preview panel that used to occupy that face; the tips moved
 * to a centered panel opened by the last row.
 *
 * Built on <NavItem> so a settings category reads exactly like a sidebar
 * section row — same 36px height, same accent-subtle active surface with its
 * 3px bar, same aria-current="page". Pure presentation: labels and glyphs are
 * injected already-resolved (§6.4), lumen-* tokens only (§5), no DataService.
 *
 * A row flagged `opensPanel` never draws active: it raises a dialog, so there
 * is no body of its own for "current" to point at.
 */
export function SettingsTabsNav({
  tabs,
  value,
  onSelect,
  label,
  className,
}: SettingsTabsNavProps) {
  const panelRowStart = tabs.findIndex((tab) => tab.opensPanel);

  return (
    <nav aria-label={label} className={cn("flex flex-col gap-0.5", className)}>
      {tabs.map((tab, i) => (
        <Fragment key={tab.id}>
          {/* One rule, above the first panel-opening row. */}
          {tab.opensPanel && i === panelRowStart && (
            <div aria-hidden="true" className="my-1.5 h-px bg-lumen-border" />
          )}
          <NavItem
            icon={tab.icon}
            label={tab.label}
            active={!tab.opensPanel && tab.id === value}
            onClick={() => onSelect(tab.id)}
          />
        </Fragment>
      ))}
    </nav>
  );
}
