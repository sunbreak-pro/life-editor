import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

export type ToastVariant = "info" | "success" | "warning" | "danger";

export type ToastViewportPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface ToastProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** Semantic tone — colors the left accent bar + status dot. Default "info". */
  variant?: ToastVariant;
  /** Already-translated message body (props-injected i18n, §6). */
  children: ReactNode;
  /** When provided, renders a dismiss (✕) button that calls this. */
  onDismiss?: () => void;
  /** Accessible label for the dismiss button (already-translated). */
  dismissLabel?: string;
}

export interface ToastViewportProps extends HTMLAttributes<HTMLDivElement> {
  /** Screen corner the stack anchors to. Default "bottom-right". */
  position?: ToastViewportPosition;
  children: ReactNode;
}

/*
 * Lumen toast card (ClaudeDesign catalog: components/toast.html). An OPAQUE
 * notification card (bg-lumen-bg, §3.5) with a 3px semantic accent bar, a
 * status dot, the message, and an optional dismiss button. The tone class is
 * looked up from a static map (never string-built) so Tailwind's scanner
 * keeps the bg-lumen-* utility — a dynamic `bg-lumen-${variant}` would silently
 * fall transparent (§7 silent-transparent-fail). lumen-* tokens only (§3.1);
 * copy is injected (no useTranslation here, §6).
 */
const TONE_BG: Record<ToastVariant, string> = {
  info: "bg-lumen-info",
  success: "bg-lumen-success",
  warning: "bg-lumen-warning",
  danger: "bg-lumen-danger",
};

export const Toast = forwardRef<HTMLDivElement, ToastProps>(function Toast(
  {
    variant = "info",
    children,
    onDismiss,
    dismissLabel = "Dismiss",
    className,
    role,
    ...rest
  },
  ref,
) {
  // Errors/warnings interrupt (assertive); info/success are polite updates.
  const resolvedRole =
    role ??
    (variant === "danger" || variant === "warning" ? "alert" : "status");
  return (
    <div
      ref={ref}
      role={resolvedRole}
      className={cn(
        "relative flex items-center gap-2.5 overflow-hidden rounded-lumen-lg",
        "border border-lumen-border bg-lumen-bg py-2.5 pl-3.5 pr-3 shadow-lumen-md",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-y-0 left-0 w-[3px]", TONE_BG[variant])}
      />
      <span
        aria-hidden="true"
        className={cn("h-2 w-2 shrink-0 rounded-full", TONE_BG[variant])}
      />
      <span className="min-w-0 flex-1 text-sm leading-snug text-lumen-text">
        {children}
      </span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-lumen-sm",
            "text-lumen-text-secondary transition-colors",
            "hover:bg-lumen-hover hover:text-lumen-text",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
          )}
        >
          <X size={13} />
        </button>
      ) : null}
    </div>
  );
});

/*
 * Fixed-position stack for toasts. A pure positioning layer — it carries NO
 * background fill (so it is not a "primary container" under §3.5); it is
 * click-through except over the toasts themselves. Host maps its live toast
 * queue to <Toast> children.
 */
const POSITION_CLASSES: Record<ToastViewportPosition, string> = {
  "top-left": "top-0 left-0 items-start",
  "top-center": "top-0 left-1/2 -translate-x-1/2 items-center",
  "top-right": "top-0 right-0 items-end",
  "bottom-left": "bottom-0 left-0 items-start",
  "bottom-center": "bottom-0 left-1/2 -translate-x-1/2 items-center",
  "bottom-right": "bottom-0 right-0 items-end",
};

export function ToastViewport({
  position = "bottom-right",
  className,
  children,
  ...rest
}: ToastViewportProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed z-50 flex w-full max-w-sm flex-col gap-2 p-4",
        "[&>*]:pointer-events-auto",
        POSITION_CLASSES[position],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
