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
   * Right-end controls (v2 §1) — currently the rightSidebar toggle (the
   * width tab was retired 2026-07-11; all sections are wide). Rendered ABOVE
   * the divider, so the controls never move when the panel below opens/closes
   * (v2 §4).
   */
  controls?: ReactNode;
  className?: string;
}

/*
 * SectionHeader — the standard section header row (Layout Standard v2 §1).
 * One row for all 7 sections: left = section title (or a tab band doubling
 * as the title), right end = the rightSidebar toggle (the v2 §5 width tab was
 * retired 2026-07-11 — all sections are wide), and a full-width divider
 * (border-lumen-border — the v1 tab-band underline token) directly below.
 *
 * The host mounts this in AppShell's `header` slot, ABOVE the main +
 * detail-panel flex row (v2 §4): the divider then spans main AND panel, the
 * panel opens below the line, and this row keeps its width regardless of the
 * panel state. Gutter = the v1 page-gutter tokens, so the left edge lines up
 * with PageContainer content.
 *
 * VERTICAL RHYTHM (#1283): the row sets a min-height and carries NO vertical
 * padding of its own, so `self-center` lands on the band's TRUE centre. It
 * used to centre inside the padding box instead — `pt-4` with no `pb` — which
 * left the search field about 18px below the top border and 2px above the
 * divider: low, and cramped. The top padding moved onto the LEFT column, and
 * only when that column holds a tab band. The strip has to stay glued to the
 * bottom so its `-mb-px` underline overlaps this row's border-b (HeaderTabs),
 * while a plain title has no underline to glue and centres with the controls.
 * Do not put `pt-*` back on the row — that is the regression.
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
        "min-h-14 px-lumen-gutter md:min-h-15 md:px-lumen-gutter-wide",
        className,
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 items-stretch",
          // Tabs only: the band's top padding lives HERE so the strip keeps
          // hugging the divider. A title has no underline to glue down, so it
          // stays unpadded and self-centres on the same line as the controls.
          tabs != null && "pt-3 md:pt-4",
        )}
      >
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
