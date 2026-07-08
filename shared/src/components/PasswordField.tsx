import { useState } from "react";
import type { InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "./cn";

export interface PasswordFieldLabels {
  /** aria-label of the eye toggle while the value is hidden. */
  show: string;
  /** aria-label of the eye toggle while the value is visible. */
  hide: string;
}

export interface PasswordFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> {
  value: string;
  onChange: (value: string) => void;
  labels: PasswordFieldLabels;
  /** Hint rendered under the input (e.g. the min-length rule). */
  helperText?: string;
  /** When true, draws the danger-colored border (validation error). */
  invalid?: boolean;
}

/*
 * Password input with a built-in show/hide toggle + helper text (Auth
 * design). Visibility is view-only state, so it lives here; the value
 * stays controlled by the host. Touch-first sizes (48px input / 44px
 * toggle) compacting from md up (40px / 28px); 16px font below md so
 * iOS does not zoom on focus. The design's focus affordance is the
 * accent border (not a ring), mirroring the Auth field spec. Pure
 * presentation: labels injected already-translated (§6.4), lumen-*
 * tokens only (§5).
 */
export function PasswordField({
  value,
  onChange,
  labels,
  helperText,
  invalid = false,
  disabled,
  className,
  ...rest
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const ToggleIcon = visible ? EyeOff : Eye;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <input
          {...rest}
          type={visible ? "text" : "password"}
          value={value}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-12 w-full rounded-lumen-md border bg-lumen-bg pl-3 pr-12",
            "text-base text-lumen-text placeholder:text-lumen-text-tertiary",
            "transition-colors focus:border-lumen-accent focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "md:h-10 md:pr-10 md:text-sm",
            invalid ? "border-lumen-danger" : "border-lumen-border",
            className,
          )}
        />
        <button
          type="button"
          aria-label={visible ? labels.hide : labels.show}
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible((v) => !v)}
          className={cn(
            "absolute right-0.5 top-0.5 grid h-11 w-11 place-items-center",
            "rounded-lumen-sm text-lumen-text-tertiary transition-colors",
            "hover:bg-lumen-hover hover:text-lumen-text-secondary",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-lumen-accent disabled:cursor-not-allowed",
            "md:right-1.5 md:top-1.5 md:h-7 md:w-7",
          )}
        >
          <ToggleIcon aria-hidden className="h-4 w-4" />
        </button>
      </div>
      {helperText ? (
        <span className="text-xs text-lumen-text-tertiary">{helperText}</span>
      ) : null}
    </div>
  );
}
