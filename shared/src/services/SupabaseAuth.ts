import type {
  AuthChangeEvent,
  Session,
  Subscription,
} from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabaseClient";

/*
 * Phase 1 Email + Password auth wrapper.
 *
 * Thin, typed surface over supabase-auth so the web UI never touches the
 * raw client. Assumes "Confirm email" is OFF in the Supabase project
 * (Phase 1 constraint) — signUp returns an active session immediately.
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

export async function signUp(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
  });
  return toResult(data, error);
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
 * Where the recovery link should land (#919).
 *
 * The email link opens in the OS default browser, never inside the Electron
 * or Capacitor shell, so the reset is always completed on the public web
 * build. `window.location.origin` is right when the request itself was made
 * from a browser (it keeps localhost working during `npm run dev`), but on the
 * packaged shells the origin is `file://` / `capacitor://localhost` — not a
 * URL Supabase can redirect to. Those fall back to the deployed web URL
 * (migration SSOT §Web URL, #600); override with VITE_PUBLIC_WEB_URL if the
 * deployment ever moves.
 */
const PUBLIC_WEB_URL =
  (import.meta.env.VITE_PUBLIC_WEB_URL as string | undefined) ??
  "https://life-editor.sunbreak-pro.workers.dev";

export function passwordRecoveryRedirectUrl(): string {
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
    { redirectTo: passwordRecoveryRedirectUrl() },
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

export async function signOut(): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().auth.signOut();
  return { error: error ? error.message : null };
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
