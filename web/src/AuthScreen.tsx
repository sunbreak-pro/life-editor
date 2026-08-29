import { useMemo, useState } from "react";
import {
  AuthCard,
  EmailConfirmationCard,
  PASSWORD_MIN_LENGTH,
  PasswordRecoveryCard,
  PasswordResetRequestCard,
  i18n,
  resendConfirmationEmail,
  sendPasswordResetEmail,
  signIn,
  signUp,
  useTranslation,
  type AuthCardLabels,
  type AuthMode,
  type TranslationKey,
} from "@life-editor/shared";
import { usePasswordUpdate } from "./hooks/usePasswordUpdate";
import { LegalView } from "./legal/LegalView";
import {
  legalDocument,
  type LegalDocumentId,
} from "./legal/legalContent";

/*
 * Phase 1 auth entry (Email + Password), target-IA D8 (ClaudeDesign Auth
 * import). Shell-independent full-screen: bg-primary canvas with the
 * shared card centered — one responsive layout for Desktop and
 * Mobile (no structural fork; auth is outside the Consumption / Quick
 * capture split). Session propagation is handled by the onAuthStateChange
 * listener in App. This host owns the state + the auth calls; the cards stay
 * pure presentation.
 *
 * Confirm email works either way (#1197). With it OFF signUp returns a live
 * session and App swaps to the app; with it ON there is no session, and the
 * "check your inbox" view below is what the user gets instead of a form that
 * looks like it did nothing. Nothing here reads the project setting — the
 * shape of the signUp result is the only signal, so flipping the toggle in
 * the dashboard needs no code change.
 *
 * Four views share the canvas (#919 / #1197): the credentials card, the
 * "email me a reset link" card, and — when App reports a PASSWORD_RECOVERY
 * event — the "set a new password" card. The recovery view is driven from
 * App rather than from local state because the recovery link creates a REAL
 * session: without that gate the app would have swapped to MainScreen and the
 * user would never see a way to finish the reset.
 *
 * The policy / terms reader (#1198) sits beside them rather than on the
 * canvas: it is a full page, not a card, and it takes over the screen when
 * either the footer links or a `?legal=` URL asks for it.
 */

export interface AuthScreenProps {
  /**
   * True when the user arrived through a password-recovery link. Shows the
   * reset card instead of the credentials card.
   */
  recovery?: boolean;
  /**
   * Address of the recovery session, handed to the password manager (#945).
   * App reads it off the session the recovery link created; a session without
   * an email simply leaves the field out.
   */
  recoveryUsername?: string;
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
  // What Supabase returns for signing in to an account whose address was
  // never confirmed. Generic copy here would send the user hunting for a
  // typo in a password that is perfectly correct.
  if (/email not confirmed/i.test(raw)) {
    return "auth.errors.emailNotConfirmed";
  }
  return "auth.errors.generic";
}

/*
 * The open document, kept in the address bar (#1198).
 *
 * There is no router (§3.2), and a policy nobody can link to is only half a
 * policy — an app store form, a mail, a message to a friend all want a URL.
 * `?legal=privacy` is the cheapest thing that gives one: the SPA is served
 * for any query string, so the parameter survives a reload and a shared link
 * opens straight onto the document.
 */
function readLegalParam(): LegalDocumentId | null {
  try {
    const value = new URLSearchParams(window.location.search).get("legal");
    return value === "privacy" || value === "terms" ? value : null;
  } catch {
    return null;
  }
}

function writeLegalParam(id: LegalDocumentId | null): void {
  try {
    const params = new URLSearchParams(window.location.search);
    if (id) params.set("legal", id);
    else params.delete("legal");
    const query = params.toString();
    const { pathname, hash } = window.location;
    window.history.replaceState(
      window.history.state,
      "",
      `${pathname}${query ? `?${query}` : ""}${hash}`,
    );
  } catch {
    // Then the document still opens; only the address bar misses out.
  }
}

const LEGAL_LINK_CLASS =
  "rounded-lumen-sm text-xs text-lumen-text-secondary underline " +
  "underline-offset-2 transition-colors hover:text-lumen-text " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

type View = "credentials" | "resetRequest" | "confirmPending";

export function AuthScreen({
  recovery = false,
  recoveryUsername,
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

  // Confirmation-pending card state (#1197). The address is held separately
  // from `email` so the card keeps showing what the link was sent to even if
  // the user walks back to the form and edits the field.
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);

  // Policy / terms reader (#1198). Read from the URL on mount so a shared
  // link lands on the document rather than on the sign-in form.
  const [legalDoc, setLegalDoc] = useState<LegalDocumentId | null>(
    readLegalParam,
  );

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
    /*
     * Confirm email ON (#1197): the account exists, no session was started,
     * and the mail is out. This is a success, not a failure — the only
     * remaining step happens in the inbox.
     */
    if (result.pendingConfirmation) {
      setPendingEmail(email.trim());
      setResendError(null);
      setResendNotice(null);
      setView("confirmPending");
      return;
    }
    if (!result.session) {
      setError(t("auth.errors.noSession"));
    }
    // Success: the App's auth listener swaps to the main screen.
  };

  const submitResend = async () => {
    if (resendBusy) return;
    setResendError(null);
    setResendNotice(null);
    setResendBusy(true);
    const result = await resendConfirmationEmail(pendingEmail);
    setResendBusy(false);
    if (result.error) {
      console.error("[auth] resendConfirmationEmail", result.error);
      setResendError(t("auth.confirm.error"));
      return;
    }
    setResendNotice(t("auth.confirm.sent"));
  };

  const leaveConfirmPending = () => {
    // Back to a clean sign-in form: the account now exists, so the next step
    // after the link is signing in, not signing up again.
    setMode("signIn");
    setPassword("");
    setError(null);
    setView("credentials");
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

  const openLegal = (id: LegalDocumentId) => {
    setLegalDoc(id);
    writeLegalParam(id);
  };

  const closeLegal = () => {
    setLegalDoc(null);
    writeLegalParam(null);
  };

  /*
   * A document wins over every card, including the recovery one: the reader
   * is a full page, and the only way in is a deliberate click or a link that
   * named it. Coming back returns to whatever card was underneath.
   */
  if (legalDoc) {
    return (
      <LegalView
        document={legalDocument(legalDoc, i18n.language)}
        backLabel={t("auth.legal.back")}
        updatedLabel={t("auth.legal.updated")}
        onBack={closeLegal}
      />
    );
  }

  /*
   * Shown on the credentials card in both modes — the terms bind a reader as
   * much as a signer-up — with the consent sentence added only where an
   * account is actually being created (#1198).
   */
  const legalFooter = (
    <div className="flex flex-col items-center gap-1.5">
      {mode === "signUp" ? (
        <p className="text-center text-xs text-lumen-text-tertiary">
          {t("auth.legal.consent")}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-x-2">
        <button
          type="button"
          onClick={() => openLegal("terms")}
          className={LEGAL_LINK_CLASS}
        >
          {t("auth.legal.terms")}
        </button>
        <span aria-hidden className="text-xs text-lumen-text-tertiary">
          ·
        </span>
        <button
          type="button"
          onClick={() => openLegal("privacy")}
          className={LEGAL_LINK_CLASS}
        >
          {t("auth.legal.privacy")}
        </button>
      </div>
    </div>
  );

  let card: React.JSX.Element;
  if (recovery) {
    card = (
      <PasswordRecoveryCard
        username={recoveryUsername}
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
  } else if (view === "confirmPending") {
    card = (
      <EmailConfirmationCard
        email={pendingEmail}
        error={resendError}
        notice={resendNotice}
        busy={resendBusy}
        onResend={() => void submitResend()}
        onBack={leaveConfirmPending}
        labels={{
          productName: t("auth.productName"),
          tagline: t("auth.tagline"),
          heading: t("auth.confirm.heading"),
          description: t("auth.confirm.description"),
          hint: t("auth.confirm.hint"),
          resend: t("auth.confirm.resend"),
          busy: t("auth.confirm.busy"),
          back: t("auth.confirm.back"),
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
        legalFooter={legalFooter}
      />
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-lumen-bg px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-lumen-text md:px-6">
      {card}
    </div>
  );
}
