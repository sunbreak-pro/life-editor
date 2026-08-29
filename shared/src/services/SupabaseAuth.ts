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
 * raw client. Works with "Confirm email" either ON or OFF (#1197): with it
 * off signUp returns a live session, with it on it returns none and the
 * caller gets `pendingConfirmation` instead. The project setting is the
 * owner's to flip in the dashboard; nothing here reads it.
 *
 * OAuth / magic link / Apple Sign-in are explicitly out of scope here.
 */

export interface AuthResult {
  /** null on success, a human-readable message on failure. */
  error: string | null;
  session: Session | null;
  /**
   * signUp only. True when the account was created but Supabase started no
   * session because the address has to be confirmed first — the one outcome
   * that is neither an error nor a way in, and so needs a screen of its own.
   */
  pendingConfirmation?: boolean;
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
    // Same reasoning as the recovery link: the mail opens in the OS default
    // browser, never inside the Electron or Capacitor shell.
    options: { emailRedirectTo: authRedirectUrl() },
  });
  if (error) return { ...toResult(data, error), pendingConfirmation: false };
  /*
   * Confirm email ON: no session, but a user row came back and the mail is
   * out. Note what this ALSO covers — signing up with an address that is
   * already registered returns exactly this shape (an obfuscated user with
   * no identities), because Supabase refuses to disclose which addresses
   * exist. Telling those two apart is not ours to do, and the screen this
   * drives says the same thing either way: check your inbox.
   */
  const pendingConfirmation = !data.session && Boolean(data.user);
  return { ...toResult(data, error), pendingConfirmation };
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
 * Where an emailed auth link should land (#919 recovery, #1197 confirmation).
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
 * Send the confirmation mail again (#1197). The first one expires, and it is
 * the only way back into an account that was created but never verified —
 * without this the user has to guess whether waiting or re-registering is
 * the way out.
 *
 * Resolves with `error: null` for an address that is already confirmed or
 * does not exist, for the same non-disclosure reason as the reset mail.
 */
export async function resendConfirmationEmail(
  email: string,
): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: authRedirectUrl() },
  });
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
