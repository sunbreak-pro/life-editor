import { logServiceError } from "./logError";

/*
 * A looping ambient track that never passes through its own edges (#1793).
 *
 * `el.loop = true` plays the file's last sample and then its first. The five
 * preset files carry 16–109 ms of silence baked into each end, so every lap
 * drops out for 39–139 ms (measured in PR #1797), and with no gapless tag the
 * browser has nothing to trim it by. New assets are meant to fix the files
 * themselves, but a loop point is only as clean as whoever edited it.
 *
 * So the track is two elements of the same file. Shortly before the playing
 * one reaches its end, the other starts from the top and the two cross over
 * on an equal-power curve. The silent tail and the silent head both land at
 * the quiet end of their fade, so neither is heard as a gap.
 *
 * The object answers to the same `volume` / `paused` / `play()` / `pause()`
 * the Provider used on a bare element, which is what lets `rampVolume` drive
 * it unchanged. `volume` is the master level; the crossfade scales it per
 * element underneath.
 *
 * Timers, like `rampVolume`: rAF stops in a hidden tab, and the mixer keeps
 * playing there. If the watch still arrives late, the `ended` fallback swaps
 * straight to the other element, which is no worse than `loop = true` was.
 */

/** Length of the crossover between one lap and the next. */
export const LOOP_CROSSFADE_MS = 1200;
/** How often the playing element's position is checked. */
const WATCH_MS = 50;
/** Interval between crossfade steps. */
const STEP_MS = 10;

/** The subset of HTMLAudioElement the loop drives. */
export type LoopElement = Pick<
  HTMLAudioElement,
  | "src"
  | "volume"
  | "paused"
  | "currentTime"
  | "duration"
  | "preload"
  | "loop"
  | "play"
  | "pause"
  | "addEventListener"
  | "removeEventListener"
>;

export interface AmbientLoop {
  /** Master level 0–1. */
  volume: number;
  /** The URL both elements play. Setting a new one rewinds to the top. */
  src: string;
  readonly paused: boolean;
  play: () => Promise<void>;
  pause: () => void;
  /** Stop everything and release the elements. The loop is unusable after. */
  dispose: () => void;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function createAmbientLoop(
  url: string,
  makeElement: (url: string) => LoopElement = (u) => new Audio(u),
): AmbientLoop {
  const els = [makeElement(url), makeElement(url)];
  for (const el of els) {
    el.loop = false;
    el.preload = "none";
  }
  let src = url;
  let master = 1;
  let active = 0;
  const gains = [1, 0];
  let watchId: ReturnType<typeof setInterval> | null = null;
  let fade: { id: ReturnType<typeof setInterval>; next: number } | null = null;

  const apply = () => {
    els[0].volume = clamp01(master * gains[0]);
    els[1].volume = clamp01(master * gains[1]);
  };

  const playEl = (el: LoopElement) => {
    const p = el.play();
    if (p && typeof p.catch === "function") {
      p.catch((e) => logServiceError("Audio", "play", e));
    }
  };

  // Finish an in-flight crossover at once: the incoming element becomes the
  // only one, at full gain, and the outgoing one goes back to the top.
  const commitFade = () => {
    if (!fade) return;
    clearInterval(fade.id);
    const prev = active;
    active = fade.next;
    fade = null;
    gains[active] = 1;
    gains[prev] = 0;
    if (!els[prev].paused) els[prev].pause();
    els[prev].currentTime = 0;
    apply();
  };

  const startFade = (durationMs: number) => {
    const prev = active;
    const next = 1 - active;
    const incoming = els[next];
    incoming.currentTime = 0;
    gains[next] = 0;
    apply();
    playEl(incoming);
    const steps = Math.max(1, Math.round(durationMs / STEP_MS));
    let step = 0;
    const id = setInterval(() => {
      step += 1;
      if (step >= steps) {
        commitFade();
        return;
      }
      // Equal power: the summed loudness stays level through the crossover.
      const t = step / steps;
      gains[prev] = Math.cos((t * Math.PI) / 2);
      gains[next] = Math.sin((t * Math.PI) / 2);
      apply();
    }, STEP_MS);
    fade = { id, next };
  };

  const watch = () => {
    if (fade) return;
    const el = els[active];
    const d = el.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    // A very short file cannot spend 1.2 s of every lap crossing over.
    const fadeMs = Math.min(LOOP_CROSSFADE_MS, (d * 1000) / 4);
    const remainingMs = (d - el.currentTime) * 1000;
    if (remainingMs <= fadeMs + WATCH_MS) startFade(fadeMs);
  };

  const stopWatch = () => {
    if (watchId != null) clearInterval(watchId);
    watchId = null;
  };

  // The watch was late (or the file is shorter than one check): swap now.
  const onEnded = (index: number) => () => {
    if (index !== active || fade) return;
    const next = 1 - active;
    active = next;
    gains[next] = 1;
    gains[index] = 0;
    els[index].currentTime = 0;
    els[next].currentTime = 0;
    apply();
    playEl(els[next]);
  };
  const endedHandlers = els.map((_, i) => onEnded(i));
  els.forEach((el, i) => el.addEventListener("ended", endedHandlers[i]));

  apply();

  return {
    get volume() {
      return master;
    },
    set volume(v: number) {
      master = clamp01(v);
      apply();
    },
    get src() {
      return src;
    },
    set src(next: string) {
      if (next === src) return;
      commitFade();
      src = next;
      active = 0;
      gains[0] = 1;
      gains[1] = 0;
      for (const el of els) el.src = next;
      apply();
    },
    get paused() {
      return els[active].paused;
    },
    play() {
      if (watchId == null) watchId = setInterval(watch, WATCH_MS);
      const p = els[active].play();
      return p ?? Promise.resolve();
    },
    pause() {
      stopWatch();
      commitFade();
      if (!els[active].paused) els[active].pause();
    },
    dispose() {
      stopWatch();
      if (fade) clearInterval(fade.id);
      fade = null;
      els.forEach((el, i) => {
        el.removeEventListener("ended", endedHandlers[i]);
        if (!el.paused) el.pause();
        el.src = "";
      });
    },
  };
}
