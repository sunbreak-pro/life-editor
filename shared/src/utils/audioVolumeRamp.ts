/*
 * Move an <audio> element's volume in small steps instead of one jump (#1793).
 *
 * The ambient mixer used to assign `el.volume` outright and call `pause()`
 * wherever the waveform happened to be. Both cut the signal vertically: a
 * pause mid-swing is a click, and a slider dragged quickly is a staircase the
 * ear hears as zipper noise. Walking the volume there over a few tens of
 * milliseconds turns each edge into a slope.
 *
 * The element's own `volume` is ramped rather than a Web Audio GainNode. A
 * gain node needs `createMediaElementSource`, and that silences the element
 * outright unless the asset is served with CORS headers the bucket is not
 * known to send. A wrong guess there mutes every preset, and a worktree cannot
 * listen to find out. Stepping `volume` has no such failure mode.
 *
 * Timers, not requestAnimationFrame: the mixer keeps playing in a hidden tab,
 * where rAF stops altogether and a fade-out would never reach its `pause()`.
 */

/** Interval between volume steps. Short enough that each step is inaudible. */
const STEP_MS = 10;

/** A slider move: long enough to hide the staircase, too short to feel laggy. */
export const VOLUME_CHANGE_RAMP_MS = 40;
/** An on/off switch: a fade the ear reads as a soft edge rather than a click. */
export const TOGGLE_FADE_MS = 150;

export interface VolumeRamp {
  /** Stop where it is. The `onDone` of a cancelled ramp never runs. */
  cancel: () => void;
}

/**
 * Ramp `el.volume` to `target` (0–1) over `durationMs`, then call `onDone`.
 * The caller cancels the previous ramp on the same element before starting
 * another, so two never fight over one volume.
 */
export function rampVolume(
  el: Pick<HTMLMediaElement, "volume">,
  target: number,
  durationMs: number,
  onDone?: () => void,
): VolumeRamp {
  const to = Math.max(0, Math.min(1, target));
  const from = el.volume;
  const steps = Math.max(1, Math.round(durationMs / STEP_MS));
  if (from === to || durationMs <= 0) {
    el.volume = to;
    onDone?.();
    return { cancel: () => {} };
  }
  let step = 0;
  const id = setInterval(() => {
    step += 1;
    if (step >= steps) {
      clearInterval(id);
      el.volume = to;
      onDone?.();
      return;
    }
    el.volume = from + ((to - from) * step) / steps;
  }, STEP_MS);
  return { cancel: () => clearInterval(id) };
}
