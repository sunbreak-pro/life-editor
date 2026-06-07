import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** When true, draws the danger-colored border (validation error). */
  invalid?: boolean;
}

/*
 * Design-system text input. Opaque bg-notion-bg background (§5), notion-*
 * tokens only. The host owns IME handling (e.nativeEvent.isComposing,
 * §6.6) by passing onKeyDown — this primitive is intentionally unopinionated
 * about composition so it stays reusable.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className, type = "text", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-9 w-full rounded-md border bg-notion-bg px-3 text-sm",
        "text-notion-text placeholder:text-notion-text-secondary",
        "transition-colors focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-notion-accent disabled:cursor-not-allowed",
        "disabled:opacity-50",
        invalid ? "border-notion-danger" : "border-notion-border",
        className,
      )}
      {...rest}
    />
  );
});
