import { useCallback, useState } from "react";
import type { MouseEvent, RefObject } from "react";
import { Palette, Pencil, Shapes, Trash2 } from "lucide-react";
import { Menu, MenuItem, type MenuAnchorPoint } from "../Menu";
import type { TagHubEditField } from "./TagHubEditBlock";

/*
 * One tag's action menu (#1676) — rename / change the icon / change the colour
 * / delete — lifted out of the Connect rail's row so another surface can offer
 * the same four actions on a tag it lists (the Materials note sidebar is the
 * first, #1677).
 *
 * It opens two ways, and both land on the SAME menu: below its "…" button, or
 * at the pointer when the row is right-clicked. `useTagActionsMenu` below holds
 * which of the two is showing, so a host wires a trigger button and a
 * `contextmenu` handler and never tracks coordinates itself.
 *
 * What the actions DO is the host's: the three identity items name the field
 * the host's editor should open on (TagHubEditBlock takes the same
 * TagHubEditField), and delete is a request — the host owns the confirmation
 * layer. Every item closes the menu before it reports, so a host that opens a
 * dialog does not find the menu still sitting over it.
 *
 * Pure presentation: copy is injected (§6.4), lumen-* tokens only (via Menu).
 */

/** The menu's own copy, already translated (§6.4). */
export interface TagActionsMenuLabels {
  /** The menu's accessible name, composed with the tag's ("Work: Tag actions"). */
  rowMenu: string;
  renameTag: string;
  changeIcon: string;
  changeColor: string;
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
  /** Rename / icon / colour → the field the host's editor should focus. */
  onEdit: (field: TagHubEditField) => void;
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
      <MenuItem
        icon={<Pencil size={14} />}
        onSelect={() => act(() => onEdit("name"))}
      >
        {labels.renameTag}
      </MenuItem>
      <MenuItem
        icon={<Shapes size={14} />}
        onSelect={() => act(() => onEdit("icon"))}
      >
        {labels.changeIcon}
      </MenuItem>
      <MenuItem
        icon={<Palette size={14} />}
        onSelect={() => act(() => onEdit("color"))}
      >
        {labels.changeColor}
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
  /** Null while closed or when opened from the trigger button. */
  anchorPoint: MenuAnchorPoint | null;
  /** The "…" button's click: toggles the menu below the trigger. */
  toggleFromTrigger: () => void;
  /**
   * A `contextmenu` handler: opens the menu at the pointer and suppresses the
   * browser's own menu. Only attach it where the menu is on offer — a row that
   * has no actions must leave the native menu alone.
   */
  openAtPointer: (event: MouseEvent) => void;
  close: () => void;
}

/**
 * The open / anchor state behind one TagActionsMenu (#1676). The trigger's ref
 * stays with the caller (a ref handed back inside a hook's result reads as a
 * ref access during render to the React compiler's lint).
 */
export function useTagActionsMenu(): TagActionsMenuState {
  const [open, setOpen] = useState(false);
  const [anchorPoint, setAnchorPoint] = useState<MenuAnchorPoint | null>(null);

  const toggleFromTrigger = useCallback(() => {
    setAnchorPoint(null);
    setOpen((v) => !v);
  }, []);

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
