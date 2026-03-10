import { useState, useEffect, useCallback } from "react";
import type { WikiTagGroup, WikiTagGroupMember } from "../types/wikiTag";
import { getDataService } from "../services";
import { useUndoRedo } from "../components/shared/UndoRedo";

export function useWikiTagGroups() {
  const { push } = useUndoRedo();
  const [groups, setGroups] = useState<WikiTagGroup[]>([]);
  const [members, setMembers] = useState<WikiTagGroupMember[]>([]);

  const reload = useCallback(async () => {
    const ds = getDataService();
    const [fetchedGroups, fetchedMembers] = await Promise.all([
      ds.fetchWikiTagGroups(),
      ds.fetchAllWikiTagGroupMembers(),
    ]);
    setGroups(fetchedGroups);
    setMembers(fetchedMembers);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const createGroup = useCallback(
    async (name: string, tagIds: string[]) => {
      const ds = getDataService();
      const group = await ds.createWikiTagGroup(name, tagIds);
      setGroups((prev) => [...prev, group]);
      setMembers((prev) => [
        ...prev,
        ...tagIds.map((tagId) => ({ groupId: group.id, tagId })),
      ]);

      push("wikiTag", {
        label: "createGroup",
        undo: async () => {
          await ds.deleteWikiTagGroup(group.id);
          setGroups((prev) => prev.filter((g) => g.id !== group.id));
          setMembers((prev) => prev.filter((m) => m.groupId !== group.id));
        },
        redo: async () => {
          await reload();
        },
      });

      return group;
    },
    [push, reload],
  );

  const updateGroup = useCallback(
    async (id: string, updates: { name: string }) => {
      const ds = getDataService();
      const prev = groups.find((g) => g.id === id);
      const updated = await ds.updateWikiTagGroup(id, updates);
      setGroups((p) => p.map((g) => (g.id === id ? updated : g)));

      if (prev) {
        push("wikiTag", {
          label: "updateGroup",
          undo: async () => {
            const reverted = await ds.updateWikiTagGroup(id, {
              name: prev.name,
            });
            setGroups((p) => p.map((g) => (g.id === id ? reverted : g)));
          },
          redo: async () => {
            const reapplied = await ds.updateWikiTagGroup(id, updates);
            setGroups((p) => p.map((g) => (g.id === id ? reapplied : g)));
          },
        });
      }

      return updated;
    },
    [groups, push],
  );

  const deleteGroup = useCallback(
    async (id: string) => {
      const ds = getDataService();
      const group = groups.find((g) => g.id === id);
      const groupMembers = members.filter((m) => m.groupId === id);

      await ds.deleteWikiTagGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      setMembers((prev) => prev.filter((m) => m.groupId !== id));

      if (group) {
        push("wikiTag", {
          label: "deleteGroup",
          undo: async () => {
            await reload();
          },
          redo: async () => {
            await ds.deleteWikiTagGroup(id);
            setGroups((prev) => prev.filter((g) => g.id !== id));
            setMembers((prev) => prev.filter((m) => m.groupId !== id));
          },
        });
      }
    },
    [groups, members, push, reload],
  );

  const setGroupMembers = useCallback(
    async (groupId: string, tagIds: string[]) => {
      const ds = getDataService();
      const prevMembers = members.filter((m) => m.groupId === groupId);

      await ds.setWikiTagGroupMembers(groupId, tagIds);
      setMembers((prev) => {
        const filtered = prev.filter((m) => m.groupId !== groupId);
        return [...filtered, ...tagIds.map((tagId) => ({ groupId, tagId }))];
      });

      push("wikiTag", {
        label: "setGroupMembers",
        undo: async () => {
          await ds.setWikiTagGroupMembers(
            groupId,
            prevMembers.map((m) => m.tagId),
          );
          setMembers((prev) => {
            const filtered = prev.filter((m) => m.groupId !== groupId);
            return [...filtered, ...prevMembers];
          });
        },
        redo: async () => {
          await ds.setWikiTagGroupMembers(groupId, tagIds);
          setMembers((prev) => {
            const filtered = prev.filter((m) => m.groupId !== groupId);
            return [
              ...filtered,
              ...tagIds.map((tagId) => ({ groupId, tagId })),
            ];
          });
        },
      });
    },
    [members, push],
  );

  const addGroupMember = useCallback(async (groupId: string, tagId: string) => {
    const ds = getDataService();
    await ds.addWikiTagGroupMember(groupId, tagId);
    setMembers((prev) => [...prev, { groupId, tagId }]);
  }, []);

  const removeGroupMember = useCallback(
    async (groupId: string, tagId: string) => {
      const ds = getDataService();
      await ds.removeWikiTagGroupMember(groupId, tagId);
      setMembers((prev) =>
        prev.filter((m) => !(m.groupId === groupId && m.tagId === tagId)),
      );
    },
    [],
  );

  return {
    groups,
    groupMembers: members,
    createGroup,
    updateGroup,
    deleteGroup,
    setGroupMembers,
    addGroupMember,
    removeGroupMember,
    reloadGroups: reload,
  };
}
