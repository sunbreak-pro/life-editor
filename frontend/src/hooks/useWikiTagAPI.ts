import { useState, useEffect, useCallback } from "react";
import type { WikiTag, WikiTagAssignment } from "../types/wikiTag";
import { getDataService } from "../services";
import { useUndoRedo } from "../components/shared/UndoRedo";

export function useWikiTagAPI() {
  const { push } = useUndoRedo();
  const [tags, setTags] = useState<WikiTag[]>([]);
  const [assignments, setAssignments] = useState<WikiTagAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    const ds = getDataService();
    const [fetchedTags, fetchedAssignments] = await Promise.all([
      ds.fetchWikiTags(),
      ds.fetchAllWikiTagAssignments(),
    ]);
    setTags(fetchedTags);
    setAssignments(fetchedAssignments);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const createTag = useCallback(
    async (name: string, color: string = "#808080") => {
      const ds = getDataService();
      const tag = await ds.createWikiTag(name, color);
      setTags((prev) =>
        [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)),
      );

      push("wikiTag", {
        label: "createTag",
        undo: async () => {
          await ds.deleteWikiTag(tag.id);
          setTags((prev) => prev.filter((t) => t.id !== tag.id));
          setAssignments((prev) => prev.filter((a) => a.tagId !== tag.id));
        },
        redo: async () => {
          const restored = await ds.createWikiTagWithId(tag.id, name, color);
          setTags((prev) =>
            [...prev, restored].sort((a, b) => a.name.localeCompare(b.name)),
          );
        },
      });

      return tag;
    },
    [push],
  );

  const updateTag = useCallback(
    async (
      id: string,
      updates: Partial<Pick<WikiTag, "name" | "color" | "textColor">>,
    ) => {
      const ds = getDataService();
      const prev = tags.find((t) => t.id === id);
      const updated = await ds.updateWikiTag(id, updates);
      setTags((p) =>
        p
          .map((t) => (t.id === id ? updated : t))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );

      if (prev) {
        const prevUpdates: Partial<
          Pick<WikiTag, "name" | "color" | "textColor">
        > = {};
        if ("name" in updates) prevUpdates.name = prev.name;
        if ("color" in updates) prevUpdates.color = prev.color;
        if ("textColor" in updates) prevUpdates.textColor = prev.textColor;

        push("wikiTag", {
          label: "updateTag",
          undo: async () => {
            const reverted = await ds.updateWikiTag(id, prevUpdates);
            setTags((p) =>
              p
                .map((t) => (t.id === id ? reverted : t))
                .sort((a, b) => a.name.localeCompare(b.name)),
            );
          },
          redo: async () => {
            const reapplied = await ds.updateWikiTag(id, updates);
            setTags((p) =>
              p
                .map((t) => (t.id === id ? reapplied : t))
                .sort((a, b) => a.name.localeCompare(b.name)),
            );
          },
        });
      }

      return updated;
    },
    [tags, push],
  );

  const deleteTag = useCallback(
    async (id: string) => {
      const ds = getDataService();
      const tag = tags.find((t) => t.id === id);
      const tagAssignments = assignments.filter((a) => a.tagId === id);

      await ds.deleteWikiTag(id);
      setTags((prev) => prev.filter((t) => t.id !== id));
      setAssignments((prev) => prev.filter((a) => a.tagId !== id));

      if (tag) {
        push("wikiTag", {
          label: "deleteTag",
          undo: async () => {
            await ds.createWikiTagWithId(tag.id, tag.name, tag.color);
            for (const a of tagAssignments) {
              await ds.restoreWikiTagAssignment(
                a.tagId,
                a.entityId,
                a.entityType,
                a.source,
              );
            }
            setTags((prev) =>
              [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)),
            );
            setAssignments((prev) => [...prev, ...tagAssignments]);
          },
          redo: async () => {
            await ds.deleteWikiTag(id);
            setTags((prev) => prev.filter((t) => t.id !== id));
            setAssignments((prev) => prev.filter((a) => a.tagId !== id));
          },
        });
      }
    },
    [tags, assignments, push],
  );

  const mergeTags = useCallback(
    async (sourceId: string, targetId: string) => {
      const ds = getDataService();
      const sourceTag = tags.find((t) => t.id === sourceId);
      const sourceAssignments = assignments.filter((a) => a.tagId === sourceId);

      const merged = await ds.mergeWikiTags(sourceId, targetId);
      await reload();

      if (sourceTag) {
        push("wikiTag", {
          label: "mergeTags",
          undo: async () => {
            await ds.createWikiTagWithId(
              sourceTag.id,
              sourceTag.name,
              sourceTag.color,
            );
            for (const a of sourceAssignments) {
              await ds.restoreWikiTagAssignment(
                a.tagId,
                a.entityId,
                a.entityType,
                a.source,
              );
            }
            await reload();
          },
          redo: async () => {
            await ds.mergeWikiTags(sourceId, targetId);
            await reload();
          },
        });
      }

      return merged;
    },
    [tags, assignments, reload, push],
  );

  const getTagsForEntity = useCallback(
    (entityId: string): WikiTag[] => {
      const tagIds = assignments
        .filter((a) => a.entityId === entityId)
        .map((a) => a.tagId);
      return tags.filter((t) => tagIds.includes(t.id));
    },
    [tags, assignments],
  );

  const setTagsForEntity = useCallback(
    async (entityId: string, entityType: string, tagIds: string[]) => {
      const ds = getDataService();
      const prevTagIds = assignments
        .filter((a) => a.entityId === entityId)
        .map((a) => a.tagId);

      await ds.setWikiTagsForEntity(entityId, entityType, tagIds);
      setAssignments((prev) => {
        const filtered = prev.filter((a) => a.entityId !== entityId);
        const now = new Date().toISOString();
        const newAssignments: WikiTagAssignment[] = tagIds.map((tagId) => ({
          tagId,
          entityId,
          entityType: entityType as WikiTagAssignment["entityType"],
          source: "manual" as const,
          createdAt: now,
        }));
        return [...filtered, ...newAssignments];
      });

      push("wikiTag", {
        label: "setTagsForEntity",
        undo: async () => {
          await ds.setWikiTagsForEntity(entityId, entityType, prevTagIds);
          setAssignments((prev) => {
            const filtered = prev.filter((a) => a.entityId !== entityId);
            const now = new Date().toISOString();
            const restored: WikiTagAssignment[] = prevTagIds.map((tagId) => ({
              tagId,
              entityId,
              entityType: entityType as WikiTagAssignment["entityType"],
              source: "manual" as const,
              createdAt: now,
            }));
            return [...filtered, ...restored];
          });
        },
        redo: async () => {
          await ds.setWikiTagsForEntity(entityId, entityType, tagIds);
          setAssignments((prev) => {
            const filtered = prev.filter((a) => a.entityId !== entityId);
            const now = new Date().toISOString();
            const newAssignments: WikiTagAssignment[] = tagIds.map((tagId) => ({
              tagId,
              entityId,
              entityType: entityType as WikiTagAssignment["entityType"],
              source: "manual" as const,
              createdAt: now,
            }));
            return [...filtered, ...newAssignments];
          });
        },
      });
    },
    [assignments, push],
  );

  const syncInlineTags = useCallback(
    async (entityId: string, entityType: string, tagNames: string[]) => {
      const ds = getDataService();
      await ds.syncInlineWikiTags(entityId, entityType, tagNames);
      await reload();
    },
    [reload],
  );

  return {
    tags,
    assignments,
    isLoading,
    reload,
    createTag,
    updateTag,
    deleteTag,
    mergeTags,
    getTagsForEntity,
    setTagsForEntity,
    syncInlineTags,
  };
}
