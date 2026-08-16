import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "./cn";

export type AuthAlertTone = "error" | "success";

export interface AuthAlertProps {
  /** Already-translated message. */
  message: string;
  tone?: AuthAlertTone;
  className?: string;
}

/*
 * Inline status band of the auth surfaces (#919). Was AuthCard's private
 * error band; the recovery + password-change forms need the same band (and a
 * success tone), so it lives here rather than in three copies.
 *
 * `role="alert"` on both tones: each one reports the outcome of a submit the
 * user just made, which is exactly what a screen reader should interrupt for.
 */
export function AuthAlert({
  message,
  tone = "error",
  className,
}: AuthAlertProps) {
  const isError = tone === "error";
  const Icon = isError ? CircleAlert : CircleCheck;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-lumen-md border px-3 py-2.5",
        isError
          ? "border-lumen-danger bg-lumen-danger-subtle"
          : "border-lumen-success bg-lumen-success-subtle",
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          isError ? "text-lumen-danger" : "text-lumen-success",
        )}
      />
      <span
        className={cn(
          "text-sm leading-normal",
          isError ? "text-lumen-danger" : "text-lumen-success",
        )}
      >
        {message}
      </span>
    </div>
  );
}
