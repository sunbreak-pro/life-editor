import { useId } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { UserRound } from "lucide-react";
import { Input } from "./Input";
import { Button } from "./Button";
import { NoticePanel } from "./NoticePanel";
import { CARD_BTN_TAP } from "./styleTokens";
import { isImeComposing } from "../utils/imeGuard";
import { DISPLAY_NAME_MAX_LENGTH } from "../utils/profile";

export interface SettingsProfileLabels {
  heading: string;
  description: string;
  displayNameLabel: string;
  /** Hint under the field: where the name shows and what empty means. */
  displayNameHelper: string;
  /** Row label above the signed-in address. */
  emailLabel: string;
  /** Submit button label at rest. */
  submit: string;
  /** Submit button label while the request is in flight. */
  busy: string;
}

export interface SettingsProfileProps {
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  /** Address of the signed-in account, shown read-only. */
  email: string;
  /** Already-translated error, or null to hide the band. */
  error: string | null;
  /** Already-translated success line, or null to hide the band. */
  notice: string | null;
  busy: boolean;
  onSubmit: () => void;
  labels: SettingsProfileLabels;
  maxLength?: number;
}

/*
 * Profile card for the Settings "Profile" category (#1624) — the display name
 * the sidebar shows in place of the address, plus the address itself.
 *
 * Explicit submit, like the Account card next door rather than the
 * immediate-apply preference cards: every keystroke would otherwise be a
 * round trip to Supabase Auth and a USER_UPDATED re-render of the whole shell.
 * Pure presentation — the host owns the updateDisplayName() call and every
 * message, already translated (§6.4).
 */
export function SettingsProfile({
  displayName,
  onDisplayNameChange,
  email,
  error,
  notice,
  busy,
  onSubmit,
  labels,
  maxLength = DISPLAY_NAME_MAX_LENGTH,
}: SettingsProfileProps) {
  const nameId = useId();
  const helperId = useId();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  };

  // The Enter that CONFIRMS a Japanese conversion must not also submit the
  // form (§6.6 / #737). Cancelling the keydown is what stops the browser's
  // implicit submission; every other Enter still submits.
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isImeComposing(e)) e.preventDefault();
  };

  return (
    <div className="flex flex-col gap-3" data-section-id="profile">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-lumen-text">
          <UserRound size={16} className="text-lumen-text-secondary" />
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

      <form
        onSubmit={handleSubmit}
        aria-busy={busy || undefined}
        className="flex max-w-[400px] flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="text-sm text-lumen-text-secondary">
            {labels.displayNameLabel}
          </label>
          <Input
            id={nameId}
            name="nickname"
            autoComplete="nickname"
            value={displayName}
            maxLength={maxLength}
            disabled={busy}
            aria-describedby={helperId}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <p id={helperId} className="text-xs text-lumen-text-tertiary">
            {labels.displayNameHelper}
          </p>
        </div>

        {error ? (
          <NoticePanel message={error} tone="danger" role="alert" />
        ) : null}
        {notice ? (
          <NoticePanel message={notice} tone="success" role="alert" />
        ) : null}

        <div>
          <Button
            type="submit"
            busy={busy}
            busyLabel={labels.busy}
            className={CARD_BTN_TAP}
          >
            {labels.submit}
          </Button>
        </div>
      </form>
    </div>
  );
}
