import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { useSyncDomains } from "../hooks/useSyncDomains";
import {
  SOUND_PRESETS,
  COMPLETION_SOUND_OBJECT,
  DEFAULT_SOUND_VOLUME,
  DEFAULT_SOUND_ENABLED,
  clampSoundVolume,
  mergeSoundSettings,
} from "../constants/sounds";
import {
  AudioContext as AudioReactContext,
  type AudioContextValue,
  type AudioPresetState,
} from "./AudioContextValue";

/*
 * Shared AudioProvider (W3-C). Pattern A (CLAUDE.md §6.3) + OPTIONAL variant.
 *
 * NOT a §2 Mobile 省略 Provider — this Provider IS mounted on native mobile.
 * The completion chime is part of the work timer, which mobile-scope.md #10/#11
 * lists as Full on mobile, so tearing the Provider down would take the chime
 * with it. What native mobile omits is the Ambient mixer UI only, and that is
 * done in `web/src/work/WorkScreen.tsx`, not here (#670 C3 PR 4 — the old
 * comment said "mounted on web/desktop only", which is simply not what the
 * code does). The OPTIONAL hook variant stays because the Provider is still
 * absent in tests and in hosts that mount a partial chain. The host
 * injects the DataService (§6.4 — the Provider, being a host-side context, MAY
 * use the injected ds). Per §6.2 it nests OUTSIDE TimerProvider (… → Audio →
 * Timer → …) since #676 (c): the Timer's onSessionComplete rings the
 * completion chime this Provider owns, so the dependency runs inward like
 * every other pair. It reads useSyncContext so a cross-tab volume/enable edit
 * triggers a refetch.
 *
 * Audio model: each of the 5 ambient presets owns a looping HTMLAudioElement
 * whose `src` is resolved once from ds.getSoundAssetUrl (Supabase Storage
 * public URL). enabled → play()/pause(); volume (0–100) → element.volume v/100.
 * A separate one-shot element plays the completion chime.
 *
 * Autoplay policy (CLAUDE.md §3.3): the browser blocks audio until a user
 * gesture. We resume the (suspended) AudioContext on the first toggle/slider/
 * chime, and swallow play() rejections (log only) so a blocked autoplay never
 * throws into React.
 *
 * Self-echo avoidance (TimerProvider parity): our own writes update local
 * state optimistically; we do NOT feed the write's return value back into the
 * fetch path. The syncVersion-keyed refetch is the only re-pull trigger, and a
 * self-originated Realtime bump just re-reads the same values we already hold.
 *
 * VOLUME IS TWO-STAGE (#714, Epic #627 — the D-20260810-sched-1 save-button
 * model). The slider used to write a sound_settings row per drag, so every
 * value it passed through on the way to the wanted one was stored. It cannot
 * simply move to "commit on the button" either: a mixer that goes silent about
 * a drag until the user saves cannot be mixed by ear. So the two halves split:
 *
 *   - `volumeDrafts` holds the moved sliders. It is laid OVER `persisted` to
 *     make the exposed `settings`, which is what the elements play — so the
 *     drag is audible the moment it happens.
 *   - `saveVolumes()` is the only thing that calls updateSoundSetting for a
 *     volume. One write per row that actually moved.
 *
 * Keeping the drafts in their own map (rather than mutating `persisted`) is
 * also what lets the syncVersion refetch land: a remote change reaches every
 * row the user is NOT holding, and the held ones stay where the user put them.
 */
export interface AudioProviderProps {
  children: ReactNode;
  dataService: DataService;
}

function buildDefaultSettings(): Record<string, AudioPresetState> {
  const out: Record<string, AudioPresetState> = {};
  for (const preset of SOUND_PRESETS) {
    out[preset.id] = {
      volume: DEFAULT_SOUND_VOLUME,
      enabled: DEFAULT_SOUND_ENABLED,
    };
  }
  return out;
}

export function AudioProvider({
  children,
  dataService: ds,
}: AudioProviderProps) {
  const syncVersion = useSyncDomains("audio");

  // What the sound_settings rows say (fetch + our own writes).
  const [persisted, setPersisted] =
    useState<Record<string, AudioPresetState>>(buildDefaultSettings);
  // Slider positions moved but not yet written, keyed by preset id (#714).
  const [volumeDrafts, setVolumeDrafts] = useState<Record<string, number>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});

  // The live mix: persisted rows with the pending sliders laid over them. This
  // is what plays and what the mixer renders, so a drag is audible at once.
  const settings = useMemo(() => {
    const ids = Object.keys(volumeDrafts);
    if (ids.length === 0) return persisted;
    const merged: Record<string, AudioPresetState> = { ...persisted };
    for (const id of ids) {
      const cur = merged[id] ?? {
        volume: DEFAULT_SOUND_VOLUME,
        enabled: DEFAULT_SOUND_ENABLED,
      };
      merged[id] = { ...cur, volume: volumeDrafts[id] };
    }
    return merged;
  }, [persisted, volumeDrafts]);

  const volumeDirty = useMemo(
    () =>
      Object.keys(volumeDrafts).some(
        (id) =>
          volumeDrafts[id] !== (persisted[id]?.volume ?? DEFAULT_SOUND_VOLUME),
      ),
    [persisted, volumeDrafts],
  );

  // Looping element per preset id; one-shot chime element kept separately.
  const elementsRef = useRef<Record<string, HTMLAudioElement>>({});
  const chimeRef = useRef<HTMLAudioElement | null>(null);
  // The Web Audio context whose resume() unblocks autoplay after a gesture.
  const audioCtxRef = useRef<AudioContext | null>(null);

  // --- resolve asset URLs once (mount) ---
  useEffect(() => {
    let cancelled = false;
    const objects = SOUND_PRESETS.map((p) => p.objectName);
    Promise.all(objects.map((name) => ds.getSoundAssetUrl(name)))
      .then((resolved) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        SOUND_PRESETS.forEach((p, i) => {
          next[p.id] = resolved[i];
        });
        setUrls(next);
      })
      .catch((e) => logServiceError("Audio", "getSoundAssetUrl", e));

    void ds
      .getSoundAssetUrl(COMPLETION_SOUND_OBJECT)
      .then((url) => {
        if (cancelled) return;
        const el = new Audio(url);
        el.loop = false;
        el.preload = "auto";
        chimeRef.current = el;
      })
      .catch((e) => logServiceError("Audio", "getChimeUrl", e));

    return () => {
      cancelled = true;
      chimeRef.current = null;
    };
  }, [ds]);

  // --- load persisted settings (refetch on sync bump) ---
  useEffect(() => {
    let cancelled = false;
    void ds
      .fetchSoundSettings()
      .then((rows) => {
        if (cancelled) return;
        setPersisted(
          mergeSoundSettings(
            rows.map((r) => ({
              soundType: r.soundType,
              volume: r.volume,
              enabled: r.enabled,
            })),
          ),
        );
      })
      .catch((e) => logServiceError("Audio", "fetchSoundSettings", e));
    return () => {
      cancelled = true;
    };
  }, [ds, syncVersion]);

  // --- (re)build looping elements when a URL resolves ---
  useEffect(() => {
    const elements = elementsRef.current;
    for (const preset of SOUND_PRESETS) {
      const url = urls[preset.id];
      if (!url) continue;
      const existing = elements[preset.id];
      if (existing) {
        if (existing.src !== url) existing.src = url;
        continue;
      }
      const el = new Audio(url);
      el.loop = true;
      el.preload = "none";
      elements[preset.id] = el;
    }
  }, [urls]);

  // --- reflect settings onto the live elements (volume + play/pause) ---
  useEffect(() => {
    const elements = elementsRef.current;
    for (const preset of SOUND_PRESETS) {
      const el = elements[preset.id];
      if (!el) continue;
      const state = settings[preset.id];
      if (!state) continue;
      el.volume = clampSoundVolume(state.volume) / 100;
      if (state.enabled) {
        const playPromise = el.play();
        // Autoplay policy: a blocked play() rejects — log, never throw.
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch((e) => logServiceError("Audio", "play", e));
        }
      } else if (!el.paused) {
        el.pause();
      }
    }
  }, [settings, urls]);

  // --- pause + drop every element on unmount (no leaked playback) ---
  useEffect(() => {
    const elements = elementsRef.current;
    return () => {
      for (const id of Object.keys(elements)) {
        const el = elements[id];
        el.pause();
        el.src = "";
      }
      elementsRef.current = {};
      // The completion chime is one-shot, but a mid-playback unmount would
      // otherwise leak its audio — stop it here too (single source of truth).
      const chime = chimeRef.current;
      if (chime) {
        chime.pause();
        chime.src = "";
      }
      chimeRef.current = null;
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state !== "closed") void ctx.close();
      audioCtxRef.current = null;
    };
  }, []);

  // --- AudioContext resume (autoplay unblock) ---
  const resumeAudio = useCallback(() => {
    // Lazily create the context on the first gesture (constructing it earlier
    // would just leave a suspended context around for Mobile-absent hosts).
    const Ctor =
      typeof window !== "undefined"
        ? (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext)
        : undefined;
    if (!Ctor) return;
    let ctx = audioCtxRef.current;
    if (!ctx) {
      ctx = new Ctor();
      audioCtxRef.current = ctx;
    }
    if (ctx.state === "suspended") {
      void ctx.resume().catch((e) => logServiceError("Audio", "resume", e));
    }
  }, []);

  // --- persist helpers (optimistic local + write-through) ---
  const persist = useCallback(
    (id: string, volume: number, enabled: boolean) => {
      void ds
        .updateSoundSetting(id, volume, enabled)
        .catch((e) => logServiceError("Audio", "updateSoundSetting", e));
    },
    [ds],
  );

  // Audible now, written by saveVolumes (#714). resumeAudio here as well as on
  // the toggle: reaching for a slider is a user gesture too, and on a row that
  // is already ON it may be the FIRST one — the autoplay policy would still be
  // holding the context suspended.
  const setVolume = useCallback(
    (id: string, volume: number) => {
      const v = clampSoundVolume(volume);
      resumeAudio();
      setVolumeDrafts((prev) => (prev[id] === v ? prev : { ...prev, [id]: v }));
    },
    [resumeAudio],
  );

  const saveVolumes = useCallback(() => {
    const ids = Object.keys(volumeDrafts);
    if (ids.length === 0) return;
    // Read from the render's own state rather than a setState updater: an
    // updater must stay pure, and persist() is a write.
    const next = { ...persisted };
    for (const id of ids) {
      const cur = next[id] ?? {
        volume: DEFAULT_SOUND_VOLUME,
        enabled: DEFAULT_SOUND_ENABLED,
      };
      const v = volumeDrafts[id];
      // A slider dragged back to where it started is not a write.
      if (cur.volume === v) continue;
      next[id] = { ...cur, volume: v };
      persist(id, v, cur.enabled);
    }
    setPersisted(next);
    setVolumeDrafts({});
  }, [persist, persisted, volumeDrafts]);

  const toggleEnabled = useCallback(
    (id: string, enabled: boolean) => {
      resumeAudio();
      const cur = persisted[id] ?? {
        volume: DEFAULT_SOUND_VOLUME,
        enabled: DEFAULT_SOUND_ENABLED,
      };
      setPersisted({ ...persisted, [id]: { ...cur, enabled } });
      // cur.volume, not the pending slider: the switch writes its own field
      // and leaves an unsaved volume unsaved.
      persist(id, cur.volume, enabled);
    },
    [persist, persisted, resumeAudio],
  );

  const playCompletionChime = useCallback(() => {
    resumeAudio();
    const el = chimeRef.current;
    if (!el) return;
    el.currentTime = 0;
    const playPromise = el.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((e) => logServiceError("Audio", "chime", e));
    }
  }, [resumeAudio]);

  const value = useMemo<AudioContextValue>(
    () => ({
      settings,
      urls,
      setVolume,
      volumeDirty,
      saveVolumes,
      toggleEnabled,
      playCompletionChime,
      resumeAudio,
    }),
    [
      settings,
      urls,
      setVolume,
      volumeDirty,
      saveVolumes,
      toggleEnabled,
      playCompletionChime,
      resumeAudio,
    ],
  );

  return (
    <AudioReactContext.Provider value={value}>
      {children}
    </AudioReactContext.Provider>
  );
}
