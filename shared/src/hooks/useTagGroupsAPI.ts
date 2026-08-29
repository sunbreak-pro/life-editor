import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { TagGroupNode } from "../types/tagGroup";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { useDomainLoad } from "./useDomainLoad";
import { useSyncDomains } from "./useSyncDomains";

/**
 * Saved multi-tag filters (#1173) — the domain that replaced `useCalendarsAPI`.
 *
 * Same shape as the hook it replaces (bulk load through `useDomainLoad`,
 * optimistic write + rollback, DI'd DataService per CLAUDE.md §6.4), with two
 * differences that follow from a group spanning two tables:
 *
 *   - It has its OWN sync domain rather than riding `tags` (#993's rule,
 *     applied in reverse): the `tags` counter moves on every tag edit and
 *     every assignment, and sharing it would both re-pull this small list on
 *     each of those AND — the expensive direction — make saving a group
 *     re-pull the whole tag graph that WikiTagsUnifiedProvider owns.
 *   - Writes reconcile rows the local cache cannot predict (membership row
 *     ids), so every mutation adopts the SERVER's node on resolve rather than
 *     keeping the optimistic one. The optimistic value exists to keep the
 *     panel from flashing empty, not to be the final truth.
 *
 * Must sit inside a Sync Provider (reads `useSyncContext`).
 */

export interface UseTagGroupsAPIOptions {
  dataService: DataService;
}

export function useTagGroupsAPI(options: UseTagGroupsAPIOptions) {
  const ds = options.dataService;
  const syncVersion = useSyncDomains("tagGroups");

  const [tagGroups, setTagGroups] = useState<TagGroupNode[]>([]);

  const tagGroupsRef = useRef(tagGroups);
  useEffect(() => {
    tagGroupsRef.current = tagGroups;
  }, [tagGroups]);

  const { isLoading, error } = useDomainLoad({
    domain: "TagGroups",
    snapshotKey: "tagGroups",
    dataService: ds,
    version: syncVersion,
    load: (service) => service.fetchTagGroups(),
    apply: setTagGroups,
    fallbackMessage: "Failed to load groups",
  });

  const createTagGroup = useCallback(
    (name: string, tagIds: readonly string[]): string => {
      const id = generateId("tgroup");
      const now = new Date().toISOString();
      const optimistic: TagGroupNode = {
        id,
        name,
        tagIds: [...tagIds],
        createdAt: now,
        updatedAt: now,
      };
      setTagGroups((prev) => [...prev, optimistic]);
      ds.createTagGroup(id, name, tagIds)
        .then((saved) =>
          setTagGroups((prev) => prev.map((g) => (g.id === id ? saved : g))),
        )
        .catch((e) => {
          logServiceError("TagGroups", "create", e);
          setTagGroups((prev) => prev.filter((g) => g.id !== id));
        });
      return id;
    },
    [ds],
  );

  const updateTagGroup = useCallback(
    (id: string, updates: { name?: string; tagIds?: readonly string[] }) => {
      // Kept for the rollback below: a failed re-bind that left the optimistic
      // tag set in place would show a filter the server does not have, and the
      // next refresh would silently swap the grid under the user.
      const previous = tagGroupsRef.current.find((g) => g.id === id);
      setTagGroups((prev) =>
        prev.map((g) =>
          g.id === id
            ? {
                ...g,
                ...(updates.name !== undefined ? { name: updates.name } : {}),
                ...(updates.tagIds !== undefined
                  ? { tagIds: [...updates.tagIds] }
                  : {}),
                updatedAt: new Date().toISOString(),
              }
            : g,
        ),
      );
      ds.updateTagGroup(id, updates)
        .then((saved) =>
          setTagGroups((prev) => prev.map((g) => (g.id === id ? saved : g))),
        )
        .catch((e) => {
          logServiceError("TagGroups", "update", e);
          if (previous)
            setTagGroups((prev) =>
              prev.map((g) => (g.id === id ? previous : g)),
            );
        });
    },
    [ds],
  );

  const deleteTagGroup = useCallback(
    (id: string) => {
      const previous = tagGroupsRef.current;
      setTagGroups((prev) => prev.filter((g) => g.id !== id));
      ds.deleteTagGroup(id).catch((e) => {
        logServiceError("TagGroups", "delete", e);
        setTagGroups(previous);
      });
    },
    [ds],
  );

  return useMemo(
    () => ({
      tagGroups,
      isLoading,
      error,
      createTagGroup,
      updateTagGroup,
      deleteTagGroup,
    }),
    [
      tagGroups,
      isLoading,
      error,
      createTagGroup,
      updateTagGroup,
      deleteTagGroup,
    ],
  );
}
