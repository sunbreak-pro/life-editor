import { cn } from "./cn";
import { AUTH_SURFACE_CLASS } from "./authSurface";
import { AuthBrandHeader } from "./AuthBrandHeader";
import {
  PasswordUpdateForm,
  type PasswordUpdateFormLabels,
} from "./PasswordUpdateForm";

export interface PasswordRecoveryCardLabels extends PasswordUpdateFormLabels {
  productName: string;
  tagline: string;
  /** Card heading ("Set a new password"). */
  heading: string;
  /** One-line explanation under the heading. */
  description: string;
}

export interface PasswordRecoveryCardProps {
  password: string;
  onPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  /** Already-translated error, or null to hide the band. */
  error: string | null;
  /** Draws the confirm field in the danger color (the two values differ). */
  confirmInvalid?: boolean;
  busy: boolean;
  onSubmit: () => void;
  labels: PasswordRecoveryCardLabels;
  passwordMinLength?: number;
  className?: string;
}

/*
 * Landing card for a password-recovery link (#919). The link signs the user
 * in before it lands here, so this is the last step of the reset rather than
 * a credential check — hence no email field and no mode toggle.
 *
 * Pure presentation: the host owns the updatePassword() call and what happens
 * after it succeeds (§6.4).
 */
export function PasswordRecoveryCard({
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  error,
  confirmInvalid = false,
  busy,
  onSubmit,
  labels,
  passwordMinLength = 6,
  className,
}: PasswordRecoveryCardProps) {
  return (
    <div className={cn(AUTH_SURFACE_CLASS, className)}>
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
      <PasswordUpdateForm
        password={password}
        onPasswordChange={onPasswordChange}
        confirmPassword={confirmPassword}
        onConfirmPasswordChange={onConfirmPasswordChange}
        error={error}
        confirmInvalid={confirmInvalid}
        busy={busy}
        onSubmit={onSubmit}
        labels={labels}
        passwordMinLength={passwordMinLength}
        fullWidthSubmit
      />
    </div>
  );
}
