import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  isImeComposing,
  ItemLinkPreviewCard,
  useFloatingDismiss,
  useTranslation,
} from "@life-editor/shared";
import type {
  ItemLinkPreviewSource,
  ItemLinkPreviewTarget,
} from "../notes/useItemLinkPreview";
import { itemOpenAction } from "../schedule/itemOpenAction";
import { describeLinkPreview } from "./linkPreviewCopy";
import type { LinkChipPopover } from "./useLinkChipPopover";

/*
 * One link chip and the panel it opens (#2392). The chip is always a button,
 * even for a target the app cannot open, because the panel is where a link is
 * read and taken off.
 *
 * The panel is a child of the chip's own box:
 *
 *   - Desktop: the box is `relative`, so the panel hangs right under its chip.
 *     Being a DOM child also means moving onto the panel is not leaving the
 *     chip, and Tab goes from the chip straight to the panel's buttons.
 *   - Below the breakpoint: the box is `static`, so the panel hangs from the
 *     header row and spans it, as the "+" popover does. The chip strip scrolls
 *     sideways but is not positioned, so its overflow does not clip the panel.
 *
 * Touch pointers skip the hover path: a tap opens through the click, and a
 * reveal during the hover a tap imitates can cost iOS Safari that click.
 */

/** Space kept to the viewport's edge when a Desktop panel would run past it. */
const EDGE_GAP_PX = 8;

const PANEL_PLACEMENT =
  "absolute left-0 top-full z-20 mt-1 w-[17rem] max-w-[calc(100vw-2rem)] max-md:right-0 max-md:w-auto max-md:max-w-none";

export interface LinkChipPanelContent {
  dialogLabel: string;
  kindLabel: string;
  kindIcon: ReactNode;
  title: string;
  titleHint?: string;
  struck: boolean;
  /** What to read for the detail. Null: nothing to read, say why with `note`. */
  previewTarget: ItemLinkPreviewTarget | null;
  /** The detail line for a target with nothing to read. */
  note?: string;
  /** Absent when the target cannot be opened. */
  onOpen?: () => void;
  onUnlink: () => void;
}

interface LinkChipProps {
  id: string;
  name: string;
  /** The square's look, from the row: closed and open differ only in color. */
  boxClass: string;
  closedClass: string;
  openClass: string;
  glyph: ReactNode;
  popover: LinkChipPopover;
  previews?: ItemLinkPreviewSource;
  /** Only called while the panel is open. */
  panel: () => LinkChipPanelContent;
}

export function LinkChip({
  id,
  name,
  boxClass,
  closedClass,
  openClass,
  glyph,
  popover,
  previews,
  panel,
}: LinkChipProps) {
  const boxRef = useRef<HTMLSpanElement | null>(null);
  const chipRef = useRef<HTMLButtonElement | null>(null);
  // A press focuses the chip too. The click decides what it means, so that focus
  // must not count as the keyboard arriving.
  const pressing = useRef(false);
  const returningFocus = useRef(false);
  const isOpen = popover.openId === id;

  return (
    <span
      ref={boxRef}
      className="relative inline-flex shrink-0 max-md:static"
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") popover.hoverIn(id);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") popover.hoverOut(id);
      }}
      onFocus={() => {
        if (pressing.current) {
          pressing.current = false;
          return;
        }
        if (!returningFocus.current) popover.focusIn(id);
      }}
      onBlur={(e) => {
        pressing.current = false;
        // No relatedTarget: the window lost focus, or the click landed on
        // nothing focusable, which the outside-press listener already handles.
        const next = e.relatedTarget;
        if (next instanceof Node && !e.currentTarget.contains(next)) {
          popover.focusOut(id);
        }
      }}
      onKeyDown={(e) => {
        // The document listener does the closing. This only keeps the focus
        // from falling to <body> with the panel it was in.
        if (e.key !== "Escape" || !isOpen || isImeComposing(e)) return;
        returningFocus.current = true;
        chipRef.current?.focus();
        returningFocus.current = false;
      }}
    >
      <button
        ref={chipRef}
        type="button"
        aria-label={name}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onPointerDown={() => {
          pressing.current = true;
        }}
        onClick={() => {
          pressing.current = false;
          popover.press(id);
        }}
        className={`${boxClass} ${isOpen ? openClass : closedClass}`}
      >
        {glyph}
      </button>
      {isOpen && (
        <OpenPanel
          boxRef={boxRef}
          onClose={popover.close}
          previews={previews}
          content={panel()}
        />
      )}
    </span>
  );
}

function OpenPanel({
  boxRef,
  onClose,
  previews,
  content,
}: {
  boxRef: React.RefObject<HTMLSpanElement | null>;
  onClose: () => void;
  previews?: ItemLinkPreviewSource;
  content: LinkChipPanelContent;
}) {
  const { t, i18n } = useTranslation();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [, setLanded] = useState(0);
  const { previewTarget } = content;

  useFloatingDismiss(boxRef, onClose);

  // iOS Safari sends no mousedown for a tap on something that is not clickable,
  // so the mousedown listener above would leave the panel up on a phone.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [boxRef, onClose]);

  // A chip near the right edge would hang its 17rem past the window. Below the
  // breakpoint the panel spans the row, so this never applies there.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const past =
      panel.getBoundingClientRect().right - (window.innerWidth - EDGE_GAP_PX);
    if (past > 0) panel.style.transform = `translateX(${-past}px)`;
  }, []);

  const targetId = previewTarget?.id;
  const targetRole = previewTarget?.role;
  const targetDate = previewTarget?.date;
  const known =
    previews && targetId !== undefined ? previews.peek(targetId) : undefined;

  useEffect(() => {
    if (!previews || targetId === undefined || targetRole === undefined) return;
    if (known !== undefined) return;
    let live = true;
    previews.load({ id: targetId, role: targetRole, date: targetDate }).then(
      () => {
        if (live) setLanded((n) => n + 1);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [previews, targetId, targetRole, targetDate, known]);

  const reading = !!previewTarget && !!previews && known === undefined;
  const openAction = previewTarget ? itemOpenAction(previewTarget.role) : null;
  const OpenIcon = openAction?.icon;
  const detail = known
    ? describeLinkPreview(known, t, i18n.language)
    : failed
      ? t("materials.links.previewFailed")
      : content.note;

  return (
    <ItemLinkPreviewCard
      panelRef={panelRef}
      dialogLabel={content.dialogLabel}
      kindLabel={content.kindLabel}
      kindIcon={content.kindIcon}
      title={content.title}
      titleHint={content.titleHint}
      struck={content.struck}
      detail={detail}
      excerpt={known?.excerpt}
      loadingLabel={
        reading && !failed ? t("materials.links.previewLoading") : undefined
      }
      openAction={
        openAction && OpenIcon && content.onOpen
          ? {
              label: t(openAction.labelKey),
              icon: <OpenIcon aria-hidden className="size-3.5 shrink-0" />,
              onPress: content.onOpen,
            }
          : undefined
      }
      unlinkLabel={t("materials.links.unlink")}
      onUnlink={content.onUnlink}
      className={PANEL_PLACEMENT}
    />
  );
}
