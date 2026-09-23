import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createAmbientLoop,
  LOOP_CROSSFADE_MS,
  type LoopElement,
} from "../src/utils/ambientLoop";

/*
 * #1793 — the ambient loop crosses over between laps instead of passing
 * through the file's edges. The preset files carry silence at both ends, so
 * `loop = true` dropped out for 39–139 ms every lap (PR #1797). Pinned here:
 * the second element starts before the first ends, the crossover is level,
 * the master volume scales both, and a late watch still keeps the sound going.
 */

interface FakeEl extends LoopElement {
  fire: (type: string) => void;
}

function fakeElement(url: string, duration: number): FakeEl {
  const listeners = new Map<string, Set<() => void>>();
  const el = {
    src: url,
    volume: 1,
    paused: true,
    currentTime: 0,
    duration,
    preload: "auto",
    loop: true,
    play: vi.fn(async () => {
      el.paused = false;
    }),
    pause: vi.fn(() => {
      el.paused = true;
    }),
    addEventListener: (type: string, fn: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(fn);
    },
    removeEventListener: (type: string, fn: () => void) => {
      listeners.get(type)?.delete(fn);
    },
    fire: (type: string) => {
      listeners.get(type)?.forEach((fn) => fn());
    },
  };
  return el as unknown as FakeEl;
}

function setup(durationS = 30) {
  const els: FakeEl[] = [];
  const loop = createAmbientLoop("https://cdn.test/rain.mp3", (u) => {
    const el = fakeElement(u, durationS);
    els.push(el);
    return el;
  });
  return { loop, a: els[0], b: els[1] };
}

describe("createAmbientLoop", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("turns off the element's own loop and preloads nothing", () => {
    const { a, b } = setup();
    for (const el of [a, b]) {
      expect(el.loop).toBe(false);
      expect(el.preload).toBe("none");
    }
  });

  it("plays one element and keeps the other silent until the lap ends", async () => {
    const { loop, a, b } = setup();
    loop.volume = 0.6;
    await loop.play();
    vi.advanceTimersByTime(1000);

    expect(loop.paused).toBe(false);
    expect(a.volume).toBeCloseTo(0.6);
    expect(b.play).not.toHaveBeenCalled();
    expect(b.volume).toBe(0);
  });

  it("starts the second element from the top before the first reaches its end", async () => {
    const { loop, a, b } = setup(30);
    await loop.play();
    a.currentTime = 30 - LOOP_CROSSFADE_MS / 1000 - 0.01;
    vi.advanceTimersByTime(50);

    expect(b.play).toHaveBeenCalledTimes(1);
    expect(b.currentTime).toBe(0);
    // The first is still sounding: this is a crossover, not a cut.
    expect(a.pause).not.toHaveBeenCalled();
  });

  it("keeps the summed power level through the crossover and hands over at the end", async () => {
    const { loop, a, b } = setup(30);
    await loop.play();
    a.currentTime = 30 - LOOP_CROSSFADE_MS / 1000;
    vi.advanceTimersByTime(50);

    vi.advanceTimersByTime(LOOP_CROSSFADE_MS / 2);
    expect(a.volume).toBeGreaterThan(0);
    expect(b.volume).toBeGreaterThan(0);
    expect(a.volume ** 2 + b.volume ** 2).toBeCloseTo(1, 1);

    vi.advanceTimersByTime(LOOP_CROSSFADE_MS);
    expect(a.pause).toHaveBeenCalledTimes(1);
    expect(a.currentTime).toBe(0);
    expect(a.volume).toBe(0);
    expect(b.volume).toBe(1);
    expect(loop.paused).toBe(false);
  });

  it("scales both elements by the master volume", async () => {
    const { loop, a, b } = setup(30);
    await loop.play();
    a.currentTime = 30 - LOOP_CROSSFADE_MS / 1000;
    vi.advanceTimersByTime(50 + LOOP_CROSSFADE_MS / 2);
    const [ga, gb] = [a.volume, b.volume];

    loop.volume = 0.5;
    expect(a.volume).toBeCloseTo(ga * 0.5);
    expect(b.volume).toBeCloseTo(gb * 0.5);
  });

  it("pausing mid-crossover leaves one element, rewound and ready", async () => {
    const { loop, a, b } = setup(30);
    await loop.play();
    a.currentTime = 30 - LOOP_CROSSFADE_MS / 1000;
    vi.advanceTimersByTime(50 + LOOP_CROSSFADE_MS / 2);

    loop.pause();
    expect(a.paused).toBe(true);
    expect(b.paused).toBe(true);
    expect(loop.paused).toBe(true);

    // Resuming plays the element that was coming in, at full gain.
    await loop.play();
    expect(b.play).toHaveBeenCalledTimes(2);
    expect(b.volume).toBe(1);
    expect(a.volume).toBe(0);
  });

  it("swaps straight over when the watch is late and the lap ends", async () => {
    const { loop, a, b } = setup(Number.NaN);
    await loop.play();
    a.fire("ended");

    expect(b.play).toHaveBeenCalledTimes(1);
    expect(b.volume).toBe(1);
    expect(loop.paused).toBe(false);
  });

  it("shortens the crossover for a file too short to spend it on every lap", async () => {
    const { loop, a, b } = setup(2);
    await loop.play();
    // 2 s file: the crossover is capped at a quarter of it (500 ms).
    a.currentTime = 1.2;
    vi.advanceTimersByTime(50);
    expect(b.play).not.toHaveBeenCalled();
    a.currentTime = 1.5;
    vi.advanceTimersByTime(50);
    expect(b.play).toHaveBeenCalledTimes(1);
  });

  it("dispose stops both elements and stops watching", async () => {
    const { loop, a, b } = setup(30);
    await loop.play();
    loop.dispose();
    expect(a.src).toBe("");
    expect(b.src).toBe("");
    a.currentTime = 29.9;
    vi.advanceTimersByTime(500);
    expect(b.play).not.toHaveBeenCalled();
  });
});
