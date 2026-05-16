import { useState } from "react";
import { signIn, signUp } from "@life-editor/shared";

/*
 * Phase 1 minimal auth screen (Email + Password).
 * Confirm-email is assumed OFF, so signUp logs the user straight in.
 * Session propagation is handled by the onAuthStateChange listener in App.
 */
export function AuthScreen() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fn = mode === "signIn" ? signIn : signUp;
    const result = await fn(email.trim(), password);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (!result.session) {
      setError(
        "No session returned. Confirm-email may be enabled — disable it for Phase 1.",
      );
    }
    // Success: the App's auth listener swaps to the tasks view.
  };

  return (
    <div className="min-h-screen bg-notion-bg text-notion-text flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-md border border-notion-border bg-notion-bg-secondary p-6"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-notion-text">
            Life Editor — Web
          </h1>
          <p className="text-sm text-notion-text-secondary">
            {mode === "signIn"
              ? "Sign in to your account"
              : "Create a new account"}
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-notion-text-secondary">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-notion-border bg-notion-bg px-3 py-2 text-notion-text outline-none focus:border-notion-accent"
            />
          </label>
          <label className="block text-sm text-notion-text-secondary">
            Password
            <input
              type="password"
              required
              minLength={6}
              autoComplete={
                mode === "signIn" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-notion-border bg-notion-bg px-3 py-2 text-notion-text outline-none focus:border-notion-accent"
            />
          </label>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-notion-danger px-3 py-2 text-sm text-notion-danger"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-notion-accent px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Working…" : mode === "signIn" ? "Sign in" : "Sign up"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signIn" ? "signUp" : "signIn");
            setError(null);
          }}
          className="w-full text-sm text-notion-text-secondary hover:text-notion-accent"
        >
          {mode === "signIn"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
