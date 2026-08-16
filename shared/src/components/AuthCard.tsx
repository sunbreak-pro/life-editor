import { useId } from "react";
import type { FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "./cn";
import { AUTH_SURFACE_CLASS } from "./authSurface";
import { AuthAlert } from "./AuthAlert";
import { AuthBrandHeader } from "./AuthBrandHeader";
import { Button } from "./Button";
import { PasswordField, type PasswordFieldLabels } from "./PasswordField";
import { SegmentedToggle } from "./SegmentedToggle";

export type AuthMode = "signIn" | "signUp";

export interface AuthCardLabels {
  /** Brand name next to the logo mark ("Life Editor"). */
  productName: string;
  /** One-line description under the brand header. */
  tagline: string;
  /** Accessible name of the mode radiogroup. */
  modeToggle: string;
  /** Segment + submit label for the sign-in mode. */
  signIn: string;
  /** Segment + submit label for the sign-up mode. */
  signUp: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  /** Hint under the password input (min-length rule). */
  passwordHelper: string;
  showPassword: string;
  hidePassword: string;
  /** Submit label while the request is in flight. */
  busy: string;
  /** Footer hint shown in sign-in mode. */
  footerSignIn: string;
  /** Footer hint shown in sign-up mode. */
  footerSignUp: string;
  /** Link to the reset-request card, shown in sign-in mode (#919). */
  forgotPassword: string;
}

export interface AuthCardProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  /** Already-translated error message, or null to hide the alert band. */
  error: string | null;
  /** True while the auth request is in flight (dims + disables the form). */
  busy: boolean;
  /** Fired on form submit (Enter / button). preventDefault is handled here. */
  onSubmit: () => void;
  /** Opens the reset-request card. The link renders in sign-in mode only. */
  onForgotPassword: () => void;
  labels: AuthCardLabels;
  passwordMinLength?: number;
  className?: string;
}

/*
 * Auth card (ClaudeDesign Auth import) — brand header + sign-in/sign-up
 * mode toggle + email/password form + inline error band + busy submit.
 * Shell-independent: this is the pre-login entry, so no Sidebar / tabs /
 * Toast here. The card is the primary container: opaque bg-secondary
 * face (§5). Pure presentation: copy + submit intent are injected by the
 * host (§6.4) — the host owns the signIn/signUp calls (DataService-style
 * boundary), this component never touches the backend.
 */
export function AuthCard({
  mode,
  onModeChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  error,
  busy,
  onSubmit,
  onForgotPassword,
  labels,
  passwordMinLength = 6,
  className,
}: AuthCardProps) {
  const passwordId = useId();
  const submitLabel = mode === "signIn" ? labels.signIn : labels.signUp;
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
      className={cn(AUTH_SURFACE_CLASS, className)}
    >
      <AuthBrandHeader
        productName={labels.productName}
        tagline={labels.tagline}
      />

      {/* The design dims the toggle + fields while busy; the alert band and
          submit button stay at full strength (the button carries the spinner). */}
      <div
        className={cn(
          "flex flex-col gap-4",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <SegmentedToggle<AuthMode>
          options={[
            { value: "signIn", label: labels.signIn },
            { value: "signUp", label: labels.signUp },
          ]}
          value={mode}
          onChange={onModeChange}
          label={labels.modeToggle}
          disabled={busy}
        />

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-lumen-text-secondary">
            {labels.email}
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder={labels.emailPlaceholder}
            value={email}
            disabled={busy}
            onChange={(e) => onEmailChange(e.target.value)}
            className="h-12 w-full rounded-lumen-md border border-lumen-border bg-lumen-bg px-3 text-base text-lumen-text placeholder:text-lumen-text-tertiary transition-colors focus:border-lumen-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:h-10 md:text-sm"
          />
        </label>

        {/* Explicit htmlFor/id instead of a wrapping label: the field embeds
            the eye-toggle <button>, which must not sit inside a label. */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={passwordId}
            className="text-sm text-lumen-text-secondary"
          >
            {labels.password}
          </label>
          <PasswordField
            id={passwordId}
            required
            minLength={passwordMinLength}
            autoComplete={
              mode === "signIn" ? "current-password" : "new-password"
            }
            value={password}
            disabled={busy}
            onChange={onPasswordChange}
            labels={passwordLabels}
            helperText={labels.passwordHelper}
          />
        </div>

        {/* Sign-in only (#919): in sign-up mode there is no password to have
            forgotten yet, and the link would just be a way to lose the form. */}
        {mode === "signIn" ? (
          <button
            type="button"
            onClick={onForgotPassword}
            disabled={busy}
            className="self-start rounded-lumen-sm text-sm text-lumen-text-secondary underline-offset-2 transition-colors hover:text-lumen-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent disabled:cursor-not-allowed"
          >
            {labels.forgotPassword}
          </button>
        ) : null}
      </div>

      {error ? <AuthAlert message={error} /> : null}

      <Button type="submit" size="lg" disabled={busy} className="w-full">
        {busy ? (
          <>
            <LoaderCircle
              aria-hidden
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
            />
            {labels.busy}
          </>
        ) : (
          submitLabel
        )}
      </Button>

      <p className="text-center text-xs text-lumen-text-tertiary">
        {mode === "signIn" ? labels.footerSignIn : labels.footerSignUp}
      </p>
    </form>
  );
}
