import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Palette,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import {
  useWikiTagsUnifiedContext,
  useMediaQuery,
  useTranslation,
  RightSidebarPortal,
  TagGroupsPanel,
  EmptyState,
  SkeletonList,
  ColorPicker,
  QuickAddSheet,
  cn,
  type WikiTagUnified,
  type TagGroupsPanelGroup,
} from "@life-editor/shared";

/*
 * Web Tags tab (Materials mini-plan Step 5). Re-shaped from the old two-column
 * master view to the target-IA ClaudeDesign import:
 *
 *   - Desktop (isWide): a centered max-width 800px card — a "Tags (N)" heading
 *     + tag rows (36px, color dot + #name, hover reveals rename / palette /
 *     delete). Rename is inline; palette expands the shared <ColorPicker>
 *     below the row; delete soft-deletes. A "+ Tag" accent action row heads the
 *     card (差分宣言 #1 — the tab-row slot is shell-owned). Group management is
 *     PUSHED INTO THE SHARED rightSidebar via RightSidebarPortal + the new
 *     shared <TagGroupsPanel> (always-present content, not selection-driven).
 *   - Mobile (narrow): read + shortest-add only (brief). "Tags (N)" heading →
 *     read-only rows (no hover actions), "Groups (N)" heading → collapsible
 *     read-only group cards (chevron; open = member chips, closed = "N tags"),
 *     and a floating "+" → QuickAddSheet.
 *
 * Data stays context-side (useWikiTagsUnifiedContext); this view is
 * DataService-free (§3.1) and takes all copy from useTranslation → props
 * (§6.4). No hex — lumen-* only; tag dot colors are user data (inline style).
 *
 * Per-tag usage counts (the design shows a number per row) are NOT rendered:
 * the unified WikiTags context exposes item→tag lookups (getTagsForItem) but
 * not the tag→item aggregate, so a per-tag count is underivable without an
 * N+1 fetch loop (forbidden). Group member counts (Mobile "N tags") ARE
 * derived from allGroupAssignments.
 */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

const ACCENT_BUTTON = cn(
  "inline-flex items-center gap-1.5 rounded-lumen-md bg-lumen-accent px-3.5 py-1.5",
  "text-[13px] font-medium text-lumen-on-accent shadow-lumen-sm transition-opacity hover:opacity-90",
  FOCUS_RING,
);

function Dot({
  color,
  className,
}: {
  color: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0 rounded-full",
        color ? "" : "bg-lumen-border-strong",
        className,
      )}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

// ---- Desktop inline add row -----------------------------------------------

function AddTagRow({
  placeholder,
  submitLabel,
  onSubmit,
  onClose,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const submit = () => {
    const next = value.trim();
    if (!next) return;
    onSubmit(next);
    setValue("");
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mb-1.5 flex gap-1.5 px-0.5"
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // Route Enter through here (not the form's implicit submit) so the
          // isComposing guard covers IME confirmation, matching DesktopTagRow
          // rename / QuickAddSheet.
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "h-9 flex-1 rounded-lumen-md border border-lumen-border bg-lumen-bg px-2.5 text-[13.5px] text-lumen-text",
          "placeholder:text-lumen-text-tertiary",
          FOCUS_RING,
        )}
      />
      <button type="submit" className={ACCENT_BUTTON}>
        <Plus size={14} aria-hidden />
        {submitLabel}
      </button>
    </form>
  );
}

// ---- Desktop tag row ------------------------------------------------------

function DesktopTagRow({
  tag,
  colorOpen,
  onToggleColor,
  onRename,
  onSetColor,
  onDelete,
  renameLabel,
  colorLabel,
  colorClearLabel,
  colorCustomLabel,
  deleteLabel,
}: {
  tag: WikiTagUnified;
  colorOpen: boolean;
  onToggleColor: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onSetColor: (id: string, color: string | null) => void;
  onDelete: (id: string) => void;
  renameLabel: string;
  colorLabel: string;
  colorClearLabel: string;
  colorCustomLabel: string;
  deleteLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tag.name);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== tag.name) onRename(tag.id, next);
    setEditing(false);
  };

  const actionButton =
    "grid h-6 w-6 place-items-center rounded-lumen-md text-lumen-text-secondary";

  return (
    <li className="group flex flex-col">
      <div
        className={cn(
          "flex h-9 items-center gap-2.5 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-2.5",
          "transition-colors group-hover:border-lumen-border-strong group-hover:bg-lumen-hover",
        )}
      >
        <Dot color={tag.color} className="h-2.5 w-2.5" />
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setDraft(tag.name);
                setEditing(false);
              }
            }}
            aria-label={`${renameLabel}: ${tag.name}`}
            className={cn(
              "min-w-0 flex-1 rounded-lumen-md border border-lumen-border bg-lumen-bg px-2 py-0.5 text-[13.5px] text-lumen-text",
              FOCUS_RING,
            )}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-lumen-text">
            #{tag.name}
          </span>
        )}

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => {
              setDraft(tag.name);
              setEditing((v) => !v);
            }}
            aria-label={`${renameLabel}: ${tag.name}`}
            className={cn(actionButton, "hover:text-lumen-text", FOCUS_RING)}
          >
            <Pencil size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onToggleColor(tag.id)}
            aria-expanded={colorOpen}
            aria-label={`${colorLabel}: ${tag.name}`}
            className={cn(actionButton, "hover:text-lumen-text", FOCUS_RING)}
          >
            <Palette size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onDelete(tag.id)}
            aria-label={`${deleteLabel}: ${tag.name}`}
            className={cn(actionButton, "hover:text-lumen-danger", FOCUS_RING)}
          >
            <Trash2 size={14} aria-hidden />
          </button>
        </div>
      </div>

      {colorOpen && (
        <div className="px-2.5 pb-1.5 pt-1">
          <ColorPicker
            current={tag.color ?? undefined}
            label={colorLabel}
            clearLabel={colorClearLabel}
            customLabel={colorCustomLabel}
            onPick={(color) => onSetColor(tag.id, color)}
          />
        </div>
      )}
    </li>
  );
}

// ---- Mobile group card (read-only, collapsible) ---------------------------

function MobileGroupCard({
  group,
  memberCountLabel,
  expandLabel,
  collapseLabel,
}: {
  group: TagGroupsPanelGroup;
  memberCountLabel: string;
  expandLabel: string;
  collapseLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? collapseLabel : expandLabel}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2.5 text-left",
          FOCUS_RING,
        )}
      >
        {open ? (
          <ChevronDown
            size={13}
            aria-hidden
            className="shrink-0 text-lumen-text-secondary"
          />
        ) : (
          <ChevronRight
            size={13}
            aria-hidden
            className="shrink-0 text-lumen-text-secondary"
          />
        )}
        <span className="flex-1 text-[13.5px] font-semibold text-lumen-text">
          {group.name}
        </span>
        {!open && (
          <span className="text-[12px] text-lumen-text-secondary">
            {memberCountLabel}
          </span>
        )}
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-3 pl-[34px]">
          {group.members.map((member) => (
            <span
              key={member.tagId}
              className="inline-flex items-center gap-1.5 rounded-full border border-lumen-border bg-lumen-bg px-2.5 py-1 text-[12px] text-lumen-text-secondary"
            >
              <Dot color={member.color} className="h-[7px] w-[7px]" />#
              {member.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function WikiTagsManagementView() {
  const wiki = useWikiTagsUnifiedContext();
  const { t } = useTranslation();
  const isWide = useMediaQuery("(min-width: 768px)", true);

  const [addingTag, setAddingTag] = useState(false);
  const [colorEditId, setColorEditId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const tagsById = useMemo(() => {
    const map = new Map<string, WikiTagUnified>();
    for (const tag of wiki.allTags) map.set(tag.id, tag);
    return map;
  }, [wiki.allTags]);

  // group → assigned tagIds (active assignments only — the hook prunes the
  // local cache on delete, so no extra filter is needed).
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
    const map = new Map<string, string>(); // `${groupId}:${tagId}` → assignmentId
    for (const a of wiki.allGroupAssignments) {
      map.set(`${a.groupId}:${a.tagId}`, a.id);
    }
    return map;
  }, [wiki.allGroupAssignments]);

  const panelGroups = useMemo<TagGroupsPanelGroup[]>(
    () =>
      wiki.allGroups.map((g) => {
        const memberIds = membersByGroup.get(g.id) ?? [];
        const memberSet = new Set(memberIds);
        const members = memberIds
          .map((id) => tagsById.get(id))
          .filter((tag): tag is WikiTagUnified => tag != null)
          .map((tag) => ({ tagId: tag.id, name: tag.name, color: tag.color }));
        const candidates = wiki.allTags
          .filter((tag) => !memberSet.has(tag.id))
          .map((tag) => ({ tagId: tag.id, name: tag.name, color: tag.color }));
        return { id: g.id, name: g.name, members, candidates };
      }),
    [wiki.allGroups, wiki.allTags, membersByGroup, tagsById],
  );

  // -- mutations (context-side; optimistic in the hook) --------------------

  const handleCreateTag = (name: string) => {
    void wiki.createTag(name, null).catch((e) => console.error(e));
  };
  const handleRenameTag = (id: string, name: string) => {
    void wiki.renameTag(id, name).catch((e) => console.error(e));
  };
  const handleSetTagColor = (id: string, color: string | null) => {
    void wiki.setTagColor(id, color).catch((e) => console.error(e));
  };
  const handleDeleteTag = (id: string) => {
    void wiki.deleteTag(id).catch((e) => console.error(e));
  };

  const handleCreateGroup = () => {
    const name = window.prompt(t("materials.tags.newGroupPrompt"), "");
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    void wiki.createGroup(trimmed).catch((e) => console.error(e));
  };
  const handleAddMember = (groupId: string, tagId: string) => {
    void wiki.assignTagToGroup(tagId, groupId).catch((e) => console.error(e));
  };
  const handleRemoveMember = (groupId: string, tagId: string) => {
    const assignmentId = assignmentByGroupAndTag.get(`${groupId}:${tagId}`);
    if (!assignmentId) return;
    void wiki.unassignTagFromGroup(assignmentId).catch((e) => console.error(e));
  };

  if (wiki.loading) {
    return (
      <div className="px-4 pt-4">
        <SkeletonList rows={8} rowHeight={36} gap={4} />
      </div>
    );
  }

  const tagCount = wiki.allTags.length;
  const hasTags = tagCount > 0;

  const tagRows = wiki.allTags.map((tag) => (
    <DesktopTagRow
      key={tag.id}
      tag={tag}
      colorOpen={colorEditId === tag.id}
      onToggleColor={(id) =>
        setColorEditId((current) => (current === id ? null : id))
      }
      onRename={handleRenameTag}
      onSetColor={(id, color) => {
        handleSetTagColor(id, color);
      }}
      onDelete={handleDeleteTag}
      renameLabel={t("materials.tags.rename")}
      colorLabel={t("materials.tags.colorLabel")}
      colorClearLabel={t("colorPicker.default")}
      colorCustomLabel={t("colorPicker.custom")}
      deleteLabel={t("materials.tags.deleteTag")}
    />
  ));

  // ---- Desktop --------------------------------------------------------

  // PageContainer (reading) owns width, gutter and the document scroll — the
  // card renders content-height instead of filling and self-scrolling.
  const desktopBody = (
    <div className="flex flex-col">
      <div className="flex w-full justify-end pb-3">
        <button
          type="button"
          onClick={() => setAddingTag((v) => !v)}
          className={ACCENT_BUTTON}
        >
          <Plus size={14} aria-hidden />
          {t("materials.tags.addCta")}
        </button>
      </div>

      <div className="flex w-full flex-col rounded-lumen-lg border border-lumen-border bg-lumen-surface shadow-lumen-sm">
        <div className="px-3.5 pb-2 pt-3.5 text-[14px] font-semibold text-lumen-text">
          {t("materials.tags.tagsCount", { count: tagCount })}
        </div>
        <div className="px-2 pb-2">
          {addingTag && (
            <AddTagRow
              placeholder={t("materials.tags.addPlaceholder")}
              submitLabel={t("materials.tags.quickAddSubmit")}
              onSubmit={handleCreateTag}
              onClose={() => setAddingTag(false)}
            />
          )}
          {!hasTags ? (
            <EmptyState
              className="min-h-[40vh]"
              icon={<Tag aria-hidden />}
              message={t("materials.tags.empty")}
              cta={{
                label: t("materials.tags.addCta"),
                onClick: () => setAddingTag(true),
              }}
            />
          ) : (
            <ul className="flex flex-col gap-[3px]">{tagRows}</ul>
          )}
        </div>
      </div>
    </div>
  );

  // ---- Mobile ---------------------------------------------------------

  const mobileBody = (
    <div className="flex h-full flex-col px-4 pt-2">
      {!hasTags ? (
        <EmptyState
          icon={<Tag aria-hidden />}
          message={t("materials.tags.empty")}
          cta={{
            label: t("materials.tags.addCta"),
            onClick: () => setAddOpen(true),
          }}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-20">
          <div className="flex items-baseline gap-1 px-0.5 pb-1 pt-0.5">
            <span className="text-[14px] font-semibold text-lumen-text">
              {t("materials.tags.tagsCount", { count: tagCount })}
            </span>
          </div>
          {wiki.allTags.map((tag) => (
            <div
              key={tag.id}
              className="flex h-10 items-center gap-2.5 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-3 text-[14px]"
            >
              <Dot color={tag.color} className="h-2.5 w-2.5" />
              <span className="min-w-0 flex-1 truncate text-lumen-text">
                #{tag.name}
              </span>
            </div>
          ))}

          <div className="flex items-baseline gap-1 px-0.5 pb-1 pt-3">
            <span className="text-[14px] font-semibold text-lumen-text">
              {t("materials.tags.groupsCount", {
                count: wiki.allGroups.length,
              })}
            </span>
          </div>
          {panelGroups.map((group) => (
            <MobileGroupCard
              key={group.id}
              group={group}
              memberCountLabel={t("materials.tags.memberCount", {
                count: group.members.length,
              })}
              expandLabel={t("materials.tags.expandGroup")}
              collapseLabel={t("materials.tags.collapseGroup")}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label={t("materials.tags.quickAddTitle")}
        className={cn(
          "absolute bottom-5 right-5 grid h-12 w-12 place-items-center rounded-full",
          "bg-lumen-accent text-lumen-on-accent shadow-lumen-md transition-opacity hover:opacity-90",
          FOCUS_RING,
        )}
      >
        <Plus size={22} aria-hidden />
      </button>
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {isWide ? desktopBody : mobileBody}

      {/* Group management — pushed into the shared rightSidebar (wide-only,
          always-present content like DailyEntriesPanel). */}
      {isWide && (
        <RightSidebarPortal>
          <TagGroupsPanel
            heading={t("materials.tags.groupsCount", {
              count: wiki.allGroups.length,
            })}
            createGroupLabel={t("materials.tags.createGroup")}
            groups={panelGroups}
            onCreateGroup={handleCreateGroup}
            onAddMember={handleAddMember}
            onRemoveMember={handleRemoveMember}
            addTagLabel={t("materials.tags.addTagToGroup")}
            addTagSearchPlaceholder={t(
              "materials.tags.addTagSearchPlaceholder",
            )}
            removeMemberLabel={t("materials.tags.removeFromGroup")}
            noCandidatesLabel={t("materials.tags.noCandidates")}
            emptyLabel={t("materials.tags.groupsEmpty")}
          />
        </RightSidebarPortal>
      )}

      {/* Mobile quick-add. */}
      {!isWide && (
        <QuickAddSheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
          title={t("materials.tags.quickAddTitle")}
          placeholder={t("materials.tags.quickAddPlaceholder")}
          submitLabel={t("materials.tags.quickAddSubmit")}
          onSubmit={handleCreateTag}
        />
      )}
    </div>
  );
}
