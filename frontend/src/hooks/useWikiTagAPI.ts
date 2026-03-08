import { useState, useEffect, useCallback } from "react";
import type { WikiTag, WikiTagAssignment } from "../types/wikiTag";
import { getDataService } from "../services";

export function useWikiTagAPI() {
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
      return tag;
    },
    [],
  );

  const updateTag = useCallback(
    async (id: string, updates: Partial<Pick<WikiTag, "name" | "color">>) => {
      const ds = getDataService();
      const updated = await ds.updateWikiTag(id, updates);
      setTags((prev) =>
        prev
          .map((t) => (t.id === id ? updated : t))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      return updated;
    },
    [],
  );

  const deleteTag = useCallback(async (id: string) => {
    const ds = getDataService();
    await ds.deleteWikiTag(id);
    setTags((prev) => prev.filter((t) => t.id !== id));
    setAssignments((prev) => prev.filter((a) => a.tagId !== id));
  }, []);

  const mergeTags = useCallback(
    async (sourceId: string, targetId: string) => {
      const ds = getDataService();
      const merged = await ds.mergeWikiTags(sourceId, targetId);
      // Reload to get accurate assignment state
      await reload();
      return merged;
    },
    [reload],
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
      await ds.setWikiTagsForEntity(entityId, entityType, tagIds);
      // Update local assignments
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
    [],
  );

  const syncInlineTags = useCallback(
    async (entityId: string, entityType: string, tagNames: string[]) => {
      const ds = getDataService();
      await ds.syncInlineWikiTags(entityId, entityType, tagNames);
      // Reload to get newly created tags and updated assignments
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
