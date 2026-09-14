/*
 * Account profile (#1624) — the display name shown at the foot of the wide
 * sidebar instead of the bare address.
 *
 * Stored in Supabase Auth's `user_metadata`, not a table. It is one short
 * string that only the signed-in user reads, and `auth.updateUser({ data })`
 * already scopes the write to that user, so a `profiles` table would add a
 * migration, RLS and a Realtime domain for nothing this needs. The session
 * carries the metadata, which is also what makes the sidebar update at once:
 * the write fires USER_UPDATED, App stores the new session, and the shell
 * re-renders off it.
 *
 * The helpers take the user's shape structurally rather than supabase-js's
 * `User`, so they stay pure and can be read without a client.
 */

/** The `user_metadata` key the name is written under. */
export const DISPLAY_NAME_METADATA_KEY = "display_name";

/** Longest name the form accepts, in UTF-16 units (what `maxLength` counts). */
export const DISPLAY_NAME_MAX_LENGTH = 50;

/** The two fields of a Supabase user the profile reads. */
export interface ProfileUserLike {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

/**
 * The name as typed, made storable: surrounding whitespace trimmed, and
 * `null` for nothing at all — clearing the field is how a user goes back to
 * showing their address, so empty must not be stored as a name of "".
 */
export function normalizeDisplayName(input: string): string | null {
  const trimmed = input.trim();
  return trimmed === "" ? null : trimmed;
}

/** The stored display name, or "" when none is set. */
export function readDisplayName(
  user: ProfileUserLike | null | undefined,
): string {
  const raw = user?.user_metadata?.[DISPLAY_NAME_METADATA_KEY];
  return typeof raw === "string" ? raw.trim() : "";
}

/** What the sidebar shows for the account: the name, else the address. */
export function accountDisplayLabel(
  user: ProfileUserLike | null | undefined,
): string {
  return readDisplayName(user) || (user?.email ?? "");
}
