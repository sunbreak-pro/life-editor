import { signOut } from "@life-editor/shared";

/*
 * What every sign-out button calls (#2334). A refused sign-out leaves the session
 * in place, and someone on a shared device must not walk away believing it ended.
 * MainScreen, which owns the sidebar's button, sits above the ToastProvider, so
 * the notice is shown by SignOutFailureNotice from inside the Provider chain.
 */
const listeners = new Set<() => void>();

export function subscribeSignOutFailure(onFailure: () => void): () => void {
  listeners.add(onFailure);
  return () => listeners.delete(onFailure);
}

export function signOutWithNotice(): void {
  void signOut()
    .then(({ error }) => error !== null)
    .catch(() => true)
    .then((failed) => {
      if (failed) for (const listener of listeners) listener();
    });
}
