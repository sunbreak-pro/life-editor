import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon node (e.g. a lucide-react icon). */
  leadingIcon?: ReactNode;
}

/*
 * Design-system button. lumen-* tokens only (§6.4) — opaque container
 * backgrounds (§5). Label text comes from `children` so the host injects
 * already-translated strings (no useTranslation inside shared, §6.4).
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-lumen-accent text-lumen-on-accent hover:opacity-90 disabled:opacity-50",
  secondary:
    "bg-lumen-bg-secondary text-lumen-text hover:bg-lumen-hover disabled:opacity-50",
  ghost:
    "bg-transparent text-lumen-text hover:bg-lumen-hover disabled:opacity-50",
  danger: "bg-lumen-danger text-lumen-on-accent hover:opacity-90 disabled:opacity-50",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1",
  md: "h-9 px-3.5 text-sm gap-1.5",
  lg: "h-11 px-5 text-base gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      leadingIcon,
      className,
      type = "button",
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
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
        {leadingIcon}
        {children}
      </button>
    );
  },
);
