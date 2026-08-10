import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "./cn";
import { FOCUS_RING } from "./styleTokens";

/**
 * The one placement definition for the narrow layout's floating "+" (#632).
 *
 * Why `absolute` and not `fixed`: on mobile Chrome `position: fixed` resolves
 * against the LAYOUT viewport, which stays at the large (URL-bar-hidden)
 * height. The shell is `h-[100svh]` — the small one — so a fixed `bottom-6`
 * lands below the visible area whenever the URL bar is showing, and appears to
 * slide as the bar collapses. Anchoring inside the shell instead pins the
 * button to the section box, which ends above the bottom tab bar and never
 * moves. Schedule used to be `fixed bottom-6 right-6`, Notes `absolute
 * bottom-5 right-5`; both now come from here.
 *
 * No `env(safe-area-inset-bottom)` margin: that was needed while the button was
 * viewport-anchored and could land in the home-indicator strip. Inside the
 * shell the bottom tab bar already owns that strip (BottomTabBar's own
 * `pb-[env(safe-area-inset-bottom)]`), so re-applying the inset here would only
 * push the button up by a constant it no longer needs to clear.
 *
 * HOST CONTRACT — the anchor must be a `relative` ancestor that (a) carries no
 * padding and (b) actually spans the section box, i.e. sits in a chain with a
 * definite height. Both halves bite, and only the first is obvious:
 *   - padding on the anchor shifts the offsets, because absolute insets resolve
 *     against the anchor's padding box;
 *   - an auto-height anchor pins the button to the END OF THE CONTENT rather
 *     than to the visible box, so it scrolls away with the document.
 *
 * Schedule satisfies both: it renders through PageContainer `width="fluid"`,
 * a padding-free box with a definite height, so CalendarTab's wrapper spans the
 * section. **Notes does not yet.** Materials is not full-bleed
 * (`ownsFullBleed` in web/src/MainScreen.tsx), so it renders through
 * `width="wide"` — a page scroller wrapping an auto-height `px-lumen-gutter`
 * block. NotesView's `h-full` root therefore computes to auto and sits 16px
 * inside the gutter, which means its FAB parks at the end of the note list and
 * lands 40px from the section edge where Schedule's lands 24px. Closing that
 * gap means putting Materials on the fluid variant for the narrow layout, which
 * also moves scroll ownership for Daily — queued as `D-20260810-mobile-3` and
 * deliberately NOT done here (MainScreen.tsx is outside #632's scope, and the
 * change needs a real browser to confirm).
 *
 * Clearance: the button occupies OFFSET + SIZE = 24 + 56 = 80px of the bottom
 * strip, so the list under it needs at least that much bottom padding or the
 * last row's right end sits beneath it and a "open this row" tap misses (#509).
 * Both current hosts use `pb-24` (96px) — keep new hosts on that number.
 */
const FAB_PLACEMENT = "absolute bottom-6 right-6 z-30";

const FAB_SURFACE =
  "grid size-14 place-items-center rounded-full bg-lumen-accent text-lumen-on-accent shadow-lumen-lg transition-colors hover:bg-lumen-accent-hover";

export interface MobileFabProps {
  onClick: () => void;
  /**
   * Accessible label. Hosts pass translated copy — shared components never call
   * `useTranslation` themselves (rules/frontend.md §デザイン規約).
   */
  label: string;
  /** Glyph override. Defaults to a plus, which is what every current host wants. */
  icon?: ReactNode;
  className?: string;
}

export function MobileFab({ onClick, label, icon, className }: MobileFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(FAB_PLACEMENT, FAB_SURFACE, FOCUS_RING, className)}
    >
      {icon ?? <Plus aria-hidden className="size-6" />}
    </button>
  );
}
