import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagConnection,
  WikiTagGroup,
  WikiTagGroupMember,
} from "../../types/wikiTag";
import { tauriInvoke } from "../bridge";

export const wikiTagsApi = {
  fetchWikiTags(): Promise<WikiTag[]> {
    return tauriInvoke("db_wiki_tags_fetch_all");
  },
  searchWikiTags(query: string): Promise<WikiTag[]> {
    return tauriInvoke("db_wiki_tags_search", { query });
  },
  createWikiTag(name: string, color: string): Promise<WikiTag> {
    return tauriInvoke("db_wiki_tags_create", { name, color });
  },
  createWikiTagWithId(
    id: string,
    name: string,
    color: string,
  ): Promise<WikiTag> {
    return tauriInvoke("db_wiki_tags_create_with_id", { id, name, color });
  },
  updateWikiTag(
    id: string,
    updates: Partial<Pick<WikiTag, "name" | "color" | "textColor">>,
  ): Promise<WikiTag> {
    return tauriInvoke("db_wiki_tags_update", { id, updates });
  },
  deleteWikiTag(id: string): Promise<void> {
    return tauriInvoke("db_wiki_tags_delete", { id });
  },
  mergeWikiTags(sourceId: string, targetId: string): Promise<WikiTag> {
    return tauriInvoke("db_wiki_tags_merge", {
      sourceId,
      targetId,
    });
  },
  fetchWikiTagsForEntity(entityId: string): Promise<WikiTag[]> {
    return tauriInvoke("db_wiki_tags_fetch_for_entity", {
      entityId,
    });
  },
  setWikiTagsForEntity(
    entityId: string,
    entityType: string,
    tagIds: string[],
  ): Promise<void> {
    return tauriInvoke("db_wiki_tags_set_for_entity", {
      entityId,
      entityType,
      tagIds,
    });
  },
  syncInlineWikiTags(
    entityId: string,
    entityType: string,
    tagNames: string[],
  ): Promise<void> {
    return tauriInvoke("db_wiki_tags_sync_inline", {
      entityId,
      entityType,
      tagNames,
    });
  },
  fetchAllWikiTagAssignments(): Promise<WikiTagAssignment[]> {
    return tauriInvoke("db_wiki_tags_fetch_all_assignments");
  },
  restoreWikiTagAssignment(
    tagId: string,
    entityId: string,
    entityType: string,
    source: string,
  ): Promise<void> {
    return tauriInvoke("db_wiki_tags_restore_assignment", {
      tagId,
      entityId,
      entityType,
      source,
    });
  },
  fetchWikiTagGroups(): Promise<WikiTagGroup[]> {
    return tauriInvoke("db_wiki_tag_groups_fetch_all");
  },
  createWikiTagGroup(
    name: string,
    noteIds: string[],
    filterTags?: string[],
  ): Promise<WikiTagGroup> {
    return tauriInvoke("db_wiki_tag_groups_create", {
      name,
      noteIds,
      filterTags,
    });
  },
  updateWikiTagGroup(
    id: string,
    updates: { name?: string; filterTags?: string[] },
  ): Promise<WikiTagGroup> {
    return tauriInvoke("db_wiki_tag_groups_update", { id, updates });
  },
  deleteWikiTagGroup(id: string): Promise<void> {
    return tauriInvoke("db_wiki_tag_groups_delete", { id });
  },
  fetchAllWikiTagGroupMembers(): Promise<WikiTagGroupMember[]> {
    return tauriInvoke("db_wiki_tag_groups_fetch_all_members");
  },
  setWikiTagGroupMembers(groupId: string, noteIds: string[]): Promise<void> {
    return tauriInvoke("db_wiki_tag_groups_set_members", {
      groupId,
      noteIds,
    });
  },
  addWikiTagGroupMember(groupId: string, noteId: string): Promise<void> {
    return tauriInvoke("db_wiki_tag_groups_add_member", {
      groupId,
      noteId,
    });
  },
  removeWikiTagGroupMember(groupId: string, noteId: string): Promise<void> {
    return tauriInvoke("db_wiki_tag_groups_remove_member", {
      groupId,
      noteId,
    });
  },
  fetchWikiTagConnections(): Promise<WikiTagConnection[]> {
    return tauriInvoke("db_wiki_tag_connections_fetch_all");
  },
  createWikiTagConnection(
    sourceTagId: string,
    targetTagId: string,
  ): Promise<WikiTagConnection> {
    return tauriInvoke("db_wiki_tag_connections_create", {
      sourceTagId,
      targetTagId,
    });
  },
  deleteWikiTagConnection(id: string): Promise<void> {
    return tauriInvoke("db_wiki_tag_connections_delete", { id });
  },
  deleteWikiTagConnectionByPair(
    sourceTagId: string,
    targetTagId: string,
  ): Promise<void> {
    return tauriInvoke("db_wiki_tag_connections_delete_by_tag_pair", {
      sourceTagId,
      targetTagId,
    });
  },
};
