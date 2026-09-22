import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { AudioProvider } from "../src/context/AudioContext";
import { useAudioContext } from "../src/hooks/useAudioContext";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import {
  rampVolume,
  TOGGLE_FADE_MS,
  VOLUME_CHANGE_RAMP_MS,
} from "../src/utils/audioVolumeRamp";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #1793 — the ambient mixer must not cut the waveform vertically.
 *
 * The asset measurement (PR #1797) put the hiss itself on the source files,
 * but three edges were the playback path's own doing: pause() wherever the
 * wave happened to be (a click), `el.volume = x` on every slider event (zipper
 * noise), and play() re-issued on an element already playing (a re-buffer on
 * some browsers). Pinned here: volume moves in steps, off fades before it
 * pauses, and a playing element is never told to play again.
 */

describe("rampVolume", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("walks to the target in steps and lands exactly on it", () => {
    const el = { volume: 0 };
    const seen: number[] = [];
    const onDone = vi.fn();
    rampVolume(el, 0.8, 40, onDone);

    for (let i = 0; i < 4; i += 1) {
      vi.advanceTimersByTime(10);
      seen.push(el.volume);
    }
    // Rising, never a single jump, and the last step is the target itself.
    expect(seen[0]).toBeGreaterThan(0);
    expect(seen[0]).toBeLessThan(0.8);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
    expect(el.volume).toBe(0.8);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("a cancelled ramp stops moving and never reports done", () => {
    const el = { volume: 1 };
    const onDone = vi.fn();
    const ramp = rampVolume(el, 0, 100, onDone);
    vi.advanceTimersByTime(30);
    const frozen = el.volume;
    ramp.cancel();
    vi.advanceTimersByTime(500);

    expect(frozen).toBeLessThan(1);
    expect(el.volume).toBe(frozen);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("clamps the target into the range an element accepts", () => {
    const el = { volume: 0.5 };
    rampVolume(el, 4, 0);
    expect(el.volume).toBe(1);
  });
});

function syncWrapper({ children }: { children: ReactNode }) {
  return createElement(
    SyncContext.Provider,
    {
      value: {
        syncVersion: 0,
        domainVersions: uniformDomainVersions(0),
        triggerSync: async () => {},
      },
    },
    children,
  );
}

function Probe() {
  const audio = useAudioContext();
  if (!audio) return null;
  return (
    <div>
      <button onClick={() => audio.toggleEnabled("rain", false)}>off</button>
      <button onClick={() => audio.toggleEnabled("rain", true)}>on</button>
      <button onClick={() => audio.setVolume("rain", 20)}>quiet</button>
    </div>
  );
}

describe("AudioProvider ambient fades", () => {
  let play: ReturnType<typeof vi.fn>;
  let pause: ReturnType<typeof vi.fn>;
  let rain: HTMLMediaElement | null;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    rain = null;
    // jsdom implements neither play() nor pause(), and `paused` never moves.
    // Model just enough of an element for the Provider to tell playing from
    // stopped. `renderOn` picks the rain element out of the play() calls.
    play = vi.fn(function (this: HTMLMediaElement) {
      Object.defineProperty(this, "paused", {
        value: false,
        configurable: true,
      });
      return Promise.resolve();
    });
    pause = vi.fn(function (this: HTMLMediaElement) {
      Object.defineProperty(this, "paused", {
        value: true,
        configurable: true,
      });
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(
      play as unknown as () => Promise<void>,
    );
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(
      pause as unknown as () => void,
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function renderOn() {
    const ds = stubDataService({
      fetchSoundSettings: async () => [
        { soundType: "rain", volume: 60, enabled: true },
      ],
      updateSoundSetting: async () => undefined,
      getSoundAssetUrl: async (name: string) => `https://cdn.test/${name}`,
    });
    render(
      <AudioProvider dataService={ds}>
        <Probe />
      </AudioProvider>,
      { wrapper: syncWrapper },
    );
    await act(async () => {});
    await act(async () => {});
    rain =
      (play.mock.contexts as HTMLMediaElement[]).find((el) =>
        el.src.includes("rain"),
      ) ?? null;
  }

  it("fades in from silence instead of starting at full volume", async () => {
    await renderOn();
    expect(rain).not.toBeNull();
    expect(rain?.volume).toBe(0);

    act(() => {
      vi.advanceTimersByTime(TOGGLE_FADE_MS);
    });
    expect(rain?.volume).toBeCloseTo(0.6);
  });

  it("a volume change on a playing element ramps and never replays it", async () => {
    await renderOn();
    act(() => {
      vi.advanceTimersByTime(TOGGLE_FADE_MS);
    });
    const playsBefore = play.mock.calls.length;

    fireEvent.click(screen.getByText("quiet"));
    // Not there yet: the slider value is approached, not assigned.
    expect(rain?.volume).toBeCloseTo(0.6);
    act(() => {
      vi.advanceTimersByTime(VOLUME_CHANGE_RAMP_MS);
    });
    expect(rain?.volume).toBeCloseTo(0.2);
    expect(play.mock.calls.length).toBe(playsBefore);
  });

  it("switching off fades to silence before it pauses", async () => {
    await renderOn();
    act(() => {
      vi.advanceTimersByTime(TOGGLE_FADE_MS);
    });

    fireEvent.click(screen.getByText("off"));
    expect(pause).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(TOGGLE_FADE_MS);
    });
    expect(rain?.volume).toBe(0);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("switching back on mid-fade cancels the pending pause", async () => {
    await renderOn();
    act(() => {
      vi.advanceTimersByTime(TOGGLE_FADE_MS);
    });

    fireEvent.click(screen.getByText("off"));
    act(() => {
      vi.advanceTimersByTime(TOGGLE_FADE_MS / 2);
    });
    fireEvent.click(screen.getByText("on"));
    act(() => {
      vi.advanceTimersByTime(TOGGLE_FADE_MS * 2);
    });

    expect(pause).not.toHaveBeenCalled();
    expect(rain?.volume).toBeCloseTo(0.6);
  });
});
