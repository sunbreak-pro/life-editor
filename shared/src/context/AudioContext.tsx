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
import { useSyncContext } from "../hooks/useSyncContext";
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
 * Shared AudioProvider (W3-C). Pattern A (CLAUDE.md §6.3) + OPTIONAL variant
 * (Audio is a §2 Mobile 省略 Provider — mounted on web/desktop only). The host
 * injects the DataService (§6.4 — the Provider, being a host-side context, MAY
 * use the injected ds). Per §6.2 it nests INSIDE TimerProvider (… → Timer →
 * Audio → …); it reads useSyncContext so a cross-tab volume/enable edit
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

export function AudioProvider({ children, dataService: ds }: AudioProviderProps) {
  const { syncVersion } = useSyncContext();

  const [settings, setSettings] = useState<Record<string, AudioPresetState>>(
    buildDefaultSettings,
  );
  const [urls, setUrls] = useState<Record<string, string>>({});

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
        setSettings(
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
        ? window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
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

  const setVolume = useCallback(
    (id: string, volume: number) => {
      const v = clampSoundVolume(volume);
      resumeAudio();
      setSettings((prev) => {
        const cur = prev[id] ?? {
          volume: DEFAULT_SOUND_VOLUME,
          enabled: DEFAULT_SOUND_ENABLED,
        };
        const next = { ...prev, [id]: { ...cur, volume: v } };
        persist(id, v, cur.enabled);
        return next;
      });
    },
    [persist, resumeAudio],
  );

  const toggleEnabled = useCallback(
    (id: string, enabled: boolean) => {
      resumeAudio();
      setSettings((prev) => {
        const cur = prev[id] ?? {
          volume: DEFAULT_SOUND_VOLUME,
          enabled: DEFAULT_SOUND_ENABLED,
        };
        const next = { ...prev, [id]: { ...cur, enabled } };
        persist(id, cur.volume, enabled);
        return next;
      });
    },
    [persist, resumeAudio],
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
      toggleEnabled,
      playCompletionChime,
      resumeAudio,
    }),
    [settings, urls, setVolume, toggleEnabled, playCompletionChime, resumeAudio],
  );

  return (
    <AudioReactContext.Provider value={value}>
      {children}
    </AudioReactContext.Provider>
  );
}
