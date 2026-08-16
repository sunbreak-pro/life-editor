import { useMemo, useState } from "react";
import {
  AuthCard,
  PASSWORD_MIN_LENGTH,
  PasswordRecoveryCard,
  PasswordResetRequestCard,
  sendPasswordResetEmail,
  signIn,
  signUp,
  useTranslation,
  type AuthCardLabels,
  type AuthMode,
  type TranslationKey,
} from "@life-editor/shared";
import { usePasswordUpdate } from "./hooks/usePasswordUpdate";

/*
 * Phase 1 auth entry (Email + Password), target-IA D8 (ClaudeDesign Auth
 * import). Shell-independent full-screen: bg-primary canvas with the
 * shared card centered — one responsive layout for Desktop and
 * Mobile (no structural fork; auth is outside the Consumption / Quick
 * capture split). Confirm-email is assumed OFF, so signUp logs the user
 * straight in. Session propagation is handled by the onAuthStateChange
 * listener in App. This host owns the state + the auth calls; the cards stay
 * pure presentation.
 *
 * Three views share the canvas (#919): the credentials card, the
 * "email me a reset link" card, and — when App reports a PASSWORD_RECOVERY
 * event — the "set a new password" card. The recovery view is driven from
 * App rather than from local state because the recovery link creates a REAL
 * session: without that gate the app would have swapped to MainScreen and the
 * user would never see a way to finish the reset.
 */

export interface AuthScreenProps {
  /**
   * True when the user arrived through a password-recovery link. Shows the
   * reset card instead of the credentials card.
   */
  recovery?: boolean;
  /** Called once the recovery password has been set. */
  onRecoveryComplete?: () => void;
}

/** Map raw Supabase auth messages to human-facing catalog keys. */
function errorKeyFor(raw: string): TranslationKey {
  if (/invalid login credentials/i.test(raw)) {
    return "auth.errors.invalidCredentials";
  }
  if (/already registered/i.test(raw)) {
    return "auth.errors.alreadyRegistered";
  }
  return "auth.errors.generic";
}

type View = "credentials" | "resetRequest";

export function AuthScreen({
  recovery = false,
  onRecoveryComplete,
}: AuthScreenProps = {}) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("credentials");
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset-request card state (separate from the credentials form so switching
  // views never carries one card's error onto the other).
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  const recoveryMessages = useMemo(
    () => ({
      mismatch: t("settings.account.errors.mismatch"),
      tooShort: t("settings.account.errors.tooShort", {
        min: PASSWORD_MIN_LENGTH,
      }),
      samePassword: t("settings.account.errors.samePassword"),
      generic: t("settings.account.errors.generic"),
      // No success banner here: onRecoveryComplete hands the user straight to
      // the app, so there is no screen left to show it on.
    }),
    [t],
  );
  const recoveryForm = usePasswordUpdate(recoveryMessages, {
    onSuccess: onRecoveryComplete,
  });

  const labels: AuthCardLabels = {
    productName: t("auth.productName"),
    tagline: t("auth.tagline"),
    modeToggle: t("auth.modeToggle"),
    signIn: t("auth.signIn"),
    signUp: t("auth.signUp"),
    email: t("auth.email"),
    emailPlaceholder: t("auth.emailPlaceholder"),
    password: t("auth.password"),
    passwordHelper: t("auth.passwordHelper", { min: PASSWORD_MIN_LENGTH }),
    showPassword: t("auth.showPassword"),
    hidePassword: t("auth.hidePassword"),
    busy: t("auth.busy"),
    footerSignIn: t("auth.footerSignIn"),
    footerSignUp: t("auth.footerSignUp"),
    forgotPassword: t("auth.forgotPassword"),
  };

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
  };

  const submit = async () => {
    // Re-entry guard: `disabled={busy}` only lands on the next render, so
    // rapid Enter presses could otherwise fire the auth call twice.
    if (busy) return;
    setError(null);
    setBusy(true);
    const fn = mode === "signIn" ? signIn : signUp;
    const result = await fn(email.trim(), password);
    setBusy(false);
    if (result.error) {
      // Raw message goes to the console for the N=1 owner; the screen
      // shows the human-facing catalog text (brief §2 issue 5).
      console.error("[auth]", result.error);
      setError(t(errorKeyFor(result.error)));
      return;
    }
    if (!result.session) {
      setError(t("auth.errors.noSession"));
    }
    // Success: the App's auth listener swaps to the main screen.
  };

  const submitResetRequest = async () => {
    if (resetBusy) return;
    setResetError(null);
    setResetNotice(null);
    setResetBusy(true);
    const result = await sendPasswordResetEmail(resetEmail.trim());
    setResetBusy(false);
    if (result.error) {
      console.error("[auth] resetPasswordForEmail", result.error);
      setResetError(t("auth.resetRequest.error"));
      return;
    }
    // Deliberately the same line whether or not the address has an account —
    // Supabase does not disclose which, and neither should the screen.
    setResetNotice(t("auth.resetRequest.sent"));
  };

  const openResetRequest = () => {
    // Carry over whatever was typed in the sign-in field: the address is
    // almost always the one the user just tried.
    setResetEmail(email.trim());
    setResetError(null);
    setResetNotice(null);
    setView("resetRequest");
  };

  let card: React.JSX.Element;
  if (recovery) {
    card = (
      <PasswordRecoveryCard
        password={recoveryForm.password}
        onPasswordChange={recoveryForm.setPassword}
        confirmPassword={recoveryForm.confirmPassword}
        onConfirmPasswordChange={recoveryForm.setConfirmPassword}
        error={recoveryForm.error}
        confirmInvalid={recoveryForm.confirmInvalid}
        busy={recoveryForm.busy}
        onSubmit={recoveryForm.submit}
        labels={{
          productName: t("auth.productName"),
          tagline: t("auth.tagline"),
          heading: t("auth.recovery.heading"),
          description: t("auth.recovery.description"),
          newPassword: t("auth.recovery.newPassword"),
          newPasswordHelper: t("auth.recovery.newPasswordHelper", {
            min: PASSWORD_MIN_LENGTH,
          }),
          confirmPassword: t("auth.recovery.confirmPassword"),
          showPassword: t("auth.showPassword"),
          hidePassword: t("auth.hidePassword"),
          submit: t("auth.recovery.submit"),
          busy: t("auth.recovery.busy"),
        }}
      />
    );
  } else if (view === "resetRequest") {
    card = (
      <PasswordResetRequestCard
        email={resetEmail}
        onEmailChange={setResetEmail}
        error={resetError}
        notice={resetNotice}
        busy={resetBusy}
        onSubmit={() => void submitResetRequest()}
        onBack={() => setView("credentials")}
        labels={{
          productName: t("auth.productName"),
          tagline: t("auth.tagline"),
          heading: t("auth.resetRequest.heading"),
          description: t("auth.resetRequest.description"),
          email: t("auth.email"),
          emailPlaceholder: t("auth.emailPlaceholder"),
          submit: t("auth.resetRequest.submit"),
          busy: t("auth.resetRequest.busy"),
          back: t("auth.resetRequest.back"),
        }}
      />
    );
  } else {
    card = (
      <AuthCard
        mode={mode}
        onModeChange={changeMode}
        email={email}
        onEmailChange={setEmail}
        password={password}
        onPasswordChange={setPassword}
        error={error}
        busy={busy}
        onSubmit={() => void submit()}
        onForgotPassword={openResetRequest}
        labels={labels}
      />
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-lumen-bg px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-lumen-text md:px-6">
      {card}
    </div>
  );
}
