import { useState, useCallback, useEffect, useRef } from "react";
import type { SoundTag } from "../types/sound";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { useUndoRedo } from "../components/shared/UndoRedo";

export function useSoundTags() {
  const { push } = useUndoRedo();
  const [soundTags, setSoundTags] = useState<SoundTag[]>([]);
  const [displayMeta, setDisplayMeta] = useState<Map<string, string>>(
    new Map(),
  );
  const soundTagAssignments = useRef<Map<string, SoundTag[]>>(new Map());
  const [version, setVersion] = useState(0);
  const [filterTagIds, setFilterTagIds] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tags, assignments, metas] = await Promise.all([
          getDataService().fetchAllSoundTags(),
          getDataService().fetchAllSoundTagAssignments(),
          getDataService().fetchAllSoundDisplayMeta(),
        ]);
        if (cancelled) return;
        setSoundTags(tags);

        // Build display meta map
        const metaMap = new Map<string, string>();
        for (const m of metas) {
          if (m.displayName) metaMap.set(m.soundId, m.displayName);
        }
        setDisplayMeta(metaMap);

        // Build assignments map
        const tagMap = new Map<number, SoundTag>();
        for (const t of tags) tagMap.set(t.id, t);
        const assignMap = new Map<string, SoundTag[]>();
        for (const { sound_id, tag_id } of assignments) {
          const tag = tagMap.get(tag_id);
          if (tag) {
            const existing = assignMap.get(sound_id) || [];
            existing.push(tag);
            assignMap.set(sound_id, existing);
          }
        }
        soundTagAssignments.current = assignMap;
        setVersion((v) => v + 1);
      } catch (e) {
        logServiceError("SoundTags", "fetch", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const createTag = useCallback(
    async (name: string, color: string) => {
      const tag = await getDataService().createSoundTag(name, color);
      setSoundTags((prev) =>
        [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)),
      );

      push("sound", {
        label: "createSoundTag",
        undo: async () => {
          await getDataService().deleteSoundTag(tag.id);
          setSoundTags((prev) => prev.filter((t) => t.id !== tag.id));
          setVersion((v) => v + 1);
        },
        redo: async () => {
          const restored = await getDataService().createSoundTag(name, color);
          setSoundTags((prev) =>
            [...prev, restored].sort((a, b) => a.name.localeCompare(b.name)),
          );
          setVersion((v) => v + 1);
        },
      });

      return tag;
    },
    [push],
  );

  const updateTag = useCallback(
    async (id: number, updates: { name?: string; color?: string }) => {
      const prev = soundTags.find((t) => t.id === id);
      const prevValues: typeof updates = {};
      if (prev) {
        if ("name" in updates) prevValues.name = prev.name;
        if ("color" in updates) prevValues.color = prev.color;
      }

      const updated = await getDataService().updateSoundTag(id, updates);
      setSoundTags((p) => p.map((t) => (t.id === id ? updated : t)));
      soundTagAssignments.current.forEach((tags, soundId) => {
        if (tags.some((t) => t.id === id)) {
          soundTagAssignments.current.set(
            soundId,
            tags.map((t) => (t.id === id ? updated : t)),
          );
        }
      });
      setVersion((v) => v + 1);

      if (prev) {
        push("sound", {
          label: "updateSoundTag",
          undo: async () => {
            const restored = await getDataService().updateSoundTag(
              id,
              prevValues,
            );
            setSoundTags((p) => p.map((t) => (t.id === id ? restored : t)));
            soundTagAssignments.current.forEach((tags, soundId) => {
              if (tags.some((t) => t.id === id)) {
                soundTagAssignments.current.set(
                  soundId,
                  tags.map((t) => (t.id === id ? restored : t)),
                );
              }
            });
            setVersion((v) => v + 1);
          },
          redo: async () => {
            const reapplied = await getDataService().updateSoundTag(
              id,
              updates,
            );
            setSoundTags((p) => p.map((t) => (t.id === id ? reapplied : t)));
            soundTagAssignments.current.forEach((tags, soundId) => {
              if (tags.some((t) => t.id === id)) {
                soundTagAssignments.current.set(
                  soundId,
                  tags.map((t) => (t.id === id ? reapplied : t)),
                );
              }
            });
            setVersion((v) => v + 1);
          },
        });
      }
    },
    [soundTags, push],
  );

  const deleteTag = useCallback(async (id: number) => {
    await getDataService().deleteSoundTag(id);
    setSoundTags((prev) => prev.filter((t) => t.id !== id));
    setFilterTagIds((prev) => prev.filter((tid) => tid !== id));
    soundTagAssignments.current.forEach((tags, soundId) => {
      const filtered = tags.filter((t) => t.id !== id);
      if (filtered.length !== tags.length) {
        soundTagAssignments.current.set(soundId, filtered);
      }
    });
    setVersion((v) => v + 1);
  }, []);

  const getTagsForSound = useCallback((soundId: string): SoundTag[] => {
    return soundTagAssignments.current.get(soundId) ?? [];
  }, []);

  const setTagsForSound = useCallback(
    async (soundId: string, tagIds: number[]) => {
      const prevTags = soundTagAssignments.current.get(soundId) ?? [];
      const prevTagIds = prevTags.map((t) => t.id);

      const newTags = soundTags.filter((t) => tagIds.includes(t.id));
      soundTagAssignments.current.set(soundId, newTags);
      setVersion((v) => v + 1);
      try {
        await getDataService().setTagsForSound(soundId, tagIds);
      } catch (e) {
        logServiceError("SoundTags", "setForSound", e);
      }

      push("sound", {
        label: "setTagsForSound",
        undo: async () => {
          const oldTags = soundTags.filter((t) => prevTagIds.includes(t.id));
          soundTagAssignments.current.set(soundId, oldTags);
          setVersion((v) => v + 1);
          try {
            await getDataService().setTagsForSound(soundId, prevTagIds);
          } catch (e) {
            logServiceError("SoundTags", "undoSetForSound", e);
          }
        },
        redo: async () => {
          const newTags2 = soundTags.filter((t) => tagIds.includes(t.id));
          soundTagAssignments.current.set(soundId, newTags2);
          setVersion((v) => v + 1);
          try {
            await getDataService().setTagsForSound(soundId, tagIds);
          } catch (e) {
            logServiceError("SoundTags", "redoSetForSound", e);
          }
        },
      });
    },
    [soundTags, push],
  );

  const getDisplayName = useCallback(
    (soundId: string): string | undefined => {
      return displayMeta.get(soundId);
    },
    [displayMeta],
  );

  const updateDisplayName = useCallback(
    async (soundId: string, name: string) => {
      const prevName = displayMeta.get(soundId);

      setDisplayMeta((prev) => {
        const next = new Map(prev);
        next.set(soundId, name);
        return next;
      });
      try {
        await getDataService().updateSoundDisplayMeta(soundId, name);
      } catch (e) {
        logServiceError("SoundTags", "updateDisplayMeta", e);
      }

      push("sound", {
        label: "updateDisplayName",
        undo: async () => {
          setDisplayMeta((prev) => {
            const next = new Map(prev);
            if (prevName !== undefined) next.set(soundId, prevName);
            else next.delete(soundId);
            return next;
          });
          try {
            await getDataService().updateSoundDisplayMeta(
              soundId,
              prevName ?? "",
            );
          } catch (e) {
            logServiceError("SoundTags", "undoDisplayName", e);
          }
        },
        redo: async () => {
          setDisplayMeta((prev) => {
            const next = new Map(prev);
            next.set(soundId, name);
            return next;
          });
          try {
            await getDataService().updateSoundDisplayMeta(soundId, name);
          } catch (e) {
            logServiceError("SoundTags", "redoDisplayName", e);
          }
        },
      });
    },
    [displayMeta, push],
  );

  const toggleFilterTag = useCallback((tagId: number) => {
    setFilterTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  }, []);

  const clearFilter = useCallback(() => {
    setFilterTagIds([]);
  }, []);

  const soundPassesFilter = useCallback(
    (soundId: string): boolean => {
      if (filterTagIds.length === 0) return true;
      const tags = soundTagAssignments.current.get(soundId) ?? [];
      return filterTagIds.some((fid) => tags.some((t) => t.id === fid));
    },
    [filterTagIds],
  );

  return {
    soundTags,
    filterTagIds,
    version,
    createTag,
    updateTag,
    deleteTag,
    getTagsForSound,
    setTagsForSound,
    getDisplayName,
    updateDisplayName,
    toggleFilterTag,
    clearFilter,
    soundPassesFilter,
  };
}
