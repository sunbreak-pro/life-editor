import type { ReactNode } from "react";
import { SegmentedControl, type SegmentedOption } from "../SegmentedControl";
import { cn } from "../cn";

export interface ScheduleSidebarTab {
  id: string;
  /** Already-translated tab label (§6.4). */
  label: string;
}

export interface ScheduleSidebarTabsProps {
  tabs: ScheduleSidebarTab[];
  value: string;
  onChange: (id: string) => void;
  /** Already-translated accessible name for the tab switcher (§6.4). */
  label?: string;
  /** Body of the active tab — the host switches it on `value`. */
  children: ReactNode;
  className?: string;
}

/*
 * ScheduleSidebarTabs — the frame the Schedule section pushes into the shared
 * rightSidebar detail panel via a SINGLE RightSidebarPortal. A thin switcher
 * over the shell-owned <SegmentedControl> plus a plain body, so the Calendar
 * tab can flip between "今日の流れ" and "詳細" inside one portal (contentCount
 * stays 1 — two portals would stack) and the Routines tab reuses the same
 * chrome with a single tab.
 *
 * Pure presentation: labels injected already-translated (§6.4), lumen-* tokens
 * only (§5), no DataService (§3.1). The panel body (RightSidebarContents) owns
 * the scroll + padding, so this only lays out switcher-over-body and lets the
 * content flow. With one tab the switcher disappears entirely — the shell
 * panel already shows a "詳細" heading, so any heading here would duplicate it.
 */
export function ScheduleSidebarTabs({
  tabs,
  value,
  onChange,
  label,
  children,
  className,
}: ScheduleSidebarTabsProps) {
  const single = tabs.length <= 1;
  // ScheduleSidebarTab is structurally a SegmentedOption ({ id, label }).
  const options: SegmentedOption[] = tabs;
  const activeLabel = tabs.find((t) => t.id === value)?.label;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {!single && (
        <SegmentedControl
          options={options}
          value={value}
          onChange={onChange}
          label={label}
        />
      )}
      {/* aria-label (not aria-labelledby): the shell-owned SegmentedControl
          renders its tabs without ids, so the panel names itself instead. */}
      <div
        role={single ? undefined : "tabpanel"}
        aria-label={single ? undefined : activeLabel}
      >
        {children}
      </div>
    </div>
  );
}
