import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import type { DataService } from "@life-editor/shared";

/*
 * The completion chime reaches the Timer without a back-channel (#676 (c)).
 *
 * Audio used to sit INSIDE Timer, so `onSessionComplete` could not read
 * useAudioContext: the host kept a `chimeRef`, gave the Timer
 * `() => chimeRef.current?.()`, and mounted a headless AudioChimeBridge inside
 * the Audio Provider to publish the live `playCompletionChime` into that ref.
 * Swapping the two Providers made the dependency run inward like every other
 * pair, and TimerHost now hands the chime over directly.
 *
 * What is worth pinning down is exactly that hand-off, because it is silent
 * when it breaks: a Timer mounted with no `onSessionComplete` still counts
 * down, still logs sessions and still advances phases — it just stops making a
 * sound, which no other test would notice. So TimerProvider and the audio hook
 * are both stubbed and the assertion is on the wiring between them.
 *
 * The real Providers are deliberately NOT used: TimerProvider needs a Sync
 * Provider and a DataService above it, and AudioProvider builds HTMLAudioElements
 * against Supabase Storage URLs — neither says anything about which one wraps
 * which.
 */

const stub = vi.hoisted(() => ({
  playCompletionChime: vi.fn(),
  /** What TimerHost passed as `onSessionComplete`, captured at render. */
  received: undefined as ((...args: unknown[]) => void) | undefined,
  /** Null when the test wants TimerHost mounted with no Audio Provider. */
  audio: true,
}));

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAudioContext: () =>
    stub.audio ? { playCompletionChime: stub.playCompletionChime } : null,
  TimerProvider: ({
    children,
    onSessionComplete,
  }: {
    children: ReactNode;
    onSessionComplete?: (...args: unknown[]) => void;
  }) => {
    stub.received = onSessionComplete;
    return <>{children}</>;
  },
}));

const { TimerHost } = await import("../src/TimerHost");

/*
 * Read through an annotated accessor rather than touching `stub.received`
 * directly: assigning `undefined` to the field narrows its type to `undefined`
 * for the rest of the block (TS cannot see that the render below rewrote it),
 * and the call two lines later would then be a type error.
 */
const takeReceived = (): ((...args: unknown[]) => void) | undefined =>
  stub.received;

const ds = {} as DataService;

describe("TimerHost", () => {
  it("hands the live completion chime to the Timer", () => {
    stub.audio = true;
    stub.received = undefined;
    stub.playCompletionChime.mockClear();

    render(
      <TimerHost dataService={ds}>
        <div />
      </TimerHost>,
    );

    const received = takeReceived();
    expect(received).toBeTypeOf("function");
    // Firing it must reach the Audio Provider's chime, not a parked ref.
    received?.("work");
    expect(stub.playCompletionChime).toHaveBeenCalledTimes(1);
  });

  it("still mounts the Timer when no Audio Provider is above it", () => {
    // useAudioContext is the OPTIONAL variant (coding-principles §4): a host
    // that omits AudioProvider must lose the sound, not the timer.
    stub.audio = false;
    stub.received = () => {};

    expect(() =>
      render(
        <TimerHost dataService={ds}>
          <div />
        </TimerHost>,
      ),
    ).not.toThrow();
    expect(takeReceived()).toBeUndefined();
  });
});
