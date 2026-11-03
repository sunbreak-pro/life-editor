import { useCallback, useState } from "react";
import type { MouseEvent, RefObject } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Menu, MenuItem, type MenuAnchorPoint } from "../Menu";

/*
 * One tag's action menu (#1676) — edit / delete — lifted out of the Connect
 * rail's row so another surface can offer the same actions on a tag it lists
 * (the Materials note sidebar is the first, #1677).
 *
 * ONE EDIT ITEM (#1886). It used to offer "Rename", "Change the icon" and
 * "Change the colour", but all three opened the same editor and differed only
 * in where the caret landed. They are one "Edit tag" now, which opens the
 * editor on the name field. The merge item (#1644) is gone with the feature.
 *
 * It opens two ways, and both land on the SAME menu: below its "…" button, or
 * at the pointer when the row is right-clicked. `useTagActionsMenu` below holds
 * which of the two is showing, so a host wires a trigger button and a
 * `contextmenu` handler and never tracks coordinates itself.
 *
 * What the actions DO is the host's: edit opens the host's editor, and delete
 * is a request — the host owns the confirmation layer. Every item closes the
 * menu before it reports, so a host that opens a dialog does not find the menu
 * still sitting over it.
 *
 * Pure presentation: copy is injected (§6.4), lumen-* tokens only (via Menu).
 */

/** The menu's own copy, already translated (§6.4). */
export interface TagActionsMenuLabels {
  /** The menu's accessible name, composed with the tag's ("Work: Tag actions"). */
  rowMenu: string;
  /** "Edit tag" — the one item that opens the editor (#1886). */
  editTagMenu: string;
  deleteTag: string;
}

export interface TagActionsMenuProps {
  open: boolean;
  onClose: () => void;
  /** The tag's display name, for the menu's accessible name. */
  tagName: string;
  /** The "…" trigger, so pressing it again closes rather than re-opens. */
  anchorRef?: RefObject<HTMLElement | null>;
  /** Set when opened by a right-click: the menu opens at this point. */
  anchorPoint?: MenuAnchorPoint | null;
  /** Edge to align to when opened below the trigger. */
  align?: "start" | "end";
  /** Open the host's editor on this tag, caret in the name field. */
  onEdit: () => void;
  /** The destructive item — the host asks before it deletes anything. */
  onDelete: () => void;
  labels: TagActionsMenuLabels;
}

export function TagActionsMenu({
  open,
  onClose,
  tagName,
  anchorRef,
  anchorPoint = null,
  align = "end",
  onEdit,
  onDelete,
  labels,
}: TagActionsMenuProps) {
  const act = (run: () => void) => {
    onClose();
    run();
  };

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorRef={anchorRef}
      anchorPoint={anchorPoint}
      align={align}
      label={`${tagName}: ${labels.rowMenu}`}
    >
      <MenuItem icon={<Pencil size={14} />} onSelect={() => act(onEdit)}>
        {labels.editTagMenu}
      </MenuItem>
      <MenuItem
        icon={<Trash2 size={14} />}
        variant="danger"
        onSelect={() => act(onDelete)}
      >
        {labels.deleteTag}
      </MenuItem>
    </Menu>
  );
}

export interface TagActionsMenuState {
  open: boolean;
  /**
   * Where the menu opens: the pointer after a right-click, the trigger's
   * bottom edge after the "…" (#2497). Null while closed, or when the trigger
   * was toggled without its click event.
   */
  anchorPoint: MenuAnchorPoint | null;
  /**
   * The "…" button's click: toggles the menu below the trigger. Pass it as
   * the button's `onClick` so it can read the button's position; called with
   * no event it falls back to the menu's in-flow placement under the trigger.
   */
  toggleFromTrigger: (event?: MouseEvent<HTMLElement>) => void;
  /**
   * A `contextmenu` handler: opens the menu at the pointer and suppresses the
   * browser's own menu. Only attach it where the menu is on offer — a row that
   * has no actions must leave the native menu alone.
   */
  openAtPointer: (event: MouseEvent) => void;
  close: () => void;
}

/** The gap between the trigger and the menu — Menu's in-flow `mt-1`. */
const TRIGGER_GAP = 4;

/**
 * The point a menu opened from `trigger` hangs from (#2497): just below it,
 * on the `align` edge, flipping above it when there is no room below.
 *
 * Why a point and not the in-flow `top-full` placement: the Connect rail's
 * rows sit inside a scrolling box, which clips an absolutely placed menu on
 * its last row ("Delete tag" was cut to 7px at 1280px). A `fixed` panel is
 * outside that clip and is kept on screen by Menu, the same path a right-click
 * already takes. The point is the in-flow position's own corner, so the menu
 * lands exactly where it did on every row that had room.
 */
function pointBelowTrigger(
  trigger: Element,
  align: "start" | "end" = "end",
): MenuAnchorPoint {
  const rect = trigger.getBoundingClientRect();
  return {
    x: align === "end" ? rect.right : rect.left,
    y: rect.bottom + TRIGGER_GAP,
    edge: align,
    flipY: rect.top - TRIGGER_GAP,
  };
}

/**
 * The open / anchor state behind one TagActionsMenu (#1676). The trigger's ref
 * stays with the caller (a ref handed back inside a hook's result reads as a
 * ref access during render to the React compiler's lint).
 *
 * `align` is the edge the "…"-opened menu lines up with, and must match the
 * `align` given to TagActionsMenu (both default to "end").
 */
export function useTagActionsMenu({
  align = "end",
}: { align?: "start" | "end" } = {}): TagActionsMenuState {
  const [open, setOpen] = useState(false);
  const [anchorPoint, setAnchorPoint] = useState<MenuAnchorPoint | null>(null);

  const toggleFromTrigger = useCallback(
    (event?: MouseEvent<HTMLElement>) => {
      // Read now, in the click: the point is fixed for as long as the menu is
      // open, the same as a right-click's.
      setAnchorPoint(
        event ? pointBelowTrigger(event.currentTarget, align) : null,
      );
      setOpen((v) => !v);
    },
    [align],
  );

  const openAtPointer = useCallback((event: MouseEvent) => {
    event.preventDefault();
    setAnchorPoint({ x: event.clientX, y: event.clientY });
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return {
    open,
    anchorPoint,
    toggleFromTrigger,
    openAtPointer,
    close,
  };
}
