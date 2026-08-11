import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { AudioProvider } from "../src/context/AudioContext";
import { useAudioContext } from "../src/hooks/useAudioContext";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import type { DataService } from "../src/services/DataService";

/*
 * AudioProvider — volume is TWO-STAGE (#714, Epic #627).
 *
 * The pins here are the two halves that have to hold at the same time, because
 * either one alone is a regression:
 *
 *   - a drag is LIVE (the exposed settings — hence the element volume — follow
 *     it at once), and
 *   - a drag is NOT a write (updateSoundSetting only fires from saveVolumes),
 *
 * plus the two seams where the halves meet: the on/off switch keeps writing
 * immediately and carries the PERSISTED volume (so flipping it cannot smuggle
 * an unsaved slider into the row), and a drag returned to where it started is
 * no write at all.
 */

const updateSoundSetting = vi.fn(async () => {});

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

function makeDS(): DataService {
  return {
    // One row is enough; the other four fall back to the defaults.
    fetchSoundSettings: async () => [
      { soundType: "rain", volume: 60, enabled: true },
    ],
    getSoundAssetUrl: async (name: string) => `https://example.test/${name}`,
    updateSoundSetting,
  } as unknown as DataService;
}

function Probe() {
  const audio = useAudioContext();
  if (!audio) return null;
  return (
    <div>
      <span data-testid="rain-volume">{audio.settings.rain?.volume}</span>
      <span data-testid="dirty">{String(audio.volumeDirty)}</span>
      <button onClick={() => audio.setVolume("rain", 80)}>drag-80</button>
      <button onClick={() => audio.setVolume("rain", 60)}>drag-60</button>
      <button onClick={() => audio.saveVolumes()}>save</button>
      <button onClick={() => audio.toggleEnabled("rain", false)}>off</button>
    </div>
  );
}

async function renderAudio() {
  render(
    <AudioProvider dataService={makeDS()}>
      <Probe />
    </AudioProvider>,
    { wrapper: syncWrapper },
  );
  // Let the settings fetch + asset URLs land.
  await act(async () => {});
  expect(screen.getByTestId("rain-volume").textContent).toBe("60");
}

const press = (name: string) => fireEvent.click(screen.getByText(name));

beforeAll(() => {
  // jsdom implements neither play() nor pause() and throws a "Not implemented"
  // page error for each call. The Provider drives both (and swallows the
  // rejection by design), so without these stubs every run buries its result
  // under jsdom stack traces.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(
    async () => {},
  );
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

beforeEach(() => {
  // Calls only — clearAllMocks leaves the play/pause implementations above in
  // place (resetAllMocks would not).
  vi.clearAllMocks();
});

describe("AudioProvider — volume save button (#714)", () => {
  it("moves the live mix on a drag without writing", async () => {
    await renderAudio();

    press("drag-80");

    // Live: this is what the looping element's volume is set from.
    expect(screen.getByTestId("rain-volume").textContent).toBe("80");
    expect(screen.getByTestId("dirty").textContent).toBe("true");
    expect(updateSoundSetting).not.toHaveBeenCalled();
  });

  it("writes the pending volume once, on save", async () => {
    await renderAudio();

    press("drag-80");
    press("save");

    expect(updateSoundSetting).toHaveBeenCalledExactlyOnceWith(
      "rain",
      80,
      true,
    );
    expect(screen.getByTestId("dirty").textContent).toBe("false");

    // Saving again writes nothing — the draft is spent.
    press("save");
    expect(updateSoundSetting).toHaveBeenCalledOnce();
  });

  it("treats a slider dragged back to its stored value as no change", async () => {
    await renderAudio();

    press("drag-80");
    press("drag-60");

    expect(screen.getByTestId("dirty").textContent).toBe("false");
    press("save");
    expect(updateSoundSetting).not.toHaveBeenCalled();
  });

  it("keeps the on/off switch immediate, and off the unsaved volume", async () => {
    await renderAudio();

    press("drag-80");
    press("off");

    // The switch is an act: it writes now. And it writes the PERSISTED 60 —
    // an unsaved 80 must not ride along on someone else's gesture.
    expect(updateSoundSetting).toHaveBeenCalledExactlyOnceWith(
      "rain",
      60,
      false,
    );
    // The drag is still pending and still audible.
    expect(screen.getByTestId("rain-volume").textContent).toBe("80");
    expect(screen.getByTestId("dirty").textContent).toBe("true");

    press("save");
    expect(updateSoundSetting).toHaveBeenLastCalledWith("rain", 80, false);
  });
});
