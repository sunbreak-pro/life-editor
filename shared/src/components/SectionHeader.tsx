import type { ReactNode } from "react";
import { cn } from "./cn";

export interface SectionHeaderProps {
  /**
   * Already-translated section title (§6.4), shown at the left. Ignored when
   * `tabs` is set (a tab band doubles as the title — v2 §1).
   */
  title?: string;
  /**
   * Tab band standing in for the title (v2 §1) — pass a <HeaderTabs
   * divider={false}> so this row's own full-width border is the only
   * divider (the active tab's -mb-px underline overlaps it).
   */
  tabs?: ReactNode;
  /**
   * Right-end controls, order fixed by the standard (v2 §1/§5): width tab
   * first, then the rightSidebar toggle. Rendered ABOVE the divider, so the
   * controls never move when the panel below opens/closes (v2 §4).
   */
  controls?: ReactNode;
  className?: string;
}

/*
 * SectionHeader — the standard section header row (Layout Standard v2 §1).
 * One row for all 7 sections: left = section title (or a tab band doubling
 * as the title), right end = width tab + rightSidebar toggle, and a
 * full-width divider (border-lumen-border — the v1 tab-band underline token)
 * directly below.
 *
 * The host mounts this in AppShell's `header` slot, ABOVE the main +
 * detail-panel flex row (v2 §4): the divider then spans main AND panel, the
 * panel opens below the line, and this row keeps its width regardless of the
 * panel state. Gutter = the v1 page-gutter tokens, so the left edge lines up
 * with PageContainer content.
 *
 * Pure presentation: DataService-free (§3.1), copy injected already-
 * translated (§6.4), lumen-* tokens only (§5).
 */
export function SectionHeader({
  title,
  tabs,
  controls,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-stretch border-b border-lumen-border bg-lumen-bg",
        "px-lumen-gutter pt-3 md:px-lumen-gutter-wide md:pt-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-stretch">
        {tabs ?? (
          <h2 className="self-center truncate py-2 text-sm font-semibold text-lumen-text">
            {title}
          </h2>
        )}
      </div>
      {controls != null && (
        <div className="flex shrink-0 items-center gap-1.5 self-center pl-2">
          {controls}
        </div>
      )}
    </div>
  );
}
