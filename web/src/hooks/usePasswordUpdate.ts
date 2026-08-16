import { useCallback, useState } from "react";
import { updatePassword } from "@life-editor/shared";

/** Already-translated copy for every outcome of a password change. */
export interface PasswordUpdateMessages {
  /** The two fields differ. */
  mismatch: string;
  /** Shorter than the minimum. */
  tooShort: string;
  /** Supabase refused because it equals the current password. */
  samePassword: string;
  /** Anything else Supabase returned. */
  generic: string;
  /** Shown after a successful change; omit where the screen navigates away. */
  done?: string;
}

export interface UsePasswordUpdateOptions {
  minLength?: number;
  /** Runs after a successful change (e.g. leave the recovery screen). */
  onSuccess?: () => void;
}

export interface PasswordUpdateState {
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  /** Already-translated error, or null. */
  error: string | null;
  /** Already-translated success line, or null. */
  notice: string | null;
  /** True when the mismatch is what failed (marks the confirm field). */
  confirmInvalid: boolean;
  busy: boolean;
  submit: () => void;
}

/*
 * Password-change state + submit (#919), shared by the two screens that set a
 * password: Settings' Account card and the post-recovery reset. Both make the
 * same call — the recovery link signs the user in first, so by the time either
 * screen submits there is an ordinary session — and both need the same
 * client-side checks and the same mapping of Supabase's raw messages.
 *
 * The raw message goes to the console for the N=1 owner and the screen shows
 * the catalog text, matching AuthScreen's handling of sign-in failures.
 */
export function usePasswordUpdate(
  messages: PasswordUpdateMessages,
  options: UsePasswordUpdateOptions = {},
): PasswordUpdateState {
  const { minLength = 6, onSuccess } = options;
  const [password, setPasswordValue] = useState("");
  const [confirmPassword, setConfirmPasswordValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmInvalid, setConfirmInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  // Typing again clears the previous verdict — leaving a stale "changed"
  // banner above a half-typed new value would read as if that one had landed.
  const setPassword = useCallback((value: string) => {
    setPasswordValue(value);
    setError(null);
    setNotice(null);
    setConfirmInvalid(false);
  }, []);

  const setConfirmPassword = useCallback((value: string) => {
    setConfirmPasswordValue(value);
    setError(null);
    setNotice(null);
    setConfirmInvalid(false);
  }, []);

  const submit = useCallback(() => {
    void (async () => {
      // Re-entry guard: `disabled={busy}` only lands on the next render, so
      // rapid Enter presses could otherwise fire the call twice.
      if (busy) return;
      setError(null);
      setNotice(null);
      setConfirmInvalid(false);

      if (password.length < minLength) {
        setError(messages.tooShort);
        return;
      }
      if (password !== confirmPassword) {
        setError(messages.mismatch);
        setConfirmInvalid(true);
        return;
      }

      setBusy(true);
      const result = await updatePassword(password);
      setBusy(false);

      if (result.error) {
        console.error("[auth] updatePassword", result.error);
        setError(
          /different from the old password|should be different/i.test(
            result.error,
          )
            ? messages.samePassword
            : /at least|too short|weak/i.test(result.error)
              ? messages.tooShort
              : messages.generic,
        );
        return;
      }

      setPasswordValue("");
      setConfirmPasswordValue("");
      if (messages.done) setNotice(messages.done);
      onSuccess?.();
    })();
  }, [busy, password, confirmPassword, minLength, messages, onSuccess]);

  return {
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    error,
    notice,
    confirmInvalid,
    busy,
    submit,
  };
}
