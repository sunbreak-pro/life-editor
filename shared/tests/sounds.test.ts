import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SOUND_PRESETS,
  COMPLETION_SOUND_OBJECT,
  DEFAULT_SOUND_VOLUME,
  DEFAULT_SOUND_ENABLED,
  clampSoundVolume,
  mergeSoundSettings,
} from "../src/constants/sounds";
import { SupabaseAudioService } from "../src/services/SupabaseAudioService";

/*
 * W3-C pure-logic coverage. jsdom can't exercise HTMLAudioElement.play /
 * AudioContext, so the Provider's playback is left to manual/QA; here we lock
 * down the deterministic pieces: the 5-preset shape, the settings merge, the
 * volume clamp, and the Storage URL construction.
 */

describe("SOUND_PRESETS", () => {
  it("defines exactly the 5 scoped presets (no thunder)", () => {
    expect(SOUND_PRESETS.map((p) => p.id)).toEqual([
      "rain",
      "wind",
      "ocean",
      "birds",
      "fire",
    ]);
  });

  it("derives objectName as <id>.mp3 and a distinct labelKey per preset", () => {
    for (const p of SOUND_PRESETS) {
      expect(p.objectName).toBe(`${p.id}.mp3`);
      expect(p.labelKey).toBe(`audioMixer.sound.${p.id}`);
    }
  });

  it("uses complete.mp3 for the completion chime", () => {
    expect(COMPLETION_SOUND_OBJECT).toBe("complete.mp3");
  });
});

describe("clampSoundVolume", () => {
  it("clamps below 0 and above 100", () => {
    expect(clampSoundVolume(-5)).toBe(0);
    expect(clampSoundVolume(150)).toBe(100);
  });

  it("rounds to an integer and passes through in-range values", () => {
    expect(clampSoundVolume(42.6)).toBe(43);
    expect(clampSoundVolume(50)).toBe(50);
  });

  it("falls back to the default for NaN", () => {
    expect(clampSoundVolume(Number.NaN)).toBe(DEFAULT_SOUND_VOLUME);
  });
});

describe("mergeSoundSettings", () => {
  it("returns exactly the 5 preset ids regardless of input", () => {
    const merged = mergeSoundSettings([]);
    expect(Object.keys(merged).sort()).toEqual(
      ["birds", "fire", "ocean", "rain", "wind"].sort(),
    );
  });

  it("applies defaults for presets with no persisted row", () => {
    const merged = mergeSoundSettings([
      { soundType: "rain", volume: 80, enabled: true },
    ]);
    expect(merged.rain).toEqual({ volume: 80, enabled: true });
    expect(merged.wind).toEqual({
      volume: DEFAULT_SOUND_VOLUME,
      enabled: DEFAULT_SOUND_ENABLED,
    });
  });

  it("clamps persisted volumes and ignores unknown sound types", () => {
    const merged = mergeSoundSettings([
      { soundType: "ocean", volume: 999, enabled: true },
      { soundType: "thunder", volume: 50, enabled: true },
    ]);
    expect(merged.ocean.volume).toBe(100);
    // thunder is out of scope — it must not appear in the merged map.
    expect("thunder" in merged).toBe(false);
  });
});

describe("SupabaseAudioService.getSoundAssetUrl", () => {
  it("builds the public URL from the `sounds` bucket for the given object", async () => {
    let bucketArg: string | undefined;
    let pathArg: string | undefined;
    const client = {
      storage: {
        from(bucket: string) {
          bucketArg = bucket;
          return {
            getPublicUrl(path: string) {
              pathArg = path;
              return {
                data: { publicUrl: `https://x.supabase.co/${bucket}/${path}` },
              };
            },
          };
        },
      },
    } as unknown as SupabaseClient;

    const svc = new SupabaseAudioService(client);
    const url = await svc.getSoundAssetUrl("rain.mp3");

    expect(bucketArg).toBe("sounds");
    expect(pathArg).toBe("rain.mp3");
    expect(url).toBe("https://x.supabase.co/sounds/rain.mp3");
  });
});
