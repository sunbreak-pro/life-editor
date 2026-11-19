import type {
  AuthChangeEvent,
  Session,
  Subscription,
} from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabaseClient";
import { isBrowserOffline } from "../state/connectivity";
import { forgetDomainSnapshots } from "../state/domainSnapshotStore";
import {
  DISPLAY_NAME_METADATA_KEY,
  normalizeDisplayName,
} from "../utils/profile";

/*
 * Phase 1 Email + Password auth wrapper.
 *
 * Thin, typed surface over supabase-auth so the web UI never touches the
 * raw client. There is no sign-up (#2752): the app has one user, whose
 * account already exists.
 *
 * OAuth / magic link / Apple Sign-in are explicitly out of scope here.
 */

export interface AuthResult {
  /** null on success, a human-readable message on failure. */
  error: string | null;
  session: Session | null;
}

function toResult(
  data: { session: Session | null },
  error: { message: string } | null,
): AuthResult {
  return {
    error: error ? error.message : null,
    session: data.session ?? null,
  };
}

export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email,
    password,
  });
  return toResult(data, error);
}

/*
 * Where the emailed password-reset link should land (#919).
 *
 * The email link opens in the OS default browser, never inside the Electron
 * shell, so the reset is always completed on the public web build.
 * `window.location.origin` is right when the request itself was made from a
 * browser (it keeps localhost working during `npm run dev`), but in the
 * packaged Desktop the origin is `file://` — not a URL Supabase can redirect
 * to. Those fall back to the deployed web URL
 * (migration SSOT §Web URL, #600); override with VITE_PUBLIC_WEB_URL if the
 * deployment ever moves.
 */
const PUBLIC_WEB_URL =
  (import.meta.env.VITE_PUBLIC_WEB_URL as string | undefined) ??
  "https://life-editor.sunbreak-pro.workers.dev";

export function authRedirectUrl(): string {
  if (typeof window === "undefined") return PUBLIC_WEB_URL;
  const { protocol, origin } = window.location;
  return protocol === "http:" || protocol === "https:"
    ? origin
    : PUBLIC_WEB_URL;
}

/**
 * Send the "reset your password" email. Resolves with `error: null` whether or
 * not the address has an account — Supabase deliberately does not disclose
 * which, and the UI must not either.
 */
export async function sendPasswordResetEmail(
  email: string,
): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
    email,
    { redirectTo: authRedirectUrl() },
  );
  return { error: error ? error.message : null };
}

/**
 * Set a new password for the CURRENT session. Serves both entry points: the
 * signed-in change form and the post-recovery reset (the recovery link signs
 * the user in, so by then this is an ordinary session).
 */
export async function updatePassword(
  password: string,
): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().auth.updateUser({ password });
  return { error: error ? error.message : null };
}

/**
 * Save the display name the sidebar shows instead of the address (#1624).
 *
 * Written to `user_metadata`, which `updateUser` merges key by key, so this
 * touches nothing else stored there. A blank name is stored as null — that is
 * how the user goes back to seeing their address. On success Supabase fires
 * USER_UPDATED with the new session, which is what refreshes the sidebar.
 */
export async function updateDisplayName(
  name: string,
): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().auth.updateUser({
    data: { [DISPLAY_NAME_METADATA_KEY]: normalizeDisplayName(name) },
  });
  return { error: error ? error.message : null };
}

/** Whose data is on this device. Read first: signing out removes the answer. */
async function sessionUserId(
  client: ReturnType<typeof getSupabaseClient>,
): Promise<string | null> {
  try {
    const { data } = await client.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    // No session to read: nothing of anyone's is cached under this tab.
    return null;
  }
}

/*
 * #2334: with no network supabase-js keeps the session and reports an error, and
 * can spend 50 seconds retrying first, so the attempt is not made. A session that
 * is still there keeps its lists: deleting them would leave the user signed in
 * with nothing to read the next time they open the app offline.
 *
 * Only the browser's own "no network" skips the attempt. A session marked
 * unreachable can outlast the outage by a whole retry, so that case tries: the
 * network may be back, and a refusal comes back as an error all the same. The
 * text is for logs: the buttons show their own translated notice.
 */
export async function signOut(): Promise<{ error: string | null }> {
  if (isBrowserOffline()) return { error: "Signing out needs a connection." };
  const client = getSupabaseClient();
  // #2331: whose lists to delete from the device.
  const userId = await sessionUserId(client);
  const { error } = await client.auth.signOut();
  if (error) return { error: error.message };
  if (userId !== null) await forgetDomainSnapshots(userId);
  return { error: null };
}

export async function getSession(): Promise<Session | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session ?? null;
}

/**
 * Subscribe to auth state changes. Returns the underlying subscription;
 * call `.unsubscribe()` (e.g. in a React effect cleanup) to detach.
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): Subscription {
  const { data } = getSupabaseClient().auth.onAuthStateChange(callback);
  return data.subscription;
}
