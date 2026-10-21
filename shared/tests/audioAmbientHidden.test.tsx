import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { AudioProvider } from "../src/context/AudioContext";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #2290 item 1 — no ambient playback where the mixer is not shown.
 *
 * The sound settings sync across devices, so "rain on" set at the desk used
 * to start the rain loop on the phone too, where the narrow layout and the
 * native shells draw no mixer to turn it off. One minute of rain streamed
 * 5MB. The host now passes `ambient={false}` there; the loop stays silent and,
 * created with preload "none", downloads nothing.
 */

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

describe("AudioProvider without a mixer on screen (#2290)", () => {
  let play: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    play = vi.fn(function (this: HTMLMediaElement) {
      Object.defineProperty(this, "paused", {
        value: false,
        configurable: true,
      });
      return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(
      play as unknown as () => Promise<void>,
    );
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      Object.defineProperty(this, "paused", {
        value: true,
        configurable: true,
      });
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const ds = stubDataService({
    fetchSoundSettings: async () => [
      { soundType: "rain", volume: 60, enabled: true },
    ],
    updateSoundSetting: async () => undefined,
    getSoundAssetUrl: async (name: string) => `https://cdn.test/${name}`,
  });

  const rainPlays = () =>
    (play.mock.contexts as HTMLMediaElement[]).filter((el) =>
      el.src.includes("rain"),
    ).length;

  it("keeps a synced 'on' preset silent when ambient is false", async () => {
    render(
      <AudioProvider dataService={ds} ambient={false}>
        <div />
      </AudioProvider>,
      { wrapper: syncWrapper },
    );
    await act(async () => {});
    await act(async () => {});
    expect(rainPlays()).toBe(0);
  });

  it("starts the preset once the mixer is on screen again", async () => {
    const { rerender } = render(
      <AudioProvider dataService={ds} ambient={false}>
        <div />
      </AudioProvider>,
      { wrapper: syncWrapper },
    );
    await act(async () => {});
    await act(async () => {});
    rerender(
      <AudioProvider dataService={ds} ambient>
        <div />
      </AudioProvider>,
    );
    await act(async () => {});
    expect(rainPlays()).toBe(1);
  });
});
