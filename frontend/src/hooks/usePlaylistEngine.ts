import { useState, useRef, useCallback, useEffect } from "react";
import type { PlaylistItem } from "../types/playlist";
import type { RepeatMode } from "../types/playlist";

export interface PlaylistEngineResult {
  currentTrackIndex: number;
  currentTime: number;
  duration: number;
  volume: number;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  next: () => void;
  prev: () => void;
  jumpToTrack: (index: number) => void;
  setVolume: (v: number) => void;
}

const FADE_DURATION = 0.3;
const POSITION_INTERVAL = 250;

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function usePlaylistEngine(
  tracks: PlaylistItem[],
  soundSources: Record<string, string>,
  shouldPlay: boolean,
  repeatMode: RepeatMode,
  isShuffle: boolean,
): PlaylistEngineResult {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(80);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playOrderRef = useRef<number[]>([]);
  const trackIndexRef = useRef(0);
  const repeatModeRef = useRef(repeatMode);
  const isShuffleRef = useRef(isShuffle);
  const shouldPlayRef = useRef(shouldPlay);
  const volumeRef = useRef(volume);
  const tracksRef = useRef(tracks);
  const soundSourcesRef = useRef(soundSources);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
    isShuffleRef.current = isShuffle;
    shouldPlayRef.current = shouldPlay;
    volumeRef.current = volume;
    tracksRef.current = tracks;
    soundSourcesRef.current = soundSources;
  }, [repeatMode, isShuffle, shouldPlay, volume, tracks, soundSources]);

  // Compute play order
  useEffect(() => {
    const indices = tracks.map((_, i) => i);
    playOrderRef.current = isShuffle ? shuffleArray(indices) : indices;
  }, [tracks, isShuffle]);

  // Initialize audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.loop = false;
    audioRef.current = audio;

    const ctx = new AudioContext();
    ctxRef.current = ctx;

    const source = ctx.createMediaElementSource(audio);
    sourceNodeRef.current = source;

    const gain = ctx.createGain();
    gain.gain.value = volume / 100;
    gainRef.current = gain;

    source.connect(gain);
    gain.connect(ctx.destination);

    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      audio.pause();
      audio.src = "";
      ctx.close();
      audioRef.current = null;
      ctxRef.current = null;
      gainRef.current = null;
      sourceNodeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resume AudioContext on user gesture
  useEffect(() => {
    const resume = () => {
      if (ctxRef.current?.state === "suspended") {
        ctxRef.current.resume();
      }
    };
    document.addEventListener("click", resume);
    document.addEventListener("keydown", resume);
    return () => {
      document.removeEventListener("click", resume);
      document.removeEventListener("keydown", resume);
    };
  }, []);

  const findNextPlayableIndex = useCallback(
    (fromOrderIndex: number, direction: 1 | -1): number | null => {
      const order = playOrderRef.current;
      if (order.length === 0) return null;

      for (let i = 0; i < order.length; i++) {
        const orderIdx =
          (fromOrderIndex + i * direction + order.length * order.length) %
          order.length;
        const trackIdx = order[orderIdx];
        const track = tracksRef.current[trackIdx];
        if (track && soundSourcesRef.current[track.soundId]) {
          return trackIdx;
        }
      }
      return null;
    },
    [],
  );

  const loadAndPlay = useCallback((trackIndex: number) => {
    const audio = audioRef.current;
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    if (!audio || !ctx || !gain || ctx.state === "closed") return;

    const track = tracksRef.current[trackIndex];
    if (!track) return;

    const src = soundSourcesRef.current[track.soundId];
    if (!src) return;

    // Cancel previous fade timer
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    // Fade out current
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_DURATION);

    fadeTimerRef.current = setTimeout(() => {
      fadeTimerRef.current = null;
      audio.src = src;
      audio.currentTime = 0;

      trackIndexRef.current = trackIndex;
      setCurrentTrackIndex(trackIndex);

      if (shouldPlayRef.current) {
        if (ctx.state === "suspended") ctx.resume();
        const targetVol = volumeRef.current / 100;
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(
          targetVol,
          ctx.currentTime + FADE_DURATION,
        );
        audio.play().catch((e) => {
          console.warn("[PlaylistEngine] play blocked:", e.message);
        });
        setIsPlaying(true);
      }
    }, FADE_DURATION * 1000);
  }, []);

  // Handle track ended → advance
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      const rm = repeatModeRef.current;

      if (rm === "one") {
        audio.currentTime = 0;
        audio.play().catch((e) => {
          console.debug("[PlaylistEngine] repeat-one play blocked:", e.message);
        });
        return;
      }

      const order = playOrderRef.current;
      const currentOrderIdx = order.indexOf(trackIndexRef.current);
      const nextOrderIdx = currentOrderIdx + 1;

      if (nextOrderIdx >= order.length) {
        if (rm === "all") {
          // Re-shuffle if needed
          if (isShuffleRef.current) {
            const indices = tracksRef.current.map((_, i) => i);
            playOrderRef.current = shuffleArray(indices);
          }
          const next = findNextPlayableIndex(0, 1);
          if (next !== null) loadAndPlay(next);
          else setIsPlaying(false);
        } else {
          // rm === 'off'
          setIsPlaying(false);
        }
        return;
      }

      const next = findNextPlayableIndex(nextOrderIdx, 1);
      if (next !== null) {
        loadAndPlay(next);
      } else if (rm === "all") {
        const first = findNextPlayableIndex(0, 1);
        if (first !== null) loadAndPlay(first);
        else setIsPlaying(false);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [findNextPlayableIndex, loadAndPlay]);

  // shouldPlay changes → start/stop
  useEffect(() => {
    const audio = audioRef.current;
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    if (!audio || !ctx || !gain) return;

    if (shouldPlay) {
      if (audio.src && audio.paused) {
        if (ctx.state === "suspended") ctx.resume();
        const targetVol = volumeRef.current / 100;
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(
          targetVol,
          ctx.currentTime + FADE_DURATION,
        );
        audio.play().catch((e) => {
          console.debug("[PlaylistEngine] resume play blocked:", e.message);
        });
        setIsPlaying(true);
      } else if (!audio.src && tracksRef.current.length > 0) {
        const first = findNextPlayableIndex(0, 1);
        if (first !== null) loadAndPlay(first);
      }
    } else {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_DURATION);
      setTimeout(
        () => {
          audio.pause();
          setIsPlaying(false);
        },
        FADE_DURATION * 1000 + 50,
      );
    }
  }, [shouldPlay, findNextPlayableIndex, loadAndPlay]);

  // Volume changes
  useEffect(() => {
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    if (!ctx || !gain) return;
    const target = volume / 100;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.05);
  }, [volume]);

  // Position tracking
  useEffect(() => {
    if (!shouldPlay) {
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    const id = window.setInterval(() => {
      const audio = audioRef.current;
      if (audio) {
        const dur = audio.duration;
        if (dur && !isNaN(dur)) {
          setCurrentTime(audio.currentTime);
          setDuration(dur);
        }
      }
    }, POSITION_INTERVAL);
    return () => clearInterval(id);
  }, [shouldPlay]);

  // Reset when tracks change (playlist switch)
  const prevTracksRef = useRef(tracks);
  useEffect(() => {
    const prevTracks = prevTracksRef.current;
    prevTracksRef.current = tracks;
    if (prevTracks !== tracks) {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      const audio = audioRef.current;
      if (audio && audio.src) {
        audio.pause();
        audio.src = "";
        audio.currentTime = 0;
        setIsPlaying(false);
        setCurrentTrackIndex(0);
        trackIndexRef.current = 0;
        setCurrentTime(0);
        setDuration(0);
      }
      if (shouldPlayRef.current && tracks.length > 0) {
        const first = findNextPlayableIndex(0, 1);
        if (first !== null) loadAndPlay(first);
      }
    }
  }, [tracks, findNextPlayableIndex, loadAndPlay]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    if (!audio || !ctx || !gain) return;

    if (!audio.src && tracksRef.current.length > 0) {
      const first = findNextPlayableIndex(0, 1);
      if (first !== null) loadAndPlay(first);
      return;
    }
    if (ctx.state === "suspended") ctx.resume();
    const targetVol = volumeRef.current / 100;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(
      targetVol,
      ctx.currentTime + FADE_DURATION,
    );
    audio.play().catch((e) => {
      console.debug("[PlaylistEngine] play blocked:", e.message);
    });
    setIsPlaying(true);
  }, [findNextPlayableIndex, loadAndPlay]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    if (!audio || !ctx || !gain) return;

    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_DURATION);
    setTimeout(
      () => {
        audio.pause();
        setIsPlaying(false);
      },
      FADE_DURATION * 1000 + 50,
    );
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    if (!audio || !ctx || !gain) return;

    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_DURATION);
    setTimeout(
      () => {
        audio.pause();
        audio.src = "";
        audio.currentTime = 0;
        setIsPlaying(false);
        setCurrentTrackIndex(0);
        setCurrentTime(0);
        setDuration(0);
        trackIndexRef.current = 0;
      },
      FADE_DURATION * 1000 + 50,
    );
  }, []);

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = time;
  }, []);

  const next = useCallback(() => {
    const order = playOrderRef.current;
    const currentOrderIdx = order.indexOf(trackIndexRef.current);
    const nextOrderIdx = (currentOrderIdx + 1) % order.length;
    const nextTrackIdx = findNextPlayableIndex(nextOrderIdx, 1);
    if (nextTrackIdx !== null) loadAndPlay(nextTrackIdx);
  }, [findNextPlayableIndex, loadAndPlay]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    // If more than 3 seconds in, restart current track
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const order = playOrderRef.current;
    const currentOrderIdx = order.indexOf(trackIndexRef.current);
    const prevOrderIdx = (currentOrderIdx - 1 + order.length) % order.length;
    const prevTrackIdx = findNextPlayableIndex(prevOrderIdx, -1);
    if (prevTrackIdx !== null) loadAndPlay(prevTrackIdx);
  }, [findNextPlayableIndex, loadAndPlay]);

  const jumpToTrack = useCallback(
    (index: number) => {
      if (index >= 0 && index < tracksRef.current.length) {
        loadAndPlay(index);
      }
    },
    [loadAndPlay],
  );

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.max(0, Math.min(100, v)));
  }, []);

  return {
    currentTrackIndex,
    currentTime,
    duration,
    volume,
    isPlaying,
    play,
    pause,
    stop,
    seekTo,
    next,
    prev,
    jumpToTrack,
    setVolume,
  };
}
