import { useEffect, useRef } from "react";
import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { cn } from "./cn";

export type MenuItemVariant = "default" | "danger";

export interface MenuProps {
  open: boolean;
  onClose: () => void;
  /** Already-translated a11y label for the menu (§6). */
  label?: string;
  /** Horizontal edge to align to, relative to the positioned anchor. */
  align?: "start" | "end";
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
 * menu positions itself just below (top-full). OPAQUE panel (bg-ink-bg, §3.5)
 * — never a translucent popover. a11y: role=menu with roving focus (Arrow /
 * Home / End), Tab-to-close, Esc-to-close (IME-guarded, §7), and
 * outside-pointerdown close. First enabled item is focused on open. Copy is
 * injected (§6).
 *
 * Trigger wiring: drive `open` from the host, but do NOT wire the trigger as a
 * naive toggle — the outside-pointerdown close fires before the trigger's
 * click, so a toggle would immediately re-open (flicker). Open on click and let
 * this component own closing, or stopPropagation on the trigger's pointerdown.
 */
export function Menu({
  open,
  onClose,
  label,
  align = "start",
  children,
  className,
}: MenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Outside-click + Esc close while open.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
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
  }, [open, onClose]);

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
        "absolute top-full z-50 mt-1 min-w-44 rounded-ink-md border border-ink-border",
        "bg-ink-bg py-1 shadow-ink-lg",
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
 * focused row lights up via focus:bg-ink-hover. "danger" tints the label with
 * the danger token. Disabled rows are inert + tertiary-toned. ink-* only.
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
          ? "cursor-not-allowed text-ink-text-tertiary"
          : variant === "danger"
            ? "text-ink-danger hover:bg-ink-hover focus:bg-ink-hover"
            : "text-ink-text hover:bg-ink-hover focus:bg-ink-hover",
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
        <span className="ml-auto shrink-0 text-xs text-ink-text-tertiary">
          {shortcut}
        </span>
      ) : null}
    </button>
  );
}
