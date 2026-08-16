import { useId } from "react";
import type { FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "./cn";
import { AuthAlert } from "./AuthAlert";
import { Button } from "./Button";
import { PasswordField, type PasswordFieldLabels } from "./PasswordField";
import { PASSWORD_MIN_LENGTH } from "../constants/password";

export interface PasswordUpdateFormLabels {
  newPassword: string;
  /** Hint under the new-password input (the min-length rule). */
  newPasswordHelper: string;
  confirmPassword: string;
  showPassword: string;
  hidePassword: string;
  /** Submit button label at rest. */
  submit: string;
  /** Submit button label while the request is in flight. */
  busy: string;
}

export interface PasswordUpdateFormProps {
  password: string;
  onPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  /** Already-translated error, or null to hide the band. */
  error: string | null;
  /** Already-translated confirmation, or null to hide the band. */
  notice?: string | null;
  /** Draws the confirm field in the danger color (the two values differ). */
  confirmInvalid?: boolean;
  busy: boolean;
  /** Fired on submit (Enter / button). preventDefault is handled here. */
  onSubmit: () => void;
  labels: PasswordUpdateFormLabels;
  passwordMinLength?: number;
  /**
   * Stretches the submit button across the card, the full-screen auth
   * surface's shape. Settings leaves it off so the button keeps the inline
   * size the other cards on that screen use.
   */
  fullWidthSubmit?: boolean;
  className?: string;
}

/*
 * "Set a new password" form (#919) — new password + confirmation + submit,
 * with the shared status band above the button.
 *
 * One form for BOTH entry points, because they are the same request once the
 * session exists: the signed-in change form in Settings, and the reset screen
 * reached from a recovery link (the link signs the user in first). Pure
 * presentation — the host owns the updatePassword() call and every message,
 * already translated (§6.4); lumen-* tokens only (§5).
 */
export function PasswordUpdateForm({
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  error,
  notice = null,
  confirmInvalid = false,
  busy,
  onSubmit,
  labels,
  passwordMinLength = PASSWORD_MIN_LENGTH,
  fullWidthSubmit = false,
  className,
}: PasswordUpdateFormProps) {
  const passwordId = useId();
  const confirmId = useId();
  const passwordLabels: PasswordFieldLabels = {
    show: labels.showPassword,
    hide: labels.hidePassword,
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={busy || undefined}
      className={cn("flex flex-col gap-4", className)}
    >
      {/* Dimmed while busy, matching AuthCard: the fields go quiet and the
          button carries the spinner at full strength. */}
      <div
        className={cn(
          "flex flex-col gap-4",
          busy && "pointer-events-none opacity-60",
        )}
      >
        {/* Explicit htmlFor/id rather than a wrapping label — the field
            embeds the eye-toggle <button>, which must not sit in a label. */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={passwordId}
            className="text-sm text-lumen-text-secondary"
          >
            {labels.newPassword}
          </label>
          <PasswordField
            id={passwordId}
            required
            minLength={passwordMinLength}
            autoComplete="new-password"
            value={password}
            disabled={busy}
            onChange={onPasswordChange}
            labels={passwordLabels}
            helperText={labels.newPasswordHelper}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={confirmId}
            className="text-sm text-lumen-text-secondary"
          >
            {labels.confirmPassword}
          </label>
          <PasswordField
            id={confirmId}
            required
            minLength={passwordMinLength}
            autoComplete="new-password"
            value={confirmPassword}
            disabled={busy}
            invalid={confirmInvalid}
            onChange={onConfirmPasswordChange}
            labels={passwordLabels}
          />
        </div>
      </div>

      {error ? <AuthAlert message={error} /> : null}
      {notice ? <AuthAlert message={notice} tone="success" /> : null}

      <div>
        <Button
          type="submit"
          size={fullWidthSubmit ? "lg" : "md"}
          disabled={busy}
          className={fullWidthSubmit ? "w-full" : undefined}
        >
          {busy ? (
            <>
              <LoaderCircle
                aria-hidden
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
              />
              {labels.busy}
            </>
          ) : (
            labels.submit
          )}
        </Button>
      </div>
    </form>
  );
}
