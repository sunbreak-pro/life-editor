import { useState } from "react";
import {
  AuthCard,
  signIn,
  signUp,
  useTranslation,
  type AuthCardLabels,
  type AuthMode,
} from "@life-editor/shared";

/*
 * Phase 1 auth entry (Email + Password), target-IA D8 (ClaudeDesign Auth
 * import). Shell-independent full-screen: bg-primary canvas with the
 * shared AuthCard centered — one responsive layout for Desktop and
 * Mobile (no structural fork; auth is outside the Consumption / Quick
 * capture split). Confirm-email is assumed OFF, so signUp logs the user
 * straight in. Session propagation is handled by the onAuthStateChange
 * listener in App. This host owns the state + the signIn/signUp calls;
 * AuthCard stays pure presentation.
 */

/** Map raw Supabase auth messages to human-facing catalog keys. */
function errorKeyFor(raw: string): string {
  if (/invalid login credentials/i.test(raw)) {
    return "auth.errors.invalidCredentials";
  }
  if (/already registered/i.test(raw)) {
    return "auth.errors.alreadyRegistered";
  }
  return "auth.errors.generic";
}

export function AuthScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const labels: AuthCardLabels = {
    productName: t("auth.productName"),
    tagline: t("auth.tagline"),
    modeToggle: t("auth.modeToggle"),
    signIn: t("auth.signIn"),
    signUp: t("auth.signUp"),
    email: t("auth.email"),
    emailPlaceholder: t("auth.emailPlaceholder"),
    password: t("auth.password"),
    passwordHelper: t("auth.passwordHelper"),
    showPassword: t("auth.showPassword"),
    hidePassword: t("auth.hidePassword"),
    busy: t("auth.busy"),
    footerSignIn: t("auth.footerSignIn"),
    footerSignUp: t("auth.footerSignUp"),
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

  return (
    <div className="flex min-h-svh items-center justify-center bg-lumen-bg px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-lumen-text md:px-6">
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
        labels={labels}
      />
    </div>
  );
}
