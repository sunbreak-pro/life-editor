import { useState, useRef, useCallback, useEffect } from "react";

const POSITION_UPDATE_INTERVAL = 250;

export function usePreviewAudio() {
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(50);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearInterval_ = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTracking = useCallback(() => {
    clearInterval_();
    intervalRef.current = setInterval(() => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
        setDuration(audioRef.current.duration || 0);
      }
    }, POSITION_UPDATE_INTERVAL);
  }, [clearInterval_]);

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    clearInterval_();
    setPreviewingId(null);
    setCurrentTime(0);
    setDuration(0);
  }, [clearInterval_]);

  const togglePreview = useCallback(
    (soundId: string, url: string) => {
      if (previewingId === soundId) {
        stopPreview();
        return;
      }

      // Stop current preview if any
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      clearInterval_();

      const audio = new Audio(url);
      audio.volume = volume / 100;
      audio.loop = false;
      audio.onended = () => {
        setPreviewingId(null);
        audioRef.current = null;
        clearInterval_();
        setCurrentTime(0);
        setDuration(0);
      };
      audio.onloadedmetadata = () => {
        setDuration(audio.duration || 0);
      };
      audio.play().catch((e) => {
        console.warn("[PreviewAudio] play failed:", e);
        setPreviewingId(null);
        audioRef.current = null;
      });

      audioRef.current = audio;
      setPreviewingId(soundId);
      setCurrentTime(0);
      startTracking();
    },
    [previewingId, stopPreview, volume, clearInterval_, startTracking],
  );

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) {
      audioRef.current.volume = v / 100;
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      clearInterval_();
    };
  }, [clearInterval_]);

  return {
    previewingId,
    togglePreview,
    stopPreview,
    volume,
    setVolume,
    currentTime,
    duration,
    seekTo,
  };
}
