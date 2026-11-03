import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";

export interface SectionHeaderProps {
  /**
   * Already-translated section title (§6.4), shown at the left. Ignored when
   * `tabs` is set (a tab band doubles as the title — v2 §1).
   */
  title?: string;
  /**
   * The section's sidebar icon (#2552), drawn before `title` at the sidebar's
   * 18px so the header alone tells which section is open. Decorative: the
   * heading text is the name, so it is hidden from assistive tech. Ignored
   * when `tabs` is set, like `title`.
   */
  icon?: LucideIcon;
  /**
   * Already-translated supplementary text beside the title (#1643), in the
   * tertiary tone — Connect's "tags 14 / items 150". Ignored when `tabs` is
   * set, for the same reason `title` is: a tab band IS the title row.
   */
  subtitle?: string;
  /**
   * Tab band standing in for the title (v2 §1) — pass a <HeaderTabs
   * divider={false}> so this row's own full-width border is the only
   * divider (the active tab's -mb-px underline overlaps it).
   */
  tabs?: ReactNode;
  /**
   * The header's search field (CommandSearchField), drawn just before
   * `controls`. It sits in its own slot rather than inside `controls` because
   * it is the one control that may narrow when the row runs short (#2508):
   * the slot owns its width, so the field fills it.
   */
  search?: ReactNode;
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
 * HEIGHT (#1399): the min-height is the shared --spacing-lumen-header pair,
 * not a local literal. On the wide layout this row and the sidebar's brand
 * header are two top-of-screen rows that start at the same y, so a number only
 * one of them knows is a number they can disagree about — which is exactly how
 * the 12px step this token removed got in. See the token's own comment.
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
 * SHORT ROWS (#2508): when the tab band, the search field and the controls do
 * not fit, the search field narrows first and the tab band second. At 768px
 * the field used to keep its full 288px inside a `shrink-0` controls group,
 * which left Analytics' five tabs a 0px column. Three pieces decide the order:
 * - the tab column is `flex-auto` (basis = the band's natural width) instead
 *   of `flex-1` (basis 0), so it can claim room instead of only the leftovers;
 * - the search slot is a direct item of this row with an explicit
 *   `min-w-32` floor. Inside the controls group its fixed width counted as
 *   the group's minimum, and the group could never narrow;
 * - `shrink-[1000]` on the slot hands nearly all of the shortfall to the
 *   field until it reaches the floor. Only then does the tab column narrow,
 *   and its tablist scrolls the rest (HeaderTabs).
 * A title has no natural width worth defending, so it keeps `flex-1`.
 *
 * Pure presentation: DataService-free (§3.1), copy injected already-
 * translated (§6.4), lumen-* tokens only (§5).
 */
export function SectionHeader({
  title,
  icon: Icon,
  subtitle,
  tabs,
  search,
  controls,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-stretch border-b border-lumen-border bg-lumen-bg",
        "min-h-lumen-header px-lumen-gutter",
        "md:min-h-lumen-header-wide md:px-lumen-gutter-wide",
        className,
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-stretch",
          // Tabs only: the band's top padding lives HERE so the strip keeps
          // hugging the divider. A title has no underline to glue down, so it
          // stays unpadded and self-centres on the same line as the controls.
          tabs != null ? "flex-auto pt-3 md:pt-4" : "flex-1",
        )}
      >
        {tabs ?? (
          // The icon centres on the title line from an outer row: an svg in
          // the baseline row below would sit on the text baseline and ride
          // high. The 18px icon is shorter than the title's line box, so the
          // row's height does not change (#1399).
          <div className="flex min-w-0 items-center gap-2 self-center py-2">
            {Icon && (
              <Icon
                size={18}
                aria-hidden="true"
                className="shrink-0 text-lumen-text-secondary"
              />
            )}
            <div className="flex min-w-0 items-baseline gap-2">
              {/* Same size as the HeaderTabs labels, so a titled section does
                  not read smaller than a tabbed one (#2280). */}
              <h2 className="truncate text-sm font-semibold text-lumen-text md:text-base">
                {title}
              </h2>
              {subtitle && (
                <span className="truncate text-xs tabular-nums text-lumen-text-tertiary">
                  {subtitle}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      {search != null && (
        <div className="ml-2 flex items-center self-center md:w-72 md:min-w-32 md:shrink-[1000] xl:w-96">
          {search}
        </div>
      )}
      {controls != null && (
        <div
          className={cn(
            "flex shrink-0 items-center gap-1.5 self-center",
            // The same 6px the controls keep between each other, so the search
            // field reads as the first of them.
            search != null ? "pl-1.5" : "pl-2",
          )}
        >
          {controls}
        </div>
      )}
    </div>
  );
}
