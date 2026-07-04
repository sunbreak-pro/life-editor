import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  useWikiTagsUnifiedContext,
  type WikiTagUnified,
  type WikiTagGroupUnified,
} from "@life-editor/shared";
import { TagPill } from "./TagPill";

/*
 * WikiTagsManagementView — DU-F Step 11.
 *
 * The one place users see ALL tags / groups / memberships and can edit
 * the master. Lives under the new `tags` section in MainScreen.
 *
 * Layout:
 *   ┌──── Tags master ───────┐  ┌──── Groups ────────────┐
 *   │ create / rename / del  │  │ create / rename / del  │
 *   │ pill list              │  │ for each group:        │
 *   │                        │  │   - assigned tags      │
 *   │                        │  │   - "+ tag" picker     │
 *   └────────────────────────┘  └────────────────────────┘
 *
 * State strategy: reads everything from the bulk caches in
 * WikiTagsUnifiedContext (allTags / allGroups / allGroupAssignments).
 * Mutations are optimistic — the hook updates the local state and the
 * UI re-derives. A Sync round refreshes from the DB on syncVersion bump.
 */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-offset-1 focus-visible:ring-offset-lumen-bg";

function PromptRow({
  placeholder,
  onSubmit,
}: {
  placeholder: string;
  onSubmit: (value: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (!v) return;
        void onSubmit(v);
        setValue("");
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={`min-w-[8rem] flex-1 rounded-md border border-lumen-border bg-lumen-bg px-2 py-1 text-sm text-lumen-text ${FOCUS_RING}`}
      />
      <button
        type="submit"
        className={`inline-flex items-center gap-0.5 rounded-md border border-lumen-border bg-lumen-bg px-2 py-1 text-xs text-lumen-text hover:bg-lumen-hover ${FOCUS_RING}`}
        aria-label="Create"
      >
        <Plus size={12} aria-hidden />
        Add
      </button>
    </form>
  );
}

function TagRow({
  tag,
  onRename,
  onDelete,
}: {
  tag: WikiTagUnified;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tag.name);
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-lumen-border bg-lumen-bg-secondary px-2 py-1">
      {editing ? (
        <form
          className="flex flex-1 gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const next = draft.trim();
            if (next && next !== tag.name) onRename(tag.id, next);
            setEditing(false);
          }}
        >
          <input
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const next = draft.trim();
              if (next && next !== tag.name) onRename(tag.id, next);
              setEditing(false);
            }}
            className={`flex-1 rounded-md border border-lumen-border bg-lumen-bg px-2 py-0.5 text-sm text-lumen-text ${FOCUS_RING}`}
          />
        </form>
      ) : (
        <div className="flex flex-1 items-center gap-2">
          <TagPill name={tag.name} color={tag.color} size="md" />
        </div>
      )}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => {
            setDraft(tag.name);
            setEditing((v) => !v);
          }}
          aria-label={`Rename tag ${tag.name}`}
          className={`text-lumen-text-secondary hover:text-lumen-text ${FOCUS_RING} rounded p-1`}
        >
          <Pencil size={12} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onDelete(tag.id)}
          aria-label={`Delete tag ${tag.name}`}
          className={`text-lumen-text-secondary hover:text-lumen-danger ${FOCUS_RING} rounded p-1`}
        >
          <Trash2 size={12} aria-hidden />
        </button>
      </div>
    </li>
  );
}

function GroupCard({
  group,
  memberTagIds,
  candidateTags,
  onRename,
  onDelete,
  onAddTag,
  onRemoveTag,
  tagsById,
}: {
  group: WikiTagGroupUnified;
  memberTagIds: string[];
  candidateTags: WikiTagUnified[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAddTag: (groupId: string, tagId: string) => void;
  onRemoveTag: (groupId: string, tagId: string) => void;
  tagsById: Map<string, WikiTagUnified>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.name);
  const [addQuery, setAddQuery] = useState("");

  const filteredCandidates = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    if (!q) return candidateTags.slice(0, 8);
    return candidateTags
      .filter((t) => t.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [addQuery, candidateTags]);

  return (
    <article className="space-y-2 rounded-md border border-lumen-border bg-lumen-bg-secondary p-2">
      <header className="flex items-center justify-between gap-2">
        {editing ? (
          <form
            className="flex flex-1 gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const next = draft.trim();
              if (next && next !== group.name) onRename(group.id, next);
              setEditing(false);
            }}
          >
            <input
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                const next = draft.trim();
                if (next && next !== group.name) onRename(group.id, next);
                setEditing(false);
              }}
              className={`flex-1 rounded-md border border-lumen-border bg-lumen-bg px-2 py-0.5 text-sm text-lumen-text ${FOCUS_RING}`}
            />
          </form>
        ) : (
          <h3 className="flex-1 text-sm font-semibold text-lumen-text">
            {group.name}
          </h3>
        )}
        <button
          type="button"
          onClick={() => {
            setDraft(group.name);
            setEditing((v) => !v);
          }}
          aria-label={`Rename group ${group.name}`}
          className={`text-lumen-text-secondary hover:text-lumen-text ${FOCUS_RING} rounded p-1`}
        >
          <Pencil size={12} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onDelete(group.id)}
          aria-label={`Delete group ${group.name}`}
          className={`text-lumen-text-secondary hover:text-lumen-danger ${FOCUS_RING} rounded p-1`}
        >
          <Trash2 size={12} aria-hidden />
        </button>
      </header>

      <div className="flex flex-wrap gap-1">
        {memberTagIds.length === 0 && (
          <span className="text-xs text-lumen-text-secondary">
            No tags assigned.
          </span>
        )}
        {memberTagIds.map((tagId) => {
          const tag = tagsById.get(tagId);
          if (!tag) return null;
          return (
            <span
              key={tagId}
              className="inline-flex items-center gap-1 rounded-md border border-lumen-border bg-lumen-bg px-1.5 py-0.5 text-xs text-lumen-text"
            >
              <TagPill name={tag.name} color={tag.color} size="sm" />
              <button
                type="button"
                onClick={() => onRemoveTag(group.id, tagId)}
                aria-label={`Remove ${tag.name} from group ${group.name}`}
                className={`text-lumen-text-secondary hover:text-lumen-danger ${FOCUS_RING} rounded`}
              >
                <X size={10} aria-hidden />
              </button>
            </span>
          );
        })}
      </div>

      <div className="space-y-1">
        <input
          value={addQuery}
          onChange={(e) => setAddQuery(e.target.value)}
          placeholder="Search tag to add…"
          className={`w-full rounded-md border border-lumen-border bg-lumen-bg px-2 py-1 text-xs text-lumen-text ${FOCUS_RING}`}
        />
        <ul className="max-h-32 space-y-0.5 overflow-y-auto">
          {filteredCandidates.length === 0 ? (
            <li className="px-2 py-1 text-xs text-lumen-text-secondary">
              No more tags to add.
            </li>
          ) : (
            filteredCandidates.map((tag) => (
              <li key={tag.id}>
                <button
                  type="button"
                  onClick={() => {
                    onAddTag(group.id, tag.id);
                    setAddQuery("");
                  }}
                  className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-lumen-text hover:bg-lumen-hover ${FOCUS_RING}`}
                >
                  {tag.color && (
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                  )}
                  <span>{tag.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </article>
  );
}

export function WikiTagsManagementView() {
  const wiki = useWikiTagsUnifiedContext();

  const tagsById = useMemo(() => {
    const map = new Map<string, WikiTagUnified>();
    for (const t of wiki.allTags) map.set(t.id, t);
    return map;
  }, [wiki.allTags]);

  // Group → assigned tagIds (active assignments only — DELETE prunes the
  // local cache in the hook, so no extra filter is needed here).
  const membersByGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const g of wiki.allGroups) map.set(g.id, []);
    for (const a of wiki.allGroupAssignments) {
      const arr = map.get(a.groupId);
      if (arr) arr.push(a.tagId);
    }
    return map;
  }, [wiki.allGroups, wiki.allGroupAssignments]);

  const assignmentByGroupAndTag = useMemo(() => {
    const map = new Map<string, string>(); // `${groupId}:${tagId}` -> assignmentId
    for (const a of wiki.allGroupAssignments) {
      map.set(`${a.groupId}:${a.tagId}`, a.id);
    }
    return map;
  }, [wiki.allGroupAssignments]);

  const handleCreateTag = async (name: string) => {
    try {
      await wiki.createTag(name, null);
    } catch (err) {
      console.error("createTag failed", err);
    }
  };
  const handleRenameTag = (id: string, name: string) => {
    void wiki.renameTag(id, name).catch((e) => console.error(e));
  };
  const handleDeleteTag = (id: string) => {
    void wiki.deleteTag(id).catch((e) => console.error(e));
  };

  const handleCreateGroup = async (name: string) => {
    try {
      await wiki.createGroup(name);
    } catch (err) {
      console.error("createGroup failed", err);
    }
  };
  const handleRenameGroup = (id: string, name: string) => {
    void wiki.renameGroup(id, name).catch((e) => console.error(e));
  };
  const handleDeleteGroup = (id: string) => {
    void wiki.deleteGroup(id).catch((e) => console.error(e));
  };

  const handleAddTagToGroup = (groupId: string, tagId: string) => {
    void wiki.assignTagToGroup(tagId, groupId).catch((e) => console.error(e));
  };
  const handleRemoveTagFromGroup = (groupId: string, tagId: string) => {
    const assignmentId = assignmentByGroupAndTag.get(`${groupId}:${tagId}`);
    if (!assignmentId) return;
    void wiki.unassignTagFromGroup(assignmentId).catch((e) => console.error(e));
  };

  if (wiki.loading) {
    return <p className="text-sm text-lumen-text-secondary">Loading…</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-lumen-text">
          Tags ({wiki.allTags.length})
        </h2>
        <PromptRow placeholder="New tag name" onSubmit={handleCreateTag} />
        {wiki.allTags.length === 0 ? (
          <p className="text-xs text-lumen-text-secondary">
            No tags yet. Create one above.
          </p>
        ) : (
          <ul className="space-y-1">
            {wiki.allTags.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                onRename={handleRenameTag}
                onDelete={handleDeleteTag}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-lumen-text">
          Groups ({wiki.allGroups.length})
        </h2>
        <PromptRow placeholder="New group name" onSubmit={handleCreateGroup} />
        {wiki.allGroups.length === 0 ? (
          <p className="text-xs text-lumen-text-secondary">
            No groups yet. Create one above.
          </p>
        ) : (
          <div className="space-y-2">
            {wiki.allGroups.map((group) => {
              const memberIds = membersByGroup.get(group.id) ?? [];
              const memberSet = new Set(memberIds);
              const candidateTags = wiki.allTags.filter(
                (t) => !memberSet.has(t.id),
              );
              return (
                <GroupCard
                  key={group.id}
                  group={group}
                  memberTagIds={memberIds}
                  candidateTags={candidateTags}
                  onRename={handleRenameGroup}
                  onDelete={handleDeleteGroup}
                  onAddTag={handleAddTagToGroup}
                  onRemoveTag={handleRemoveTagFromGroup}
                  tagsById={tagsById}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
