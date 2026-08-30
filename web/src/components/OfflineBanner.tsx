import { WifiOff } from "lucide-react";
import { NoticePanel } from "@life-editor/shared";
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
 *   - <NoticePanel variant="banner"> (#1184) — the shared band, so this
 *     strip and the inline notices elsewhere stop being three different
 *     paddings for the same job. Tone is `warning` rather than `danger`:
 *     nothing has failed, the app is telling you what it cannot do right
 *     now, and `danger` is what an actual error uses one screen over.
 *     The panel keeps the opaque §5 surface (each tone's `-subtle` face
 *     is a pre-mixed flat color, never an alpha overlay).
 *
 * Accessibility:
 *   - role="status" + aria-live="polite", passed explicitly to override
 *     the tone default: a warning normally interrupts, but connectivity
 *     is ambient state rather than the answer to something the user just
 *     did, so it should be announced without stealing focus.
 *   - WifiOff replaces the tone's own glyph; it is decorative
 *     (aria-hidden), the text carries the meaning.
 */
export function OfflineBanner(): React.JSX.Element | null {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <NoticePanel
      variant="banner"
      tone="warning"
      role="status"
      icon={<WifiOff aria-hidden />}
      message="オフラインです。オンライン時にご利用ください（You are offline）"
      className="font-medium"
    />
  );
}
