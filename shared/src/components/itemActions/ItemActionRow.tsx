import { cn } from "../cn";
import type { ItemAction } from "./types";

/*
 * ItemActionRow (Issue #307) — the single presentational row shared by every
 * item operation panel. Renders one ItemAction: leading icon, label, danger /
 * disabled styling. The panel owns click semantics (inline-input swap etc.)
 * via `onActivate`. (The `stub` placeholder branch and its "soon" badge left
 * with #551's last consumer — retired by #572.)
 *
 * Pure presentation: lumen-* tokens only, copy pre-translated (§3.1/§6.4).
 */

export const ITEM_ACTION_ROW_CLASS =
  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lumen-accent";

export interface ItemActionRowProps {
  action: ItemAction;
  /** Called with the action when an enabled row is clicked. */
  onActivate: (action: ItemAction) => void;
}

export function ItemActionRow({ action, onActivate }: ItemActionRowProps) {
  const isDisabled = !!action.disabled;
  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={isDisabled || undefined}
      disabled={isDisabled}
      onClick={() => {
        if (!isDisabled) onActivate(action);
      }}
      className={cn(
        ITEM_ACTION_ROW_CLASS,
        action.danger
          ? "text-lumen-danger hover:bg-lumen-danger-subtle"
          : "text-lumen-text hover:bg-lumen-hover",
        isDisabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
      )}
    >
      {action.icon && (
        <span className="shrink-0 [&_svg]:size-3.5">{action.icon}</span>
      )}
      <span className="flex-1 truncate">{action.label}</span>
    </button>
  );
}
