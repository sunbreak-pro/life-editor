import { cn } from "../cn";
import {
  ITEM_ROLE_ICON,
  ITEM_ROLE_ICON_CLASS,
  itemRoleLabel,
  resolveItemRole,
  UNKNOWN_ITEM_ROLE_ICON,
  UNKNOWN_ITEM_ROLE_ICON_CLASS,
  type ItemRoleLabels,
} from "./itemRole";

/*
 * ItemRoleBadge (#409) — the single way an item announces its kind in a
 * cross-role list. Shared by the tag editor's per-tag item list (#409) and the
 * item-side tag picker (#412) so both speak the same visual language.
 *
 * Pure presentation: a raw `items_meta.role` string in, a neutral chip out
 * with a tinted kind icon + already-translated kind name (§6.4). Unknown roles
 * render the neutral fallback instead of disappearing.
 */

/**
 * `sm` is the in-line chip that sits beside a row's own text. `md` is for a
 * chip that has to read as a HEADING over the rows below it (the hub's
 * per-kind runs), where the small one was too close to the row text to
 * separate one kind from the next.
 *
 * A size prop rather than a `className` override: `cn` is a plain string join
 * (rules/frontend.md §Gotchas), so passing `text-sm` next to the built-in
 * `text-xs` leaves both in the class list and the winner is whichever
 * Tailwind emitted last.
 */
export type ItemRoleBadgeSize = "sm" | "md";

export interface ItemRoleBadgeProps {
  /** Raw `items_meta.role` — narrowed internally, unknown values are safe. */
  role: string | null | undefined;
  labels: ItemRoleLabels;
  /** Icon-only chip (the text name moves to title/aria). Default false. */
  compact?: boolean;
  /** Chip scale. Default "sm". */
  size?: ItemRoleBadgeSize;
  className?: string;
}

const SIZE_CLASS: Record<ItemRoleBadgeSize, string> = {
  sm: "gap-1 px-1.5 py-0.5 text-xs",
  md: "gap-1.5 px-2 py-0.5 text-sm",
};

const ICON_SIZE: Record<ItemRoleBadgeSize, number> = { sm: 12, md: 14 };

export function ItemRoleBadge({
  role,
  labels,
  compact = false,
  size = "sm",
  className,
}: ItemRoleBadgeProps): React.JSX.Element {
  const resolved = resolveItemRole(role);
  const Icon = resolved ? ITEM_ROLE_ICON[resolved] : UNKNOWN_ITEM_ROLE_ICON;
  const iconClass = resolved
    ? ITEM_ROLE_ICON_CLASS[resolved]
    : UNKNOWN_ITEM_ROLE_ICON_CLASS;
  const label = itemRoleLabel(role, labels);

  return (
    <span
      // The kind is announced once, by the chip: the icon is decorative and
      // the name is the accessible text (compact mode moves it to the label).
      //
      // `role="img"` on the compact shape (#1044) is what makes that label
      // actually reach a screen reader: a bare <span> has the `generic` role,
      // where ARIA naming is not reliably exposed. It also makes the glyph
      // findable by `getByRole("img", { name })`, which is the only way to
      // assert "the kind is still announced" once the word is gone.
      role={compact ? "img" : undefined}
      aria-label={compact ? label : undefined}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-lumen-border",
        "bg-lumen-bg-secondary font-medium text-lumen-text-secondary",
        SIZE_CLASS[size],
        className,
      )}
    >
      <Icon size={ICON_SIZE[size]} aria-hidden className={cn("shrink-0", iconClass)} />
      {!compact && <span className="whitespace-nowrap">{label}</span>}
    </span>
  );
}
