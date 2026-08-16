/*
 * The pre-login card face (#919). AuthCard defined it inline; the two
 * password-recovery cards must sit on the identical face, so the class list
 * lives here instead of in three copies that can drift apart.
 *
 * Opaque bg-secondary per §5 — this is a primary container, so no transparency.
 */
export const AUTH_SURFACE_CLASS =
  "flex w-full max-w-[400px] flex-col gap-4 rounded-lumen-lg border " +
  "border-lumen-border bg-lumen-bg-secondary p-5 shadow-lumen-md md:p-6";
