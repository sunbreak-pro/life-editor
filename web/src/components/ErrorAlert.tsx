import type { ReactNode } from "react";

/*
 * Inline error banner shared by the web views (TaskTree, Notes, …). A single
 * notion-token-styled `role="alert"` paragraph — extracted because the exact
 * same markup + class string was repeated at every error/persistError/
 * moveError site. Pass the message as children so callers can compose text +
 * a value (e.g. `Save failed: {err}`).
 */
export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-notion-danger px-3 py-2 text-sm text-notion-danger"
    >
      {children}
    </p>
  );
}
