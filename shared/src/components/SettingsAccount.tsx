import { KeyRound } from "lucide-react";
import {
  PasswordUpdateForm,
  type PasswordUpdateFormLabels,
} from "./PasswordUpdateForm";

export interface SettingsAccountLabels extends PasswordUpdateFormLabels {
  heading: string;
  description: string;
  /** Row label above the signed-in address. */
  emailLabel: string;
}

export interface SettingsAccountProps {
  /** Address of the signed-in account, shown read-only. */
  email: string;
  password: string;
  onPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  /** Already-translated error, or null to hide the band. */
  error: string | null;
  /** Already-translated success line, or null to hide the band. */
  notice: string | null;
  /** Draws the confirm field in the danger color (the two values differ). */
  confirmInvalid?: boolean;
  busy: boolean;
  onSubmit: () => void;
  labels: SettingsAccountLabels;
  passwordMinLength?: number;
}

/*
 * Account card for the Settings column (#919) — the signed-in address plus
 * the password-change form. This is the "I still know my password" half of
 * recovery; the forgotten-password half lives on the auth screen.
 *
 * Unlike its neighbours on this screen, this card is NOT immediate-apply: a
 * password half-typed into a live field would be a terrible thing to commit,
 * so it keeps an explicit submit. Pure presentation — the host owns the
 * updatePassword() call and every message (§6.4).
 */
export function SettingsAccount({
  email,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  error,
  notice,
  confirmInvalid = false,
  busy,
  onSubmit,
  labels,
  passwordMinLength = 6,
}: SettingsAccountProps) {
  return (
    <div className="flex flex-col gap-3" data-section-id="account">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-lumen-text">
          <KeyRound size={16} className="text-lumen-text-secondary" />
          <span>{labels.heading}</span>
        </h3>
        <p className="text-sm text-lumen-text-secondary">
          {labels.description}
        </p>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-lumen-text-tertiary">
          {labels.emailLabel}
        </span>
        <span className="text-sm text-lumen-text">{email}</span>
      </div>

      <PasswordUpdateForm
        password={password}
        onPasswordChange={onPasswordChange}
        confirmPassword={confirmPassword}
        onConfirmPasswordChange={onConfirmPasswordChange}
        error={error}
        notice={notice}
        confirmInvalid={confirmInvalid}
        busy={busy}
        onSubmit={onSubmit}
        labels={labels}
        passwordMinLength={passwordMinLength}
        className="max-w-[400px]"
      />
    </div>
  );
}
