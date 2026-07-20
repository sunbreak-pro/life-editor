import {
  Pencil,
  CopyPlus,
  Trash2,
  Palette,
  Tag,
  Pin,
  Move,
} from "lucide-react";
import { ItemContextMenu, type ItemAction } from "../itemActions";

/*
 * ScheduleItemContextMenu (#223 → #307) — the calendar item right-click menu,
 * now a thin schedule-specific wrapper over the generic <ItemContextMenu>. It
 * builds the declarative ItemAction[] (rename inline-input + duplicate + delete
 * danger, plus the standard action candidates as disabled stubs) and hands
 * positioning / dismissal / rendering to the shared primitive.
 *
 * The three real actions preserve their prior behaviour verbatim; the stub rows
 * (color / tag / pin / move) advertise the standard operations before their
 * behaviour exists (#307), rendered disabled with a "soon" badge.
 *
 * Pure presentation (§3.1/§6.4): copy arrives already translated via `labels`.
 */

export interface ScheduleItemContextMenuLabels {
  rename: string;
  duplicate: string;
  delete: string;
  /** Standard action candidates (#307) — behaviour not yet implemented. */
  changeColor: string;
  addTag: string;
  pin: string;
  move: string;
  /** Trailing "soon" badge shown on the stub rows. */
  soon: string;
}

export interface ScheduleItemContextMenuProps {
  /** Anchor point in viewport coordinates (from the contextmenu event). */
  position: { x: number; y: number };
  /** Seeds the rename input. */
  currentTitle: string;
  labels: ScheduleItemContextMenuLabels;
  /** Commit a new title (already trimmed by the menu). */
  onRename: (title: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ScheduleItemContextMenu({
  position,
  currentTitle,
  labels,
  onRename,
  onDuplicate,
  onDelete,
  onClose,
}: ScheduleItemContextMenuProps) {
  const actions: ItemAction[] = [
    {
      id: "rename",
      label: labels.rename,
      icon: <Pencil aria-hidden />,
      inlineInput: {
        value: currentTitle,
        ariaLabel: labels.rename,
        onCommit: onRename,
      },
    },
    {
      id: "duplicate",
      label: labels.duplicate,
      icon: <CopyPlus aria-hidden />,
      onSelect: onDuplicate,
    },
    {
      id: "delete",
      label: labels.delete,
      icon: <Trash2 aria-hidden />,
      danger: true,
      onSelect: onDelete,
    },
    // Standard action candidates (#307) — visible but not yet implemented.
    {
      id: "changeColor",
      label: labels.changeColor,
      icon: <Palette aria-hidden />,
      stub: true,
    },
    {
      id: "addTag",
      label: labels.addTag,
      icon: <Tag aria-hidden />,
      stub: true,
    },
    { id: "pin", label: labels.pin, icon: <Pin aria-hidden />, stub: true },
    { id: "move", label: labels.move, icon: <Move aria-hidden />, stub: true },
  ];

  return (
    <ItemContextMenu
      position={position}
      actions={actions}
      stubBadge={labels.soon}
      onClose={onClose}
    />
  );
}
