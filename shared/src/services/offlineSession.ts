import type { Session } from "@supabase/supabase-js";
import { hasPersistedSnapshots } from "../state/persistentCache";
import { resolveAuthStorage } from "./supabaseAuthStorage";
import { authStorageKey, getSupabaseClient } from "./supabaseClient";

/*
 * What the session gate needs to open the app with no network (#2334 — plan
 * 2026-10-21-offline-cache.md P1c step 3). Read from @supabase/auth-js 2.105.4:
 *
 * - A stored session that still has more than 90 seconds to run comes back from
 *   `getSession()` with no request, so a valid session opens offline already.
 * - An expiring one goes to `_refreshAccessToken`, which retries a failed fetch
 *   with backoff for up to 30 seconds. Startup does that once (`_initialize`)
 *   and `getSession()` once more, so the answer can take about 50 seconds.
 * - The answer is then `{ session: null, error: AuthRetryableFetchError }`, and
 *   `INITIAL_SESSION` fires with null. The session stays in storage: only an
 *   error that is NOT retryable removes it and fires SIGNED_OUT.
 *
 * So "null" has two meanings, and only the error tells them apart. A session
 * that was signed out is gone from storage, which is why reading storage here
 * cannot bring it back.
 */

/** How long the gate waits for `getSession()` before it looks at storage. */
export const SESSION_GATE_OFFLINE_MS = 1_000;
export const SESSION_GATE_ONLINE_MS = 8_000;
/** How long "is anything stored for this user" may take. */
const DATA_CHECK_TIMEOUT_MS = 1_000;

export interface SessionRead {
  session: Session | null;
  /** The session could not be refreshed: the network, not the user, said no. */
  unreachable: boolean;
}

/** `getSession()` with its error kept. Never rejects. */
export async function readSession(): Promise<SessionRead> {
  try {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (data.session) return { session: data.session, unreachable: false };
    return {
      session: null,
      unreachable: error?.name === "AuthRetryableFetchError",
    };
  } catch {
    // A lock that timed out says nothing about the session either way.
    return { session: null, unreachable: true };
  }
}

function asStoredSession(raw: string | null): Session | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Partial<Session> | null;
    if (
      typeof value?.access_token === "string" &&
      typeof value.refresh_token === "string" &&
      typeof value.user?.id === "string"
    ) {
      return value as Session;
    }
  } catch {
    // Not a session this app wrote.
  }
  return null;
}

/** The session in the auth storage, with no network and no refresh. */
export async function readStoredSession(): Promise<Session | null> {
  try {
    const key = authStorageKey();
    if (key === null) return null;
    const storage = resolveAuthStorage() ?? window.localStorage;
    return asStoredSession(await storage.getItem(key));
  } catch {
    return null;
  }
}

/** Whose box and whose lists this device holds, while the network is down. */
export async function readStoredOwnerId(): Promise<string | null> {
  return (await readStoredSession())?.user.id ?? null;
}

async function hasStoredData(userId: string): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), DATA_CHECK_TIMEOUT_MS);
  });
  try {
    return await Promise.race([hasPersistedSnapshots(userId), timeout]);
  } catch {
    return false;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/**
 * The session to open the app with while the server cannot be reached. Needs
 * the stored session and data stored under that session's user, whose database
 * is the only one this names, so nobody else's lists can be reached this way.
 *
 * `requireData: false` is for a pending password recovery: that gate shows the
 * reset card, which draws none of the stored data.
 */
export async function readOfflineEntry(
  requireData: boolean,
): Promise<Session | null> {
  const stored = await readStoredSession();
  if (stored === null || !requireData) return stored;
  return (await hasStoredData(stored.user.id)) ? stored : null;
}
