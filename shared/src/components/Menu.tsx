import { useEffect, useRef } from "react";
import type {
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
  RefObject,
} from "react";
import { cn } from "./cn";

export type MenuItemVariant = "default" | "danger";

export interface MenuProps {
  open: boolean;
  onClose: () => void;
  /** Already-translated a11y label for the menu (§6). */
  label?: string;
  /** Horizontal edge to align to, relative to the positioned anchor. */
  align?: "start" | "end";
  /**
   * Ref to the trigger element (e.g. a kebab button). Pointerdowns landing on
   * it are treated as INSIDE, so a naive `setOpen(v => !v)` toggle trigger can
   * close the menu without the outside-pointerdown guard closing-then-reopening
   * it (see the trigger-wiring note below). Omit for non-toggle triggers.
   */
  anchorRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
}

export interface MenuItemProps extends Omit<
  HTMLAttributes<HTMLButtonElement>,
  "onSelect"
> {
  /** Already-sized leading icon (optional). */
  icon?: ReactNode;
  /** Already-translated label (§6). */
  children: ReactNode;
  onSelect: () => void;
  variant?: MenuItemVariant;
  disabled?: boolean;
  /** Optional trailing hint (e.g. a keyboard shortcut) in the tertiary tone. */
  shortcut?: ReactNode;
}

const ENABLED_ITEMS = '[role="menuitem"]:not([aria-disabled="true"])';

/*
 * Dropdown menu popover. No ClaudeDesign catalog card exists for a menu, so
 * this follows the Modal / CommandPalette patterns (per the port brief). NOT
 * portalled: the caller wraps the trigger + <Menu> in a `relative` box and the
 * menu positions itself just below (top-full). OPAQUE panel (bg-lumen-bg, §3.5)
 * — never a translucent popover. a11y: role=menu with roving focus (Arrow /
 * Home / End), Tab-to-close, Esc-to-close (IME-guarded, §7), and
 * outside-pointerdown close. First enabled item is focused on open. Copy is
 * injected (§6).
 *
 * Trigger wiring: drive `open` from the host. A naive `setOpen(v => !v)` toggle
 * is unsafe on its own — the outside-pointerdown close (a document capture
 * listener) fires before the trigger's click, so the toggle would close then
 * immediately re-open (flicker). Fix it by passing the trigger's ref as
 * `anchorRef`: pointerdowns on the trigger are then treated as inside and skip
 * the outside-close, so the toggle's click closes cleanly. (Alternatively open
 * on click only and let this component own closing.)
 */
export function Menu({
  open,
  onClose,
  label,
  align = "start",
  anchorRef,
  children,
  className,
}: MenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Outside-click + Esc close while open.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      // The menu itself and the anchor (toggle trigger) count as inside.
      if (ref.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose, anchorRef]);

  // Focus the first enabled item on open.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      ref.current?.querySelector<HTMLElement>(ENABLED_ITEMS)?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  const items = () =>
    Array.from(ref.current?.querySelectorAll<HTMLElement>(ENABLED_ITEMS) ?? []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing) return;
    // Tab exits the menu (WAI-ARIA menu pattern): close and let focus move
    // naturally to the next element (no preventDefault).
    if (e.key === "Tab") {
      onClose();
      return;
    }
    const list = items();
    if (list.length === 0) return;
    const idx = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      // idx < 0 (focus not on an item) → wrap to the first row deterministically.
      list[idx < 0 ? 0 : (idx + 1) % list.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[
        idx < 0 ? list.length - 1 : (idx - 1 + list.length) % list.length
      ].focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0].focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1].focus();
    }
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "absolute top-full z-50 mt-1 min-w-44 rounded-lumen-md border border-lumen-border",
        "bg-lumen-bg py-1 shadow-lumen-lg",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/*
 * A single menu row. tabIndex=-1 (roving focus is driven by <Menu>); the
 * focused row lights up via focus:bg-lumen-hover. "danger" tints the label with
 * the danger token. Disabled rows are inert + tertiary-toned. lumen-* only.
 *
 * onSelect does NOT close the menu — that stays the host's responsibility
 * (flip `open` to false inside your onSelect, or keep the menu open for a
 * multi-pick surface). This mirrors the controlled-open contract of <Menu>.
 */
export function MenuItem({
  icon,
  children,
  onSelect,
  variant = "default",
  disabled = false,
  shortcut,
  className,
  ...rest
}: MenuItemProps) {
  return (
    <button
      {...rest}
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm",
        "transition-colors focus:outline-none",
        disabled
          ? "cursor-not-allowed text-lumen-text-tertiary"
          : variant === "danger"
            ? "text-lumen-danger hover:bg-lumen-hover focus:bg-lumen-hover"
            : "text-lumen-text hover:bg-lumen-hover focus:bg-lumen-hover",
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut ? (
        <span className="ml-auto shrink-0 text-xs text-lumen-text-tertiary">
          {shortcut}
        </span>
      ) : null}
    </button>
  );
}
