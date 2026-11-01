import type { ReactNode, Ref } from "react";
import { Unlink } from "lucide-react";
import { cn } from "../cn";

/*
 * ItemLinkPreviewCard (#2392) — what a link chip opens: the kind and the title
 * the chip no longer shows, a line of detail, an excerpt, and two buttons.
 *
 * Pure presentation (§6.4): every string arrives translated, and where the card
 * sits is the host's, through `className`, because only the host knows what the
 * card hangs from. lumen-* tokens only, on an opaque background (§5).
 *
 * The two lines below the title are optional, since a target can be in the trash
 * or be one the app cannot name. The remove button is the only thing every card
 * has, so a link to something gone can still be taken off.
 */

export interface ItemLinkPreviewCardOpenAction {
  label: string;
  /** Already drawn, like the kind's icon. */
  icon: ReactNode;
  onPress: () => void;
}

export interface ItemLinkPreviewCardProps {
  /** Accessible name of the card. */
  dialogLabel: string;
  kindLabel: string;
  /** The kind's glyph, already drawn with its tint. */
  kindIcon: ReactNode;
  title: string;
  /** Hover text on the title, for a target whose name is only part of its id. */
  titleHint?: string;
  /** Strikes the title through: the target is in the trash. */
  struck?: boolean;
  /** Second line: when it was updated, its status, its date and time. */
  detail?: string;
  /** Up to the host's limit of the item's text. */
  excerpt?: string;
  /** Shown in place of the detail while it is being read. */
  loadingLabel?: string;
  /** Absent when the target cannot be opened. */
  openAction?: ItemLinkPreviewCardOpenAction;
  unlinkLabel: string;
  onUnlink: () => void;
  panelRef?: Ref<HTMLDivElement>;
  className?: string;
}

const FOOT_BUTTON =
  "inline-flex items-center gap-1.5 rounded-lumen-sm px-2 py-1 text-xs font-medium hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent max-md:min-h-11";

export function ItemLinkPreviewCard({
  dialogLabel,
  kindLabel,
  kindIcon,
  title,
  titleHint,
  struck = false,
  detail,
  excerpt,
  loadingLabel,
  openAction,
  unlinkLabel,
  onUnlink,
  panelRef,
  className,
}: ItemLinkPreviewCardProps) {
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={dialogLabel}
      className={cn(
        "rounded-lumen-md border border-lumen-border bg-lumen-bg p-2.5 text-left font-normal shadow-lumen-md",
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-[0.6875rem] text-lumen-text-secondary">
        {kindIcon}
        {kindLabel}
      </p>
      <p
        title={titleHint}
        className={cn(
          "mt-1 break-words text-sm font-semibold text-lumen-text",
          struck && "line-through",
        )}
      >
        {title}
      </p>
      {detail ? (
        <p className="mt-0.5 text-xs text-lumen-text-secondary">{detail}</p>
      ) : loadingLabel ? (
        <p className="mt-0.5 text-xs text-lumen-text-tertiary">
          {loadingLabel}
        </p>
      ) : null}
      {excerpt && (
        <p className="mt-1.5 break-words text-xs text-lumen-text-secondary">
          {excerpt}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-lumen-border pt-2">
        {openAction && (
          <button
            type="button"
            onClick={openAction.onPress}
            className={cn(FOOT_BUTTON, "text-lumen-text")}
          >
            {openAction.icon}
            {openAction.label}
          </button>
        )}
        <button
          type="button"
          onClick={onUnlink}
          className={cn(FOOT_BUTTON, "ml-auto text-lumen-text-secondary")}
        >
          <Unlink aria-hidden className="size-3.5 shrink-0" />
          {unlinkLabel}
        </button>
      </div>
    </div>
  );
}
