import { useEffect, type MutableRefObject } from "react";
import { useAudioContext } from "../hooks/useAudioContext";

/*
 * Headless completion-chime bridge (W3-C). Solves the Provider-ordering gap:
 * TimerProvider sits OUTSIDE AudioProvider (§6.2 … → Timer → Audio → …), so
 * the Timer's `onSessionComplete` host hook can't read useAudioContext
 * directly. The host creates a ref, passes `() => ref.current?.()` to the
 * Timer, and mounts this bridge INSIDE the AudioProvider; the bridge publishes
 * the live `playCompletionChime` into the ref while mounted and clears it on
 * unmount. Renders nothing.
 *
 * Uses the OPTIONAL audio hook so the bridge is harmless if accidentally
 * mounted outside a Provider (e.g. Mobile) — it simply parks null in the ref.
 */
export interface AudioChimeBridgeProps {
  targetRef: MutableRefObject<(() => void) | null>;
}

export function AudioChimeBridge({
  targetRef,
}: AudioChimeBridgeProps): null {
  const audio = useAudioContext();
  const play = audio?.playCompletionChime ?? null;

  useEffect(() => {
    targetRef.current = play;
    return () => {
      // Only clear if no later effect has already re-published a newer fn —
      // avoids a tiny window where a re-run's setup races this cleanup and
      // leaves the ref null (Timer would then no-op).
      if (targetRef.current === play) targetRef.current = null;
    };
  }, [targetRef, play]);

  return null;
}
