import { useState, useEffect, useCallback, useRef } from "react";
import { getDataService } from "../services";
import type { CustomSoundMeta } from "../types/customSound";
import { generateId } from "../utils/generateId";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp3",
  "audio/wave",
  "audio/x-wav",
];

async function validateAudioMagicBytes(file: File): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  // MP3: ID3 tag or MPEG sync
  if (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33)
    return true;
  if (header[0] === 0xff && (header[1] & 0xe0) === 0xe0) return true;
  // WAV: RIFF....WAVE
  if (
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    header[8] === 0x57 &&
    header[9] === 0x41 &&
    header[10] === 0x56 &&
    header[11] === 0x45
  )
    return true;
  // OGG: OggS
  if (
    header[0] === 0x4f &&
    header[1] === 0x67 &&
    header[2] === 0x67 &&
    header[3] === 0x53
  )
    return true;
  return false;
}

export function useCustomSounds() {
  const [customSounds, setCustomSounds] = useState<CustomSoundMeta[]>([]);
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const blobUrlsRef = useRef<Record<string, string>>({});

  // Load metadata + generate blob URLs on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const ds = getDataService();
      const metas = await ds.fetchCustomSoundMetas();
      if (cancelled) return;

      const urls: Record<string, string> = {};
      for (const meta of metas) {
        const data = await ds.loadCustomSound(meta.id);
        if (cancelled) break;
        if (data) {
          const blob = new Blob([data], { type: meta.mimeType });
          urls[meta.id] = URL.createObjectURL(blob);
        }
      }

      if (cancelled) {
        Object.values(urls).forEach(URL.revokeObjectURL);
        return;
      }

      // Filter out metas whose blobs are missing
      const validMetas = metas.filter((m) => urls[m.id]);

      blobUrlsRef.current = urls;
      setCustomSounds(validMetas);
      setBlobUrls(urls);
      setIsLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Revoke all blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(blobUrlsRef.current).forEach(URL.revokeObjectURL);
    };
  }, []);

  const addSound = useCallback(
    async (file: File): Promise<{ error?: string; id?: string }> => {
      if (file.size > MAX_FILE_SIZE) {
        return {
          error: `ファイルサイズが20MBを超えています (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
        };
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        return {
          error: `非対応の形式です。MP3, WAV, OGG のみ対応しています。`,
        };
      }
      if (!(await validateAudioMagicBytes(file))) {
        return { error: `ファイルの内容が音声形式と一致しません。` };
      }

      const id = generateId("custom");
      const label = file.name.replace(/\.[^.]+$/, "");
      const arrayBuffer = await file.arrayBuffer();

      const meta: CustomSoundMeta = {
        id,
        label,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        createdAt: Date.now(),
      };

      await getDataService().saveCustomSound(id, arrayBuffer, meta);

      const blob = new Blob([arrayBuffer], { type: file.type });
      const url = URL.createObjectURL(blob);

      setCustomSounds((prev) => [...prev, meta]);
      setBlobUrls((prev) => {
        const next = { ...prev, [id]: url };
        blobUrlsRef.current = next;
        return next;
      });

      return { id };
    },
    [],
  );

  const removeSound = useCallback(async (id: string) => {
    // Revoke blob URL
    const url = blobUrlsRef.current[id];
    if (url) URL.revokeObjectURL(url);

    await getDataService().deleteCustomSound(id);

    setCustomSounds((prev) => prev.filter((s) => s.id !== id));
    setBlobUrls((prev) => {
      const next = { ...prev };
      delete next[id];
      blobUrlsRef.current = next;
      return next;
    });
  }, []);

  const updateLabel = useCallback(async (id: string, label: string) => {
    setCustomSounds((prev) =>
      prev.map((s) => (s.id === id ? { ...s, label } : s)),
    );
    try {
      await getDataService().updateCustomSoundLabel(id, label);
    } catch (e) {
      console.error("Failed to update custom sound label:", e);
    }
  }, []);

  const reloadSounds = useCallback(async () => {
    const ds = getDataService();
    const metas = await ds.fetchCustomSoundMetas();

    // Revoke old blob URLs
    Object.values(blobUrlsRef.current).forEach(URL.revokeObjectURL);

    const urls: Record<string, string> = {};
    for (const meta of metas) {
      const data = await ds.loadCustomSound(meta.id);
      if (data) {
        const blob = new Blob([data], { type: meta.mimeType });
        urls[meta.id] = URL.createObjectURL(blob);
      }
    }

    const validMetas = metas.filter((m) => urls[m.id]);
    blobUrlsRef.current = urls;
    setCustomSounds(validMetas);
    setBlobUrls(urls);
  }, []);

  return {
    customSounds,
    blobUrls,
    isLoading,
    addSound,
    removeSound,
    updateLabel,
    reloadSounds,
  };
}
