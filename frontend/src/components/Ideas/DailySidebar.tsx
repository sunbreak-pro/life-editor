import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Heart, BookOpen, Trash2, Filter, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MemoNode } from "../../types/memo";
import type { WikiTagAssignment, WikiTag } from "../../types/wikiTag";
import {
  formatDisplayDate,
  formatMonthLabel,
  getTodayKey,
} from "../../utils/dateKey";
import { groupMemosByMonth } from "../../utils/memoGrouping";
import { MonthGroup } from "../shared/MonthGroup";
import { getContentPreview } from "../../utils/tiptapText";
import { SearchBar, type SearchSuggestion } from "../shared/SearchBar";
import { CollapsibleSection } from "../shared/CollapsibleSection";
import { TagFilterOverlay } from "../shared/TagFilterOverlay";
import { ItemEditPopover } from "./Connect/ItemEditPopover";

interface DailySidebarProps {
  memos: MemoNode[];
  assignments: WikiTagAssignment[];
  tags: WikiTag[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onDeleteMemo?: (date: string) => void;
}

interface SectionsState {
  favorites: boolean;
  daily: boolean;
}

const SECTIONS_KEY = "life-editor-daily-sidebar-sections";

function loadSectionsState(): SectionsState {
  try {
    const saved = localStorage.getItem(SECTIONS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        favorites: parsed.favorites ?? true,
        daily: parsed.daily ?? true,
      };
    }
  } catch {
    // ignore
  }
  return { favorites: true, daily: true };
}

function saveSectionsState(state: SectionsState): void {
  localStorage.setItem(SECTIONS_KEY, JSON.stringify(state));
}

export function DailySidebar({
  memos,
  assignments,
  tags,
  selectedDate,
  onSelectDate,
  onDeleteMemo,
}: DailySidebarProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [sections, setSections] = useState<SectionsState>(loadSectionsState);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<number | null>(null);

  // Tag filter state
  const [filterTagIds, setFilterTagIds] = useState<Set<string>>(new Set());
  const [showFilter, setShowFilter] = useState(false);

  // Entity editing state
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const editButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const toggleSection = (key: keyof SectionsState) => {
    setSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveSectionsState(next);
      return next;
    });
  };

  const isSearching = debouncedQuery.trim().length > 0;
  const lowerQuery = debouncedQuery.toLowerCase();

  // Suggestions (include today even if no memo exists)
  const suggestions = useMemo<SearchSuggestion[]>(() => {
    const items: SearchSuggestion[] = [];
    const todayKey = getTodayKey();
    const hasTodayMemo = memos.some((m) => m.date === todayKey);
    if (!hasTodayMemo) {
      items.push({
        id: `memo-${todayKey}`,
        label: formatDisplayDate(todayKey, lang),
        icon: "memo",
      });
    }
    const sorted = [...memos]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
    for (const m of sorted) {
      items.push({
        id: m.id,
        label: formatDisplayDate(m.date, lang),
        icon: "memo",
      });
    }
    if (isSearching) {
      return items.filter((i) => i.label.toLowerCase().includes(lowerQuery));
    }
    return items;
  }, [memos, isSearching, lowerQuery]);

  const handleSuggestionSelect = useCallback(
    (id: string) => {
      const memo = memos.find((m) => m.id === id);
      if (memo) {
        onSelectDate(memo.date);
      } else if (id.startsWith("memo-")) {
        // Virtual today entry
        onSelectDate(id.replace("memo-", ""));
      }
    },
    [memos, onSelectDate],
  );

  // Tag dot lookup
  const entityTagColors = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of assignments) {
      const tag = tags.find((t) => t.id === a.tagId);
      if (tag) {
        const existing = map.get(a.entityId) || [];
        existing.push(tag.color);
        map.set(a.entityId, existing);
      }
    }
    return map;
  }, [assignments, tags]);

  const pinnedMemos = useMemo(() => memos.filter((m) => m.isPinned), [memos]);
  const hasFavorites = pinnedMemos.length > 0;

  const filteredMemos = useMemo(() => {
    if (!isSearching) return memos;
    return memos.filter(
      (m) =>
        m.date.includes(lowerQuery) ||
        getContentPreview(m.content, 200).toLowerCase().includes(lowerQuery),
    );
  }, [memos, isSearching, lowerQuery]);

  const isDailySelected = (date: string) => selectedDate === date;

  const renderTagDots = (entityId: string) => {
    const colors = entityTagColors.get(entityId);
    if (!colors || colors.length === 0) return null;
    return (
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {colors.slice(0, 3).map((color, i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    );
  };

  const isVirtualMemo = (memo: MemoNode) =>
    !memos.some((m) => m.date === memo.date);

  const renderMemoItem = (memo: MemoNode) => (
    <div
      key={memo.id}
      data-sidebar-item
      data-sidebar-active={isDailySelected(memo.date) || undefined}
      className={`group flex items-center gap-1.5 px-2 py-1 rounded text-left transition-colors ${
        isDailySelected(memo.date)
          ? "bg-notion-accent/10 text-notion-accent"
          : "hover:bg-notion-hover"
      }`}
      onClick={() => onSelectDate(memo.date)}
    >
      <button
        onClick={() => onSelectDate(memo.date)}
        className="flex-1 flex items-center gap-1.5 min-w-0"
      >
        {memo.isPinned ? (
          <Heart size={12} className="text-red-500 fill-current shrink-0" />
        ) : (
          <BookOpen size={12} className="text-blue-500 shrink-0" />
        )}
        <span className="flex flex-1 text-xs text-notion-text justify-start truncate">
          {formatDisplayDate(memo.date, lang)}
        </span>
        {renderTagDots(memo.id)}
      </button>
      {!isVirtualMemo(memo) && (
        <button
          ref={(el) => {
            if (el) editButtonRefs.current.set(memo.id, el);
          }}
          onClick={(e) => {
            e.stopPropagation();
            setEditingEntityId(editingEntityId === memo.id ? null : memo.id);
          }}
          className="p-0.5 opacity-0 group-hover:opacity-100 text-notion-text-secondary hover:text-notion-text transition-opacity shrink-0"
          title={t("ideas.editItem")}
        >
          <Pencil size={10} />
        </button>
      )}
      {onDeleteMemo && !isVirtualMemo(memo) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteMemo(memo.date);
          }}
          className="p-0.5 opacity-0 group-hover:opacity-100 text-notion-text-secondary hover:text-red-500 transition-opacity shrink-0"
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );

  const toggleTagFilter = (tagId: string) => {
    setFilterTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const hasTagFilter = filterTagIds.size > 0;

  const entityTagIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const a of assignments) {
      const existing = map.get(a.entityId) || new Set();
      existing.add(a.tagId);
      map.set(a.entityId, existing);
    }
    return map;
  }, [assignments]);

  const tagFilteredMemos = useMemo(() => {
    if (!hasTagFilter) return memos;
    return memos.filter((m) => {
      const memoTagSet = entityTagIds.get(m.id);
      if (!memoTagSet) return false;
      return [...filterTagIds].some((tid) => memoTagSet.has(tid));
    });
  }, [memos, hasTagFilter, filterTagIds, entityTagIds]);

  // Insert virtual today entry if today's memo doesn't exist
  const memosWithToday = useMemo(() => {
    const todayKey = getTodayKey();
    if (memos.some((m) => m.date === todayKey)) return memos;
    const virtualMemo: MemoNode = {
      id: `memo-${todayKey}`,
      date: todayKey,
      content: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return [virtualMemo, ...memos];
  }, [memos]);

  const displayMemos = hasTagFilter ? tagFilteredMemos : memosWithToday;
  const displayPinnedMemos = hasTagFilter
    ? tagFilteredMemos.filter((m) => m.isPinned)
    : pinnedMemos;
  const displayHasFavorites = displayPinnedMemos.length > 0;

  if (isSearching) {
    return (
      <div className="h-full flex flex-col">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("ideas.searchMaterials")}
          suggestions={suggestions}
          onSuggestionSelect={handleSuggestionSelect}
        />
        <div className="flex-1 overflow-y-auto p-1">
          {filteredMemos.length === 0 && (
            <p className="text-xs text-notion-text-secondary text-center py-4">
              {t("ideas.noSearchResults")}
            </p>
          )}
          {filteredMemos.map(renderMemoItem)}
        </div>
        {editingEntityId && editButtonRefs.current.get(editingEntityId) && (
          <ItemEditPopover
            entityId={editingEntityId}
            entityType="memo"
            onClose={() => setEditingEntityId(null)}
            anchorEl={editButtonRefs.current.get(editingEntityId)!}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t("ideas.searchMaterials")}
        suggestions={suggestions}
        onSuggestionSelect={handleSuggestionSelect}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Favorites */}
        {displayHasFavorites && (
          <CollapsibleSection
            label={t("ideas.favorites")}
            icon={<Heart size={12} />}
            isOpen={sections.favorites}
            onToggle={() => toggleSection("favorites")}
          >
            {displayPinnedMemos.map(renderMemoItem)}
          </CollapsibleSection>
        )}

        {/* Daily */}
        <CollapsibleSection
          label={t("ideas.daily")}
          icon={<BookOpen size={12} />}
          isOpen={sections.daily}
          onToggle={() => toggleSection("daily")}
          rightAction={
            <div className="relative">
              <button
                onClick={() => setShowFilter((v) => !v)}
                className={`p-1 rounded transition-colors ${
                  filterTagIds.size > 0
                    ? "text-notion-accent"
                    : "text-notion-text-secondary hover:text-notion-text"
                }`}
                title="Filter by tag"
              >
                <Filter size={14} />
                {filterTagIds.size > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-notion-accent text-white text-[8px] font-bold">
                    {filterTagIds.size}
                  </span>
                )}
              </button>
              {showFilter && (
                <div className="absolute right-0 top-full mt-1 z-20">
                  <TagFilterOverlay
                    tags={tags}
                    selectedTagIds={Array.from(filterTagIds)}
                    onToggle={toggleTagFilter}
                    onClose={() => setShowFilter(false)}
                  />
                </div>
              )}
            </div>
          }
        >
          {displayMemos.length === 0 ? (
            <p className="text-xs text-notion-text-secondary px-2 py-2">
              {hasTagFilter ? t("ideas.noSearchResults") : "No memos yet"}
            </p>
          ) : (
            groupMemosByMonth(displayMemos).map((group, groupIndex) => (
              <MonthGroup
                key={group.monthKey}
                monthLabel={formatMonthLabel(group.monthKey, lang)}
                itemCount={group.memos.length}
                defaultOpen={groupIndex === 0}
              >
                {group.memos.map(renderMemoItem)}
              </MonthGroup>
            ))
          )}
        </CollapsibleSection>
      </div>

      {editingEntityId && editButtonRefs.current.get(editingEntityId) && (
        <ItemEditPopover
          entityId={editingEntityId}
          entityType="memo"
          onClose={() => setEditingEntityId(null)}
          anchorEl={editButtonRefs.current.get(editingEntityId)!}
        />
      )}
    </div>
  );
}
