import { useId } from "react";
import type { FormEvent } from "react";
import { cn } from "./cn";
import { AUTH_SURFACE_CLASS } from "./authSurface";
import { NoticePanel } from "./NoticePanel";
import { AuthBrandHeader } from "./AuthBrandHeader";
import { Button } from "./Button";
import { PasswordField, type PasswordFieldLabels } from "./PasswordField";

export interface AuthCardLabels {
  /** Brand name next to the logo mark ("Life Editor"). */
  productName: string;
  /** One-line description under the brand header. */
  tagline: string;
  /** Submit label. */
  signIn: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  showPassword: string;
  hidePassword: string;
  /** Submit label while the request is in flight. */
  busy: string;
  /** Link to the reset-request card (#919). */
  forgotPassword: string;
}

export interface AuthCardProps {
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
  /** Opens the reset-request card. */
  onForgotPassword: () => void;
  labels: AuthCardLabels;
  className?: string;
}

/*
 * Auth card (ClaudeDesign Auth import) — brand header + email/password
 * sign-in form + inline error band + busy submit. There is no sign-up mode
 * (#2752): the app has one user, whose account already exists.
 * Shell-independent: this is the pre-login entry, so no Sidebar / tabs /
 * Toast here. The card is the primary container: opaque bg-secondary
 * face (§5). Pure presentation: copy + submit intent are injected by the
 * host (§6.4) — the host owns the signIn call (DataService-style
 * boundary), this component never touches the backend.
 */
export function AuthCard({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  error,
  busy,
  onSubmit,
  onForgotPassword,
  labels,
  className,
}: AuthCardProps): React.JSX.Element {
  const passwordId = useId();
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

      {/* The design dims the fields while busy; the alert band and submit
          button stay at full strength (the button carries the spinner). */}
      <div
        className={cn(
          "flex flex-col gap-4",
          busy && "pointer-events-none opacity-60",
        )}
      >
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
          {/* No minLength (#956): the minimum is a rule for a password being
              created, and the account's existing one predates every raise of
              it. Enforced here it would refuse to submit the real password,
              locking the owner out until they went through email recovery. */}
          <PasswordField
            id={passwordId}
            required
            autoComplete="current-password"
            value={password}
            disabled={busy}
            onChange={onPasswordChange}
            labels={passwordLabels}
          />
        </div>

        <button
          type="button"
          onClick={onForgotPassword}
          disabled={busy}
          className="self-start rounded-lumen-sm text-sm text-lumen-text-secondary underline-offset-2 transition-colors hover:text-lumen-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent disabled:cursor-not-allowed"
        >
          {labels.forgotPassword}
        </button>
      </div>

      {error ? <NoticePanel message={error} tone="danger" role="alert" /> : null}

      <Button
        type="submit"
        size="lg"
        busy={busy}
        busyLabel={labels.busy}
        className="w-full"
      >
        {labels.signIn}
      </Button>
    </form>
  );
}
