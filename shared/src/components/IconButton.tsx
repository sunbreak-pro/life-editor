import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type IconButtonVariant = "ghost" | "solid" | "danger";
export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The icon node to render (e.g. a lucide-react icon). */
  icon: ReactNode;
  /**
   * Accessible label — required because an icon-only button has no text.
   * Applied as aria-label. The host passes an already-translated string.
   */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  ghost:
    "bg-transparent text-ink-text-secondary hover:bg-ink-hover hover:text-ink-text",
  solid:
    "bg-ink-bg-secondary text-ink-text hover:bg-ink-hover",
  danger:
    "bg-transparent text-ink-danger hover:bg-ink-hover",
};

const SIZE_CLASSES: Record<IconButtonSize, string> = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

/*
 * Icon-only button. aria-label is mandatory (a11y). ink-* tokens
 * only; opaque/ghost backgrounds per §5 (ghost = transparent base is an
 * allowed interaction surface, not a primary container).
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      label,
      variant = "ghost",
      size = "md",
      className,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex items-center justify-center rounded-md",
          "transition-colors focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-ink-accent disabled:cursor-not-allowed",
          "disabled:opacity-50",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...rest}
      >
        {icon}
      </button>
    );
  },
);
