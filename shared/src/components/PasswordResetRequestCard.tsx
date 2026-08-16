import type { FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "./cn";
import { AUTH_SURFACE_CLASS } from "./authSurface";
import { AuthAlert } from "./AuthAlert";
import { AuthBrandHeader } from "./AuthBrandHeader";
import { Button } from "./Button";

export interface PasswordResetRequestCardLabels {
  productName: string;
  tagline: string;
  /** Card heading ("Reset your password"). */
  heading: string;
  /** One-line explanation under the heading. */
  description: string;
  email: string;
  emailPlaceholder: string;
  /** Submit button label at rest. */
  submit: string;
  /** Submit button label while the request is in flight. */
  busy: string;
  /** Link back to the sign-in card. */
  back: string;
}

export interface PasswordResetRequestCardProps {
  email: string;
  onEmailChange: (value: string) => void;
  /** Already-translated error, or null to hide the band. */
  error: string | null;
  /** Already-translated "check your inbox" line, or null before sending. */
  notice: string | null;
  busy: boolean;
  onSubmit: () => void;
  onBack: () => void;
  labels: PasswordResetRequestCardLabels;
  className?: string;
}

/*
 * "Send me a reset link" card (#919) — the entry point from AuthCard's forgot
 * link, for the case where the password is gone and there is no session to
 * change it from.
 *
 * The confirmation stays deliberately vague ("if that address has an
 * account…"): Supabase does not disclose whether the address is registered,
 * and neither should the screen. Pure presentation (§6.4).
 */
export function PasswordResetRequestCard({
  email,
  onEmailChange,
  error,
  notice,
  busy,
  onSubmit,
  onBack,
  labels,
  className,
}: PasswordResetRequestCardProps) {
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
      <div className="flex flex-col gap-1">
        <h1 className="text-base font-semibold text-lumen-text">
          {labels.heading}
        </h1>
        <p className="text-sm text-lumen-text-secondary">
          {labels.description}
        </p>
      </div>

      <label
        className={cn(
          "flex flex-col gap-1.5",
          busy && "pointer-events-none opacity-60",
        )}
      >
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

      {error ? <AuthAlert message={error} /> : null}
      {notice ? <AuthAlert message={notice} tone="success" /> : null}

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
          labels.submit
        )}
      </Button>

      <button
        type="button"
        onClick={onBack}
        className="rounded-lumen-sm text-center text-sm text-lumen-text-secondary underline-offset-2 transition-colors hover:text-lumen-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        {labels.back}
      </button>
    </form>
  );
}
