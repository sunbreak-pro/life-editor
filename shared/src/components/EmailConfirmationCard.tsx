import { LoaderCircle, MailCheck } from "lucide-react";
import { cn } from "./cn";
import { AUTH_SURFACE_CLASS } from "./authSurface";
import { NoticePanel } from "./NoticePanel";
import { AuthBrandHeader } from "./AuthBrandHeader";
import { Button } from "./Button";

export interface EmailConfirmationCardLabels {
  productName: string;
  tagline: string;
  /** Card heading ("Check your inbox"). */
  heading: string;
  /** Explanation under the heading — the host interpolates the address into it. */
  description: string;
  /** Second line: what to do if the mail never arrives. */
  hint: string;
  /** Resend button at rest. */
  resend: string;
  /** Resend button while the request is in flight. */
  busy: string;
  /** Link back to the sign-in card. */
  back: string;
}

export interface EmailConfirmationCardProps {
  /** Address the confirmation went to, shown so a typo is visible. */
  email: string;
  /** Already-translated error, or null to hide the band. */
  error: string | null;
  /** Already-translated "sent again" line, or null. */
  notice: string | null;
  busy: boolean;
  onResend: () => void;
  onBack: () => void;
  labels: EmailConfirmationCardLabels;
  className?: string;
}

/*
 * The screen between "signed up" and "signed in" (#1197).
 *
 * With Confirm email ON, signUp returns no session — so without this card the
 * form would either sit there looking broken or, worse, report a failure for
 * an account that was created just fine. It is a dead end by design: the way
 * forward is the link in the mail, and the only two things offered here are
 * sending that mail again and going back to sign in.
 *
 * The address is printed rather than assumed remembered, because the most
 * common reason the mail never arrives is that it went to a typo.
 *
 * Pure presentation (§6.4) — the host owns the resend call.
 */
export function EmailConfirmationCard({
  email,
  error,
  notice,
  busy,
  onResend,
  onBack,
  labels,
  className,
}: EmailConfirmationCardProps) {
  return (
    <div
      aria-busy={busy || undefined}
      className={cn(AUTH_SURFACE_CLASS, className)}
    >
      <AuthBrandHeader
        productName={labels.productName}
        tagline={labels.tagline}
      />

      <div className="flex flex-col items-center gap-3 text-center">
        <MailCheck aria-hidden className="h-8 w-8 text-lumen-accent" />
        <div className="flex flex-col gap-1.5">
          {/* role="status": the user lands here from a submit, so the outcome
              should be announced without interrupting like an alert would. */}
          <h1 role="status" className="text-base font-semibold text-lumen-text">
            {labels.heading}
          </h1>
          <p className="text-sm text-lumen-text-secondary">
            {labels.description}
          </p>
          <p className="text-sm font-medium break-all text-lumen-text">
            {email}
          </p>
          <p className="text-xs text-lumen-text-tertiary">{labels.hint}</p>
        </div>
      </div>

      {error ? <NoticePanel message={error} tone="danger" role="alert" /> : null}
      {notice ? <NoticePanel message={notice} tone="success" role="alert" /> : null}

      <Button
        type="button"
        variant="secondary"
        size="lg"
        disabled={busy}
        onClick={onResend}
        className="w-full"
      >
        {busy ? (
          <>
            <LoaderCircle
              aria-hidden
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
            />
            {labels.busy}
          </>
        ) : (
          labels.resend
        )}
      </Button>

      <button
        type="button"
        onClick={onBack}
        className="rounded-lumen-sm text-center text-sm text-lumen-text-secondary underline-offset-2 transition-colors hover:text-lumen-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        {labels.back}
      </button>
    </div>
  );
}
