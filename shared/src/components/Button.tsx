import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "./cn";
import { BUSY_SPINNER, DISABLED_FILLED_BTN } from "./styleTokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon node (e.g. a lucide-react icon). */
  leadingIcon?: ReactNode;
  /**
   * The action this button started is still running (#1804).
   *
   * Raises `aria-busy`, swaps `leadingIcon` for the spinner and — because a
   * spinner alone says nothing once motion is reduced — shows `busyLabel` in
   * place of the children. Also implies `disabled`: every caller was already
   * passing `disabled={busy}` by hand, and the submit-while-submitting it
   * prevents is the reason the flag exists (ui-states.md §Submitting).
   */
  busy?: boolean;
  /** Already-translated "…ing" label. Falls back to the normal children. */
  busyLabel?: ReactNode;
}

/*
 * Design-system button. lumen-* tokens only (§6.4) — opaque container
 * backgrounds (§5). Label text comes from `children` so the host injects
 * already-translated strings (no useTranslation inside shared, §6.4).
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // `primary` is the only variant on DISABLED_FILLED_BTN so far (#1474). The
  // other three keep `disabled:opacity-50` on purpose: secondary and ghost are
  // already surface-coloured, so fading them reads as disabled without help.
  // `danger` has the identical accent-fill problem and the identical fix, but
  // its disabled state is a BUSY state on three screens (TrashView,
  // DeleteAccountDialog, AttachmentCleanupPanel) where a flat grey would read
  // as "switched off" rather than "working" — converting it is a UX call, not
  // a mechanical one, so it is queued rather than folded in here. What #1804
  // adds is the other half of that reading: those three now say "working" in
  // a spinner and a label, so whichever way the fill lands later, the busy
  // state no longer depends on the fill to be read at all.
  primary: `bg-lumen-accent text-lumen-on-accent hover:opacity-90 ${DISABLED_FILLED_BTN}`,
  secondary:
    "bg-lumen-bg-secondary text-lumen-text hover:bg-lumen-hover disabled:opacity-50",
  ghost:
    "bg-transparent text-lumen-text hover:bg-lumen-hover disabled:opacity-50",
  danger:
    "bg-lumen-danger text-lumen-on-accent hover:opacity-90 disabled:opacity-50",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1",
  md: "h-9 px-3.5 text-sm gap-1.5",
  lg: "h-11 px-5 text-base gap-2",
};

/** The spinner tracks the label, not the box: xs text takes the 14px glyph. */
const SPINNER_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-4 w-4",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      leadingIcon,
      busy = false,
      busyLabel,
      className,
      type = "button",
      disabled,
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium",
          "transition-colors focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-lumen-accent disabled:cursor-not-allowed",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...rest}
      >
        {busy ? (
          <LoaderCircle
            aria-hidden
            className={cn(BUSY_SPINNER, SPINNER_SIZE_CLASSES[size])}
          />
        ) : (
          leadingIcon
        )}
        {busy && busyLabel !== undefined ? busyLabel : children}
      </button>
    );
  },
);
