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
    async (name: string, noteIds: string[], filterTags?: string[]) => {
      const ds = getDataService();
      const group = await ds.createWikiTagGroup(name, noteIds, filterTags);
      setGroups((prev) => [...prev, group]);
      setMembers((prev) => [
        ...prev,
        ...noteIds.map((noteId) => ({ groupId: group.id, noteId })),
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
    async (id: string, updates: { name?: string; filterTags?: string[] }) => {
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
              filterTags: prev.filterTags,
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
    async (groupId: string, noteIds: string[]) => {
      const ds = getDataService();
      const prevMembers = members.filter((m) => m.groupId === groupId);

      await ds.setWikiTagGroupMembers(groupId, noteIds);
      setMembers((prev) => {
        const filtered = prev.filter((m) => m.groupId !== groupId);
        return [...filtered, ...noteIds.map((noteId) => ({ groupId, noteId }))];
      });

      push("wikiTag", {
        label: "setGroupMembers",
        undo: async () => {
          await ds.setWikiTagGroupMembers(
            groupId,
            prevMembers.map((m) => m.noteId),
          );
          setMembers((prev) => {
            const filtered = prev.filter((m) => m.groupId !== groupId);
            return [...filtered, ...prevMembers];
          });
        },
        redo: async () => {
          await ds.setWikiTagGroupMembers(groupId, noteIds);
          setMembers((prev) => {
            const filtered = prev.filter((m) => m.groupId !== groupId);
            return [
              ...filtered,
              ...noteIds.map((noteId) => ({ groupId, noteId })),
            ];
          });
        },
      });
    },
    [members, push],
  );

  const addGroupMember = useCallback(
    async (groupId: string, noteId: string) => {
      const ds = getDataService();
      await ds.addWikiTagGroupMember(groupId, noteId);
      setMembers((prev) => [...prev, { groupId, noteId }]);
    },
    [],
  );

  const removeGroupMember = useCallback(
    async (groupId: string, noteId: string) => {
      const ds = getDataService();
      await ds.removeWikiTagGroupMember(groupId, noteId);
      setMembers((prev) =>
        prev.filter((m) => !(m.groupId === groupId && m.noteId === noteId)),
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
