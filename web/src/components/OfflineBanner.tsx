import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

/*
 * Global offline warning banner (S7, migration SSOT §"オフライン":
 * "機内モード/圏外では「オンライン時にご利用ください」グローバルバナー表示").
 *
 * The web build is online-only (no Service Worker / no offline editing),
 * so when the browser drops connectivity we surface a full-width warning
 * rather than letting Supabase calls fail silently.
 *
 * Rendering:
 *   - Returns null while online (no layout cost in the common case).
 *   - Opaque `notion-bg-secondary` surface with a `notion-danger` bottom
 *     border + danger-colored text (CLAUDE.md §6.4 — no transparency on
 *     primary UI containers; tokens only, no hardcoded colors). This
 *     mirrors the existing error treatment in AuthScreen / TaskTreeView
 *     (border + text-notion-danger) rather than introducing an undefined
 *     on-danger foreground token.
 *
 * Accessibility:
 *   - role="status" + aria-live="polite" so screen readers announce the
 *     state change without stealing focus (it is informational, not an
 *     interrupting alert).
 *   - The icon is decorative (aria-hidden); the text carries the meaning.
 */
export function OfflineBanner(): React.JSX.Element | null {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full items-center justify-center gap-2 border-b border-notion-danger bg-notion-bg-secondary px-4 py-2 text-center text-sm font-medium text-notion-danger"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        オフラインです。オンライン時にご利用ください（You are offline）
      </span>
    </div>
  );
}
