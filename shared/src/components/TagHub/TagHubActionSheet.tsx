import type { ReactNode } from "react";
import { BottomSheet } from "../BottomSheet";
import { cn } from "../cn";
import { FOCUS_RING_TIGHT } from "../styleTokens";

/*
 * The narrow layout's row menu (#1646 / M1–M3): the same actions the Desktop
 * "…" drops down, as a bottom sheet.
 *
 * A dropdown anchored to a 44px button at the right edge of a 390px screen
 * opens over the row it belongs to and is a thumb-stretch away; the sheet
 * comes up from the edge the thumb is already at. The actions themselves are
 * passed in, so the tag rail's four and the item row's two use one component
 * and cannot drift apart in height, focus ring or order.
 *
 * Rows are 52px (the brief's number), destructive ones tinted with the danger
 * token and given the trash glyph. Copy injected (§6.4), lumen-* only.
 */

export interface TagHubSheetAction {
  /** Stable key — also what a test names the row by, via `label`. */
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}

export interface TagHubActionSheetProps {
  open: boolean;
  onClose: () => void;
  /** The sheet's accessible name ("Work: Tag actions"). */
  title: string;
  /** The close button's accessible name. */
  closeLabel: string;
  actions: readonly TagHubSheetAction[];
}

export function TagHubActionSheet({
  open,
  onClose,
  title,
  closeLabel,
  actions,
}: TagHubActionSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      closeLabel={closeLabel}
    >
      <ul className="flex flex-col pb-2">
        {actions.map((action) => (
          <li key={action.label}>
            <button
              type="button"
              onClick={() => {
                // Close first: an action that opens a dialog must not find
                // this sheet still sitting over it.
                onClose();
                action.onSelect();
              }}
              className={cn(
                "flex min-h-[52px] w-full items-center gap-3 rounded-lumen-md px-3 text-left text-sm",
                "transition-colors hover:bg-lumen-hover",
                action.danger ? "text-lumen-danger" : "text-lumen-text",
                FOCUS_RING_TIGHT,
              )}
            >
              {action.icon ? (
                <span aria-hidden className="shrink-0">
                  {action.icon}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 truncate">{action.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
