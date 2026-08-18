import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "./cn";
import { FOCUS_RING_ON_ACCENT } from "./styleTokens";

/**
 * The one placement definition for the narrow layout's floating "+" (#632).
 *
 * Why `absolute` and not `fixed`: on mobile Chrome `position: fixed` resolves
 * against the LAYOUT viewport, which stays at the large (URL-bar-hidden)
 * height. The shell is sized from the SMALL viewport (`--app-shell-height`,
 * which is `100svh` outside the iOS home-screen app) — so a fixed `bottom-6`
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
 * NO HOST TODAY. Notes' FAB went with #876, Schedule's with #1034 (both moved
 * to the `AddPill` in a list header, which is reachable without covering the
 * last row). The component and its test are kept rather than retired: the
 * placement reasoning above is the expensive part, it was learned from three
 * separate bugs, and a future narrow surface that genuinely wants a floating
 * "+" should start from it instead of rediscovering `fixed` the hard way.
 * Retiring it is a separate call (P-002 wants the grep in the PR body).
 *
 * Historically both hosts satisfied both halves of the contract through
 * PageContainer `width="fluid"`, a padding-free box with a definite height.
 * Schedule always renders that way; Materials does so on the NARROW layout
 * only (`narrowWidth` in web/src/sectionDescriptors.tsx), which is what #875
 * fixed — until then it rendered through `width="wide"`, a page scroller
 * wrapping an auto-height `px-lumen-gutter` block, so NotesView's `h-full` root
 * computed to auto and the FAB parked at the end of the note list, 40px inside
 * the edge where Schedule's sat at 24px.
 *
 * Clearance: the button occupies OFFSET + SIZE = 24 + 56 = 80px of the bottom
 * strip, so the list under it needs at least that much bottom padding or the
 * last row's right end sits beneath it and a "open this row" tap misses (#509).
 * Both former hosts used `pb-24` (96px) — keep new hosts on that number.
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
      className={cn(
        FAB_PLACEMENT,
        FAB_SURFACE,
        FOCUS_RING_ON_ACCENT,
        className,
      )}
    >
      {icon ?? <Plus aria-hidden className="size-6" />}
    </button>
  );
}
