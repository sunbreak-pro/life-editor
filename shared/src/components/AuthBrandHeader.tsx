import { PenLine } from "lucide-react";

export interface AuthBrandHeaderProps {
  /** Brand name next to the logo mark ("Life Editor"). */
  productName: string;
  /** One-line description under the brand header. */
  tagline: string;
}

/*
 * Brand header of the pre-login cards — logo mark + product name + tagline.
 * Extracted from AuthCard (#919) so the password-recovery cards wear the same
 * head instead of restating the markup. Pure presentation, copy injected
 * already-translated (§6.4), lumen-* tokens only (§5).
 */
export function AuthBrandHeader({
  productName,
  tagline,
}: AuthBrandHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-lumen-md bg-lumen-accent text-lumen-on-accent">
          <PenLine aria-hidden className="h-4 w-4" />
        </div>
        <span className="text-lg font-semibold text-lumen-text">
          {productName}
        </span>
      </div>
      <p className="text-sm text-lumen-text-secondary">{tagline}</p>
    </div>
  );
}
