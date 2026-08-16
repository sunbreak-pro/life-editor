/*
 * The account password policy the app enforces, as one number (#956,
 * D-20260816-shared-fix-4).
 *
 * The free Supabase plan has no leaked-password check
 * (`docs/vision/plans/2026-08-07-web-mobile-public-url.md:161-164`), so length
 * is the whole defence, and since #919 put the password screens inside the app
 * the floor those screens show IS the effective policy.
 *
 * It lives here rather than as a default baked into each card because four
 * surfaces have to agree on it — the sign-up field, the recovery reset card,
 * Settings' account card, and the client-side check that runs before Supabase
 * is called — and the en / ja helper lines have to quote the same figure.
 * Writing "12" into the catalog would be a second copy that nothing forces to
 * match, so those strings interpolate `{{min}}` and are handed this constant.
 *
 * Supabase enforces its own minimum server-side (Authentication > Providers >
 * Email > Minimum password length). That setting is the real floor; the app
 * can neither read nor write it, so raising this number means moving the
 * dashboard setting by hand to the same value.
 */

/** Minimum length of a newly set account password. */
export const PASSWORD_MIN_LENGTH = 12;
