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
 * Replaces the tips/preview panel that used to occupy that face.
 *
 * Built on <NavItem> so a settings category reads exactly like a sidebar
 * section row — same 36px height, same accent-subtle active surface with its
 * 3px bar, same aria-current="page". Pure presentation: labels and glyphs are
 * injected already-resolved (§6.4), lumen-* tokens only (§5), no DataService.
 */
export function SettingsTabsNav({
  tabs,
  value,
  onSelect,
  label,
  className,
}: SettingsTabsNavProps) {
  return (
    <nav aria-label={label} className={cn("flex flex-col gap-0.5", className)}>
      {tabs.map((tab) => (
        <NavItem
          key={tab.id}
          icon={tab.icon}
          label={tab.label}
          active={tab.id === value}
          onClick={() => onSelect(tab.id)}
          /* #1562: NavItem's resting row is 36px, which is a mouse target.
               The floor is applied HERE and not in NavItem because the same
               primitive draws the Desktop sidebar, where 36px is the whole
               point of the row's density. `min-h-*` rather than `h-11`: `cn`
               is a plain string join, so two utilities for one property are
               settled by Tailwind's emit order (rules/frontend.md). */
          className="max-md:min-h-11"
        />
      ))}
    </nav>
  );
}
