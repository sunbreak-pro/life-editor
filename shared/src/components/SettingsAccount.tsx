import { KeyRound } from "lucide-react";
import {
  PasswordUpdateForm,
  type PasswordUpdateFormLabels,
} from "./PasswordUpdateForm";
import { Button } from "./Button";
import { PASSWORD_MIN_LENGTH } from "../constants/password";

export interface SettingsAccountLabels extends PasswordUpdateFormLabels {
  heading: string;
  description: string;
  /** Row label above the signed-in address. */
  emailLabel: string;
  /** Sign-out row (#1200) — the narrow layout has no sidebar to hold one. */
  signOutHeading: string;
  signOutDescription: string;
  signOutButton: string;
  /** Account deletion (#1200). The button only OPENS the confirmation. */
  deleteHeading: string;
  deleteDescription: string;
  deleteButton: string;
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
  /** Ends the session. Present on BOTH layouts — see the note below. */
  onSignOut: () => void;
  /** Opens the deletion confirmation; never deletes on its own (#1200). */
  onDeleteAccount: () => void;
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
  onSignOut,
  onDeleteAccount,
  labels,
  passwordMinLength = PASSWORD_MIN_LENGTH,
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

      {/* The card already requires the address, so the password manager's
          username (#945) can never go missing here. */}
      <PasswordUpdateForm
        username={email}
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

      <div aria-hidden="true" className="my-1 h-px bg-lumen-border" />

      {/*
       * Sign out (#1200). It also lives at the foot of the Desktop sidebar,
       * but the sidebar is the WIDE layout only — on narrow there is a bottom
       * tab bar and no sign-out anywhere, so the only route out of the account
       * was clearing site data. Here it is reachable from both, and Settings
       * is where someone looks for it either way.
       */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-lumen-text">
            {labels.signOutHeading}
          </span>
          <span className="text-sm text-lumen-text-secondary">
            {labels.signOutDescription}
          </span>
        </div>
        <Button variant="secondary" onClick={onSignOut}>
          {labels.signOutButton}
        </Button>
      </div>

      <div aria-hidden="true" className="my-1 h-px bg-lumen-border" />

      {/*
       * Deletion. The button opens a confirmation that asks the address to be
       * typed out — this is the one action in the app with nothing behind it
       * (no Trash, no undo, no restore), so one mis-tap must not be enough.
       * The host owns that dialog and the call; this card only asks.
       */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-lumen-danger">
          {labels.deleteHeading}
        </span>
        <p className="text-sm text-lumen-text-secondary">
          {labels.deleteDescription}
        </p>
        <div>
          <Button variant="danger" onClick={onDeleteAccount}>
            {labels.deleteButton}
          </Button>
        </div>
      </div>
    </div>
  );
}
