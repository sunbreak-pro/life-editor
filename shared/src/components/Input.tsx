import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** When true, draws the danger-colored border (validation error). */
  invalid?: boolean;
}

/*
 * Design-system text input. Opaque bg-lumen-bg background (§5), lumen-*
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
        "h-9 w-full rounded-md border bg-lumen-bg px-3 text-sm",
        "text-lumen-text placeholder:text-lumen-text-secondary",
        "transition-colors focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-lumen-accent disabled:cursor-not-allowed",
        "disabled:opacity-50",
        invalid ? "border-lumen-danger" : "border-lumen-border",
        className,
      )}
      {...rest}
    />
  );
});
