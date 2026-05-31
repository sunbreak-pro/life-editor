import {
  ArrowUpDown,
  Bold,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code,
  Copy,
  FileText,
  Filter as FilterIcon,
  Hash,
  Heading1,
  Heading2,
  Italic,
  LayoutGrid,
  Link2,
  List as ListIcon,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Quote,
  Search,
  Share2,
  Timer as TimerIcon,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BottomSheet } from "../components/BottomSheet";
import { Drawer } from "../components/Drawer";
import { useShell } from "../context/ShellContext";
import { useMockStore } from "../hooks/useMockStore";
import {
  addNote,
  addWikiTag,
  attachTag,
  deleteNote,
  detachTag,
  duplicateNote,
  getOrCreateDaily,
  togglePinNote,
  updateNote,
} from "../lib/mockStore";
import { C } from "../lib/theme";
import type { Mood, Note, WikiTag } from "../lib/types";
import { findBacklinks, resolveLink, suggestLinks } from "../lib/wikiLink";

type Kind = "notes" | "daily";
type Layout = "card" | "row";
type SortKey = "updatedAt" | "createdAt" | "title";
type SheetType =
  | "sort"
  | "filter"
  | "itemMenu"
  | "editorMenu"
  | "mood"
  | "tag"
  | null;

const MOOD_COLOR: Record<Mood, string> = {
  green: C.green,
  sky: C.sky,
  yellow: C.yellow,
  peach: C.peach,
  red: C.red,
};

const MOOD_LABEL: Record<Mood, string> = {
  green: "良い",
  sky: "普通",
  yellow: "微妙",
  peach: "つかれた",
  red: "だめ",
};

const TAG_COLOR_OPTIONS = [
  C.mauve,
  C.pink,
  C.peach,
  C.yellow,
  C.green,
  C.sky,
  C.blue,
  C.red,
] as const;

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const pad2 = (n: number): string => String(n).padStart(2, "0");

const ymdToday = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const formatTimeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}日前`;
  const dt = new Date(ts);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
};

const formatDailyTitle = (note: Note): string => {
  if (note.kind !== "daily" || !note.date) return note.title || "(無題)";
  const d = new Date(`${note.date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return note.date;
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`;
};

const sortNotes = (notes: Note[], key: SortKey): Note[] => {
  const cmp = (a: Note, b: Note): number => {
    if (key === "title") {
      return formatDailyTitle(a).localeCompare(formatDailyTitle(b));
    }
    const av = key === "updatedAt" ? a.updatedAt : a.createdAt;
    const bv = key === "updatedAt" ? b.updatedAt : b.createdAt;
    return bv - av;
  };
  return [...notes].sort(cmp);
};

const mapTags = (tags: WikiTag[]): Map<string, WikiTag> => {
  const m = new Map<string, WikiTag>();
  for (const t of tags) m.set(t.id, t);
  return m;
};

export function MaterialsScreen() {
  const nav = useNavigate();
  const { sidebarOpen, closeSidebar } = useShell();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawNotes = useMockStore((s) => s.notes);
  const wikiTags = useMockStore((s) => s.wikiTags);
  const settings = useMockStore((s) => s.settings);
  const allNotes = useMemo(
    () => rawNotes.filter((n) => !n.isDeleted),
    [rawNotes],
  );

  const [kind, setKind] = useState<Kind>("notes");
  const [layout, setLayout] = useState<Layout>(
    settings.layoutDefaults.materialsLayout === "list" ? "row" : "card",
  );
  const [view, setView] = useState<"list" | "editor">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [sheet, setSheet] = useState<SheetType>(null);
  const [longPressTarget, setLongPressTarget] = useState<Note | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Note | null>(null);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const openHandledRef = useRef<string | null>(null);

  const filtered = useMemo(() => {
    return allNotes.filter((n) => {
      if (n.kind !== kind) return false;
      if (pinnedOnly && !n.pinned) return false;
      if (filterTagIds.length > 0) {
        const ok = filterTagIds.some((id) => n.wikiTagIds.includes(id));
        if (!ok) return false;
      }
      return true;
    });
  }, [allNotes, kind, filterTagIds, pinnedOnly]);

  const sorted = useMemo(
    () => sortNotes(filtered, sortKey),
    [filtered, sortKey],
  );
  const pinned = sorted.filter((n) => n.pinned);
  const unpinned = sorted.filter((n) => !n.pinned);

  const editing = editingId
    ? (allNotes.find((n) => n.id === editingId) ?? null)
    : null;

  useEffect(() => {
    if (view === "editor" && !editing) {
      setView("list");
      setEditingId(null);
    }
  }, [view, editing]);

  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) {
      openHandledRef.current = null;
      return;
    }
    if (openHandledRef.current === openId) return;
    const target = allNotes.find((n) => n.id === openId);
    if (!target) return;
    openHandledRef.current = openId;
    setKind(target.kind);
    setEditingId(openId);
    setView("editor");
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    setSearchParams(next, { replace: true });
  }, [searchParams, allNotes, setSearchParams]);

  const handleOpenNote = (id: string) => {
    setEditingId(id);
    setView("editor");
  };

  const handleFab = () => {
    if (kind === "daily") {
      const today = ymdToday();
      const d = getOrCreateDaily(today);
      handleOpenNote(d.id);
    } else {
      const note = addNote({
        kind: "notes",
        title: "",
        body: "",
        wikiTagIds: [],
        pinned: false,
      });
      handleOpenNote(note.id);
    }
  };

  const handleDeleteConfirmed = (note: Note) => {
    deleteNote(note.id);
    setConfirmDelete(null);
    setLongPressTarget(null);
    if (editingId === note.id) {
      setView("list");
      setEditingId(null);
    }
  };

  return (
    <div
      className="h-full flex flex-col relative overflow-hidden"
      style={{ background: C.base, color: C.text }}
    >
      <MaterialsToolbar
        kind={kind}
        onKindChange={setKind}
        layout={layout}
        onLayoutChange={setLayout}
        onOpenSort={() => setSheet("sort")}
        onOpenFilter={() => setSheet("filter")}
        filterActive={filterTagIds.length > 0}
      />

      <main
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ background: C.base }}
      >
        <ListBody
          layout={layout}
          pinned={pinned}
          unpinned={unpinned}
          tagById={mapTags(wikiTags)}
          onOpen={handleOpenNote}
          onLongPress={(n) => {
            setLongPressTarget(n);
            setSheet("itemMenu");
          }}
          swipeOpenId={swipeOpenId}
          setSwipeOpenId={setSwipeOpenId}
          onSwipeEdit={(n) => {
            setSwipeOpenId(null);
            handleOpenNote(n.id);
          }}
          onSwipePin={(n) => {
            togglePinNote(n.id);
            setSwipeOpenId(null);
          }}
          onSwipeDelete={(n) => {
            setConfirmDelete(n);
            setSwipeOpenId(null);
          }}
        />
      </main>

      {view === "list" && (
        <button
          type="button"
          onClick={handleFab}
          aria-label={kind === "daily" ? "今日の Daily を開く" : "新規 Note"}
          className="absolute right-4 bottom-20 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center transition-transform active:scale-95"
          style={{ background: C.mauve, color: C.base }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      {view === "editor" && editing && (
        <EditorView
          note={editing}
          tags={wikiTags}
          allNotes={allNotes}
          onBack={() => {
            setView("list");
            setEditingId(null);
          }}
          onOpenMenu={() => setSheet("editorMenu")}
          onOpenTagSheet={() => setSheet("tag")}
          onOpenMoodSheet={() => setSheet("mood")}
          onNavigate={(target) => {
            if (target.kind === "note" || target.kind === "daily") {
              setKind(target.kind === "daily" ? "daily" : "notes");
              setEditingId(target.id);
            } else {
              nav(`/schedule?focus=${target.id}`);
            }
          }}
        />
      )}

      <SortSheet
        open={sheet === "sort"}
        sortKey={sortKey}
        onPick={(k) => {
          setSortKey(k);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />

      <FilterSheet
        open={sheet === "filter"}
        tags={wikiTags}
        allNotes={allNotes}
        kind={kind}
        selectedIds={filterTagIds}
        onToggle={(id) =>
          setFilterTagIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
          )
        }
        onClear={() => setFilterTagIds([])}
        onClose={() => setSheet(null)}
      />

      <ItemMenuSheet
        open={sheet === "itemMenu"}
        note={longPressTarget}
        onPin={() => {
          if (!longPressTarget) return;
          togglePinNote(longPressTarget.id);
          setSheet(null);
          setLongPressTarget(null);
        }}
        onDuplicate={() => {
          if (!longPressTarget) return;
          duplicateNote(longPressTarget.id);
          setSheet(null);
          setLongPressTarget(null);
        }}
        onDelete={() => {
          if (!longPressTarget) return;
          setConfirmDelete(longPressTarget);
          setSheet(null);
        }}
        onClose={() => {
          setSheet(null);
          setLongPressTarget(null);
        }}
      />

      <EditorMenuSheet
        open={sheet === "editorMenu"}
        note={editing}
        onPin={() => {
          if (!editing) return;
          togglePinNote(editing.id);
          setSheet(null);
        }}
        onDuplicate={() => {
          if (!editing) return;
          const dup = duplicateNote(editing.id);
          setSheet(null);
          if (dup) setEditingId(dup.id);
        }}
        onShare={() => {
          if (!editing) return;
          console.log("[mock share]", editing.title);
          setSheet(null);
          alert(`「${editing.title || "(無題)"}」を共有 (mock)`);
        }}
        onDelete={() => {
          if (!editing) return;
          setConfirmDelete(editing);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />

      <MoodSheet
        open={sheet === "mood" && editing?.kind === "daily"}
        current={editing?.mood ?? "green"}
        onPick={(m) => {
          if (!editing) return;
          updateNote(editing.id, { mood: m });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />

      <TagSheet
        open={sheet === "tag" && !!editing}
        tags={wikiTags}
        selectedIds={editing?.wikiTagIds ?? []}
        onToggle={(id) => {
          if (!editing) return;
          if (editing.wikiTagIds.includes(id)) {
            detachTag(editing.id, id);
          } else {
            attachTag(editing.id, id);
          }
        }}
        onCreate={(name, color) => {
          if (!editing) return;
          const created = addWikiTag(name, color);
          attachTag(editing.id, created.id);
        }}
        onClose={() => setSheet(null)}
      />

      {confirmDelete && (
        <ConfirmModal
          title="このノートを削除しますか?"
          message={
            confirmDelete.kind === "daily"
              ? formatDailyTitle(confirmDelete)
              : confirmDelete.title || "(無題)"
          }
          danger
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDeleteConfirmed(confirmDelete)}
        />
      )}

      <Drawer open={sidebarOpen} onClose={closeSidebar} title="資料">
        <MaterialsSidebarContent
          wikiTags={wikiTags}
          allNotes={allNotes}
          kind={kind}
          filterTagIds={filterTagIds}
          onToggleTagFilter={(id) =>
            setFilterTagIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            )
          }
          onClearTagFilter={() => setFilterTagIds([])}
          sortKey={sortKey}
          onChangeSortKey={setSortKey}
          pinnedOnly={pinnedOnly}
          onTogglePinnedOnly={() => setPinnedOnly((v) => !v)}
        />
      </Drawer>
    </div>
  );
}

/**
 * Materials-specific sub-toolbar (IA v3 — under the shared AppHeader).
 *
 * The shared AppHeader owns menu / section title / cross-search; this strip keeps
 * the screen-specific Notes/Daily switch, card/row layout toggle, sort and filter.
 * The old in-header search bar is removed (the cross-search overlay replaces it);
 * a section-local title/body/tag search lives in the Drawer.
 */
function MaterialsToolbar({
  kind,
  onKindChange,
  layout,
  onLayoutChange,
  onOpenSort,
  onOpenFilter,
  filterActive,
}: {
  kind: Kind;
  onKindChange: (k: Kind) => void;
  layout: Layout;
  onLayoutChange: (l: Layout) => void;
  onOpenSort: () => void;
  onOpenFilter: () => void;
  filterActive: boolean;
}) {
  return (
    <header
      className="h-12 flex items-center px-1 shrink-0"
      style={{
        background: C.surface0,
        borderBottom: `1px solid ${C.surface1}`,
      }}
    >
      <div className="flex-1 grid grid-cols-2 gap-1 mx-1">
        {(["notes", "daily"] as Kind[]).map((k) => {
          const active = kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onKindChange(k)}
              className="h-9 text-sm transition active:opacity-70"
              style={{
                color: active ? C.text : C.overlay0,
                fontWeight: active ? 600 : 400,
                borderBottom: `2px solid ${active ? C.mauve : "transparent"}`,
              }}
            >
              {k === "notes" ? "Notes" : "Daily"}
            </button>
          );
        })}
      </div>
      <IconBtn
        onClick={() => onLayoutChange(layout === "card" ? "row" : "card")}
        ariaLabel="レイアウト切替"
        color={C.mauve}
      >
        {layout === "card" ? <LayoutGrid size={18} /> : <ListIcon size={18} />}
      </IconBtn>
      <IconBtn onClick={onOpenSort} ariaLabel="並び替え" color={C.text}>
        <ArrowUpDown size={18} />
      </IconBtn>
      <IconBtn
        onClick={onOpenFilter}
        ariaLabel="フィルタ"
        color={filterActive ? C.mauve : C.text}
      >
        <FilterIcon size={18} />
      </IconBtn>
    </header>
  );
}

/**
 * Section sidebar contents rendered inside the shared <Drawer>. Reuses the
 * existing Materials filter state (section-local search, tag filter, sort,
 * pinned-only). The Drawer's own scroll region is flex-1 overflow-y-auto.
 */
function MaterialsSidebarContent({
  wikiTags,
  allNotes,
  kind,
  filterTagIds,
  onToggleTagFilter,
  onClearTagFilter,
  sortKey,
  onChangeSortKey,
  pinnedOnly,
  onTogglePinnedOnly,
}: {
  wikiTags: WikiTag[];
  allNotes: Note[];
  kind: Kind;
  filterTagIds: string[];
  onToggleTagFilter: (id: string) => void;
  onClearTagFilter: () => void;
  sortKey: SortKey;
  onChangeSortKey: (k: SortKey) => void;
  pinnedOnly: boolean;
  onTogglePinnedOnly: () => void;
}) {
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of allNotes) {
      if (n.kind !== kind) continue;
      for (const id of n.wikiTagIds) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }, [allNotes, kind]);
  const visibleTags = wikiTags.filter((t) => (tagCounts.get(t.id) ?? 0) > 0);
  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "updatedAt", label: "更新日時" },
    { key: "createdAt", label: "作成日時" },
    { key: "title", label: "タイトル" },
  ];

  return (
    <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-3">
      <div className="flex flex-col gap-1.5">
        <span
          className="text-[10px] uppercase tracking-wider"
          style={{ color: C.subtext0 }}
        >
          並び替え
        </span>
        <div className="flex flex-col gap-1">
          {SORT_OPTIONS.map((o) => {
            const active = sortKey === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => onChangeSortKey(o.key)}
                className="min-h-[40px] px-3 rounded-md flex items-center justify-between text-left"
                style={{
                  background: active ? C.surface1 : C.surface0,
                  color: C.text,
                }}
              >
                <span className="text-sm">{o.label}</span>
                {active && <Check size={16} color={C.mauve} />}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onTogglePinnedOnly}
        className="min-h-[40px] px-3 rounded-md flex items-center gap-2 text-left"
        style={{
          background: pinnedOnly ? C.surface1 : C.surface0,
          color: C.text,
        }}
      >
        <Pin size={16} color={pinnedOnly ? C.peach : C.subtext0} />
        <span className="text-sm flex-1">ピン留めのみ</span>
        {pinnedOnly && <Check size={16} color={C.mauve} />}
      </button>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center">
          <span
            className="flex-1 text-[10px] uppercase tracking-wider"
            style={{ color: C.subtext0 }}
          >
            タグで絞り込み
          </span>
          {filterTagIds.length > 0 && (
            <button
              type="button"
              onClick={onClearTagFilter}
              className="text-xs px-2 h-7"
              style={{ color: C.mauve }}
            >
              クリア
            </button>
          )}
        </div>
        {visibleTags.length === 0 ? (
          <div className="px-1 py-2 text-xs" style={{ color: C.subtext0 }}>
            タグがありません
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {visibleTags.map((t) => {
              const selected = filterTagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onToggleTagFilter(t.id)}
                  className="min-h-[40px] px-3 rounded-md flex items-center gap-2 text-left"
                  style={{
                    background: selected ? C.surface1 : C.surface0,
                  }}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: t.color }}
                  />
                  <span className="text-sm flex-1" style={{ color: C.text }}>
                    #{t.name}
                  </span>
                  <span className="text-xs" style={{ color: C.subtext0 }}>
                    {tagCounts.get(t.id) ?? 0}
                  </span>
                  {selected && <Check size={16} color={C.mauve} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({
  onClick,
  ariaLabel,
  color,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="min-h-[44px] min-w-[44px] flex items-center justify-center"
      style={{ color }}
    >
      {children}
    </button>
  );
}

function ListBody({
  layout,
  pinned,
  unpinned,
  tagById,
  onOpen,
  onLongPress,
  swipeOpenId,
  setSwipeOpenId,
  onSwipeEdit,
  onSwipePin,
  onSwipeDelete,
}: {
  layout: Layout;
  pinned: Note[];
  unpinned: Note[];
  tagById: Map<string, WikiTag>;
  onOpen: (id: string) => void;
  onLongPress: (n: Note) => void;
  swipeOpenId: string | null;
  setSwipeOpenId: (id: string | null) => void;
  onSwipeEdit: (n: Note) => void;
  onSwipePin: (n: Note) => void;
  onSwipeDelete: (n: Note) => void;
}) {
  if (pinned.length === 0 && unpinned.length === 0) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center gap-2 text-sm"
        style={{ color: C.subtext0 }}
      >
        <BookOpen size={32} />
        <div>ノートがありません</div>
        <div className="text-xs">+ ボタンから作成</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      {pinned.length > 0 && (
        <>
          <SectionHeader label={`📌 ピン留め (${pinned.length})`} />
          <NoteList
            notes={pinned}
            layout={layout}
            tagById={tagById}
            onOpen={onOpen}
            onLongPress={onLongPress}
            swipeOpenId={swipeOpenId}
            setSwipeOpenId={setSwipeOpenId}
            onSwipeEdit={onSwipeEdit}
            onSwipePin={onSwipePin}
            onSwipeDelete={onSwipeDelete}
          />
        </>
      )}
      {unpinned.length > 0 && (
        <>
          {pinned.length > 0 && (
            <SectionHeader label={`すべて (${unpinned.length})`} />
          )}
          <NoteList
            notes={unpinned}
            layout={layout}
            tagById={tagById}
            onOpen={onOpen}
            onLongPress={onLongPress}
            swipeOpenId={swipeOpenId}
            setSwipeOpenId={setSwipeOpenId}
            onSwipeEdit={onSwipeEdit}
            onSwipePin={onSwipePin}
            onSwipeDelete={onSwipeDelete}
          />
        </>
      )}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      className="px-4 py-2 text-xs uppercase tracking-wider"
      style={{
        color: C.subtext0,
        background: C.mantle,
        borderBottom: `1px solid ${C.surface1}`,
      }}
    >
      {label}
    </div>
  );
}

function NoteList({
  notes,
  layout,
  tagById,
  onOpen,
  onLongPress,
  swipeOpenId,
  setSwipeOpenId,
  onSwipeEdit,
  onSwipePin,
  onSwipeDelete,
}: {
  notes: Note[];
  layout: Layout;
  tagById: Map<string, WikiTag>;
  onOpen: (id: string) => void;
  onLongPress: (n: Note) => void;
  swipeOpenId: string | null;
  setSwipeOpenId: (id: string | null) => void;
  onSwipeEdit: (n: Note) => void;
  onSwipePin: (n: Note) => void;
  onSwipeDelete: (n: Note) => void;
}) {
  const wrap = (n: Note, child: React.ReactNode) => (
    <SwipeRow
      key={n.id}
      note={n}
      layout={layout}
      open={swipeOpenId === n.id}
      anyOpen={swipeOpenId !== null}
      onRequestOpen={() => setSwipeOpenId(n.id)}
      onRequestClose={() => setSwipeOpenId(null)}
      onEdit={() => onSwipeEdit(n)}
      onPin={() => onSwipePin(n)}
      onDelete={() => onSwipeDelete(n)}
    >
      {child}
    </SwipeRow>
  );
  if (layout === "card") {
    return (
      <div className="flex flex-col gap-3 p-4">
        {notes.map((n) =>
          wrap(
            n,
            <NoteCard
              note={n}
              tagById={tagById}
              onOpen={() => onOpen(n.id)}
              onLongPress={() => onLongPress(n)}
            />,
          ),
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      {notes.map((n) =>
        wrap(
          n,
          <NoteRow
            note={n}
            tagById={tagById}
            onOpen={() => onOpen(n.id)}
            onLongPress={() => onLongPress(n)}
          />,
        ),
      )}
    </div>
  );
}

const SWIPE_THRESHOLD = 50;
const SWIPE_OPEN_WIDTH = 192;

function SwipeRow({
  note,
  layout,
  open,
  anyOpen,
  onRequestOpen,
  onRequestClose,
  onEdit,
  onPin,
  onDelete,
  children,
}: {
  note: Note;
  layout: Layout;
  open: boolean;
  anyOpen: boolean;
  onRequestOpen: () => void;
  onRequestClose: () => void;
  onEdit: () => void;
  onPin: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{
    x: number;
    y: number;
    locked: "horizontal" | "vertical" | null;
  } | null>(null);

  useEffect(() => {
    if (!dragging) setDx(open ? -SWIPE_OPEN_WIDTH : 0);
  }, [open, dragging]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY, locked: null };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const rawDx = e.clientX - startRef.current.x;
    const rawDy = e.clientY - startRef.current.y;
    if (startRef.current.locked === null) {
      const absX = Math.abs(rawDx);
      const absY = Math.abs(rawDy);
      if (absX < 8 && absY < 8) return;
      startRef.current.locked = absX > absY ? "horizontal" : "vertical";
    }
    if (startRef.current.locked !== "horizontal") return;
    const base = open ? -SWIPE_OPEN_WIDTH : 0;
    const next = Math.min(0, Math.max(-SWIPE_OPEN_WIDTH * 1.2, base + rawDx));
    setDx(next);
  };

  const settle = (commitOpen: boolean) => {
    setDragging(false);
    startRef.current = null;
    if (commitOpen) {
      setDx(-SWIPE_OPEN_WIDTH);
      onRequestOpen();
    } else {
      setDx(0);
      if (open) onRequestClose();
    }
  };

  const handlePointerUp = () => {
    if (!startRef.current) {
      setDragging(false);
      return;
    }
    if (startRef.current.locked !== "horizontal") {
      setDragging(false);
      startRef.current = null;
      return;
    }
    const commitOpen = -dx > SWIPE_THRESHOLD;
    settle(commitOpen);
  };

  const handlePointerCancel = () => {
    setDragging(false);
    startRef.current = null;
    setDx(open ? -SWIPE_OPEN_WIDTH : 0);
  };

  const handleContentClickCapture = (e: React.MouseEvent) => {
    if (open) {
      e.stopPropagation();
      e.preventDefault();
      onRequestClose();
    } else if (anyOpen) {
      e.stopPropagation();
      e.preventDefault();
      onRequestClose();
    }
  };

  const actionTitle = note.kind === "daily" ? "編集" : "名前変更";
  const isCard = layout === "card";

  return (
    <div
      className={`relative overflow-hidden ${isCard ? "rounded-2xl" : ""}`}
      style={{
        touchAction: "pan-y",
        background: isCard ? "transparent" : C.crust,
      }}
    >
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: SWIPE_OPEN_WIDTH }}
        aria-hidden={!open}
      >
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium"
          style={{ background: C.surface2, color: C.text }}
          aria-label={`${actionTitle} ${note.title || "(無題)"}`}
        >
          <FileText size={18} />
          {actionTitle}
        </button>
        <button
          type="button"
          onClick={onPin}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium"
          style={{ background: C.peach, color: C.crust }}
          aria-label={`${note.pinned ? "ピンを外す" : "ピン留め"} ${note.title || "(無題)"}`}
        >
          {note.pinned ? <PinOff size={18} /> : <Pin size={18} />}
          {note.pinned ? "外す" : "ピン"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium"
          style={{ background: C.red, color: C.crust }}
          aria-label={`削除 ${note.title || "(無題)"}`}
        >
          <Trash2 size={18} />
          削除
        </button>
      </div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={handleContentClickCapture}
        style={{
          transform: `translate3d(${dx}px, 0, 0)`,
          transition: dragging ? "none" : "transform 220ms ease",
          background: C.base,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function useLongPress(onLongPress: () => void, onTap: () => void) {
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  const start = (e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    firedRef.current = false;
    timerRef.current = window.setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, 600);
  };
  const cancel = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const end = () => {
    cancel();
    if (!firedRef.current) onTap();
  };
  const move = (e: React.PointerEvent) => {
    if (!startRef.current || timerRef.current === null) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) cancel();
  };
  return {
    onPointerDown: start,
    onPointerUp: end,
    onPointerMove: move,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
  };
}

function NoteCard({
  note,
  tagById,
  onOpen,
  onLongPress,
}: {
  note: Note;
  tagById: Map<string, WikiTag>;
  onOpen: () => void;
  onLongPress: () => void;
}) {
  const handlers = useLongPress(onLongPress, onOpen);
  const firstTag = note.wikiTagIds.map((id) => tagById.get(id)).find(Boolean);
  const accent = firstTag?.color ?? C.overlay0;
  return (
    <div
      {...handlers}
      className="rounded-2xl p-4 flex flex-col gap-2 select-none transition active:scale-[0.99]"
      style={{
        background: C.surface0,
        borderLeft: `3px solid ${accent}`,
        minHeight: 96,
      }}
    >
      <div className="flex items-start gap-2">
        <div
          className="flex-1 text-base font-medium truncate"
          style={{ color: C.text }}
        >
          {note.kind === "daily"
            ? formatDailyTitle(note)
            : note.title || "(無題)"}
        </div>
        {note.kind === "daily" && note.mood && (
          <span
            className="w-3 h-3 rounded-full shrink-0 mt-1"
            style={{ background: MOOD_COLOR[note.mood] }}
            aria-label={MOOD_LABEL[note.mood]}
          />
        )}
        {note.pinned && <Pin size={14} color={C.peach} />}
      </div>
      <div
        className="text-sm overflow-hidden"
        style={{
          color: C.subtext0,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const,
        }}
      >
        {note.excerpt || "(本文なし)"}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 flex-1 overflow-hidden">
          {note.wikiTagIds.slice(0, 3).map((id) => {
            const t = tagById.get(id);
            if (!t) return null;
            return (
              <span
                key={id}
                className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                style={{ background: `${t.color}22`, color: t.color }}
              >
                #{t.name}
              </span>
            );
          })}
          {note.kind === "daily" && (note.pomodoroSessions ?? 0) > 0 && (
            <span
              className="text-[10px] flex items-center gap-0.5"
              style={{ color: C.subtext0 }}
            >
              <TimerIcon size={10} /> {note.pomodoroSessions}
            </span>
          )}
        </div>
        <span className="text-[10px] shrink-0" style={{ color: C.subtext0 }}>
          {formatTimeAgo(note.updatedAt)}
        </span>
      </div>
    </div>
  );
}

function NoteRow({
  note,
  tagById,
  onOpen,
  onLongPress,
}: {
  note: Note;
  tagById: Map<string, WikiTag>;
  onOpen: () => void;
  onLongPress: () => void;
}) {
  const handlers = useLongPress(onLongPress, onOpen);
  const firstTag = note.wikiTagIds.map((id) => tagById.get(id)).find(Boolean);
  return (
    <div
      {...handlers}
      className="h-16 px-4 flex items-center gap-2 select-none transition active:bg-white/5"
      style={{ borderBottom: `1px solid ${C.surface1}` }}
    >
      {note.kind === "daily" && note.mood && (
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ background: MOOD_COLOR[note.mood] }}
        />
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-sm font-medium truncate"
            style={{ color: C.text }}
          >
            {note.kind === "daily"
              ? formatDailyTitle(note)
              : note.title || "(無題)"}
          </span>
          {note.pinned && <Pin size={12} color={C.peach} />}
        </div>
        <div
          className="text-xs truncate flex items-center gap-2"
          style={{ color: C.subtext0 }}
        >
          <span className="truncate flex-1">
            {note.excerpt || "(本文なし)"}
          </span>
          {firstTag && (
            <span
              className="text-[10px] shrink-0"
              style={{ color: firstTag.color }}
            >
              #{firstTag.name}
            </span>
          )}
        </div>
      </div>
      <span className="text-[10px] shrink-0" style={{ color: C.subtext0 }}>
        {formatTimeAgo(note.updatedAt)}
      </span>
    </div>
  );
}

function EditorView({
  note,
  tags,
  allNotes,
  onBack,
  onOpenMenu,
  onOpenTagSheet,
  onOpenMoodSheet,
  onNavigate,
}: {
  note: Note;
  tags: WikiTag[];
  allNotes: Note[];
  onBack: () => void;
  onOpenMenu: () => void;
  onOpenTagSheet: () => void;
  onOpenMoodSheet: () => void;
  onNavigate: (target: {
    kind: "note" | "daily" | "task" | "event" | "birthday" | "holiday";
    id: string;
  }) => void;
}) {
  const tagById = useMemo(() => mapTags(tags), [tags]);
  const [titleDraft, setTitleDraft] = useState(
    note.kind === "daily" ? formatDailyTitle(note) : note.title,
  );
  const [bodyDraft, setBodyDraft] = useState(note.body);
  const [saveStatus, setSaveStatus] = useState<"saved" | "editing" | "saving">(
    "saved",
  );
  const [suggestions, setSuggestions] = useState<
    { kind: string; id: string; title: string }[]
  >([]);
  const [composing, setComposing] = useState(false);
  const [backlinkOpen, setBacklinkOpen] = useState(true);
  const [bodyFocused, setBodyFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<number | null>(null);
  const noteIdRef = useRef(note.id);

  useEffect(() => {
    noteIdRef.current = note.id;
    setTitleDraft(note.kind === "daily" ? formatDailyTitle(note) : note.title);
    setBodyDraft(note.body);
    setSaveStatus("saved");
  }, [note.id, note.kind, note.title, note.body]);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  const flushSave = (patch: Partial<Pick<Note, "title" | "body">>) => {
    setSaveStatus("saving");
    updateNote(noteIdRef.current, patch);
    window.setTimeout(() => setSaveStatus("saved"), 200);
  };

  const queueSave = (patch: Partial<Pick<Note, "title" | "body">>) => {
    setSaveStatus("editing");
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => flushSave(patch), 500);
  };

  const handleTitleChange = (v: string) => {
    if (note.kind === "daily") return;
    setTitleDraft(v);
    queueSave({ title: v });
  };

  const handleBodyChange = (v: string) => {
    setBodyDraft(v);
    queueSave({ body: v });
    if (composing) {
      setSuggestions([]);
      return;
    }
    const caret = textareaRef.current?.selectionStart ?? v.length;
    const before = v.slice(0, caret);
    const m = /\[\[([^\[\]\n]*)$/.exec(before);
    if (m) {
      const sug = suggestLinks(m[1], 8).map((s) => ({
        kind: s.kind,
        id: s.id,
        title: s.title,
      }));
      setSuggestions(sug);
    } else {
      setSuggestions([]);
    }
  };

  const insertSuggestion = (title: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const before = bodyDraft.slice(0, caret);
    const after = bodyDraft.slice(caret);
    const m = /\[\[([^\[\]\n]*)$/.exec(before);
    if (!m) return;
    const start = caret - m[0].length;
    const replacement = `[[${title}]]`;
    const next = bodyDraft.slice(0, start) + replacement + after;
    setBodyDraft(next);
    queueSave({ body: next });
    setSuggestions([]);
    window.setTimeout(() => {
      ta.focus();
      const pos = start + replacement.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  const detectedLinks = useMemo(() => {
    const re = /\[\[([^\]\n]+)\]\]/g;
    const out: {
      raw: string;
      title: string;
      resolved: boolean;
      targetKind?: string;
      targetId?: string;
    }[] = [];
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(bodyDraft)) !== null) {
      const title = m[1].trim();
      if (seen.has(title)) continue;
      seen.add(title);
      const resolved = resolveLink(title);
      out.push({
        raw: m[0],
        title,
        resolved: !!resolved,
        targetKind: resolved?.kind,
        targetId: resolved?.id,
      });
    }
    return out;
  }, [bodyDraft]);

  const backlinks = useMemo(() => {
    const t =
      note.kind === "daily" ? formatDailyTitle(note) : note.title.trim();
    if (!t) return [];
    return findBacklinks(t).filter((b) => b.fromEntityId !== note.id);
  }, [note, allNotes]);

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{
        background: C.base,
        color: C.text,
        animation: "slide-in-right 300ms ease-out",
      }}
    >
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
      <header
        className="h-12 flex items-center px-1 shrink-0"
        style={{
          background: C.mantle,
          borderBottom: `1px solid ${C.surface1}`,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="戻る"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ChevronLeft size={22} color={C.text} />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <SaveStatusChip status={saveStatus} />
        </div>
        <IconBtn onClick={onOpenMenu} ariaLabel="メニュー" color={C.text}>
          <MoreHorizontal size={20} />
        </IconBtn>
      </header>

      <div className="flex-1 overflow-auto p-3 flex flex-col gap-3 relative">
        <input
          value={titleDraft}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder={note.kind === "daily" ? "日付" : "タイトル"}
          disabled={note.kind === "daily"}
          className="text-xl font-semibold bg-transparent outline-none"
          style={{
            color: C.text,
            borderBottom: `2px solid ${C.surface1}`,
            paddingBottom: 4,
          }}
        />

        {note.kind === "daily" && (
          <button
            type="button"
            onClick={onOpenMoodSheet}
            className="self-start h-9 px-3 rounded-full flex items-center gap-2 text-xs"
            style={{
              background: C.surface0,
              color: C.text,
              border: `1px solid ${C.surface1}`,
            }}
          >
            <span
              className="w-3 h-3 rounded-full"
              style={{ background: MOOD_COLOR[note.mood ?? "green"] }}
            />
            {MOOD_LABEL[note.mood ?? "green"]}
          </button>
        )}

        <div className="flex items-center flex-wrap gap-2">
          {note.wikiTagIds.map((id) => {
            const t = tagById.get(id);
            if (!t) return null;
            return (
              <span
                key={id}
                className="h-7 px-2 rounded-full text-xs flex items-center gap-1"
                style={{
                  background: `${t.color}22`,
                  color: t.color,
                }}
              >
                #{t.name}
                <button
                  type="button"
                  onClick={() => detachTag(note.id, id)}
                  aria-label={`#${t.name} を外す`}
                  className="opacity-70 active:opacity-100"
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={onOpenTagSheet}
            aria-label="タグを追加"
            className="h-7 px-2 rounded-full text-xs flex items-center gap-1"
            style={{
              background: C.surface0,
              color: C.subtext0,
              border: `1px dashed ${C.surface1}`,
            }}
          >
            <Plus size={12} /> 追加
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={bodyDraft}
          onChange={(e) => handleBodyChange(e.target.value)}
          onFocus={() => setBodyFocused(true)}
          onBlur={() => setBodyFocused(false)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={(e) => {
            setComposing(false);
            handleBodyChange(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Escape") setSuggestions([]);
            if (e.key === "Enter" && suggestions.length > 0 && !e.shiftKey) {
              e.preventDefault();
              insertSuggestion(suggestions[0].title);
            }
          }}
          placeholder="ここに書く..."
          rows={12}
          className="font-mono text-sm leading-relaxed bg-transparent outline-none p-2 rounded-md"
          style={{
            color: C.text,
            border: `1px solid ${C.surface1}`,
            background: C.crust,
            minHeight: 200,
            paddingBottom: 72, // アクセサリバー高 (≈ 44) + 余白
            resize: "vertical",
          }}
        />

        {suggestions.length > 0 && (
          <div
            className="rounded-md overflow-hidden"
            style={{
              background: C.surface0,
              border: `1px solid ${C.surface1}`,
            }}
          >
            <div
              className="px-3 py-1.5 text-[10px] uppercase tracking-wider"
              style={{ color: C.subtext0, background: C.mantle }}
            >
              [[ リンク候補 (Enter で確定)
            </div>
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => insertSuggestion(s.title)}
                className="w-full min-h-[44px] px-3 flex items-center gap-2 text-left"
                style={{ borderTop: `1px solid ${C.surface1}` }}
              >
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    background: C.surface1,
                    color: C.subtext1,
                  }}
                >
                  {s.kind === "note"
                    ? "Note"
                    : s.kind === "daily"
                      ? "Daily"
                      : s.kind === "task"
                        ? "Task"
                        : "Event"}
                </span>
                <span className="text-sm truncate" style={{ color: C.text }}>
                  {s.title}
                </span>
              </button>
            ))}
          </div>
        )}

        {detectedLinks.length > 0 && (
          <section className="flex flex-col gap-1">
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{ color: C.subtext0 }}
            >
              本文中のリンク ({detectedLinks.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {detectedLinks.map((l) => (
                <button
                  key={l.title}
                  type="button"
                  onClick={() => {
                    if (l.resolved && l.targetKind && l.targetId) {
                      onNavigate({
                        kind: l.targetKind as
                          | "note"
                          | "daily"
                          | "task"
                          | "event"
                          | "birthday"
                          | "holiday",
                        id: l.targetId,
                      });
                    }
                  }}
                  disabled={!l.resolved}
                  className="text-xs px-2 py-1 rounded-md disabled:cursor-not-allowed"
                  style={{
                    color: l.resolved ? C.sky : C.red,
                    background: C.surface0,
                    border: `1px solid ${l.resolved ? C.sky : C.red}66`,
                    textDecoration: "underline",
                  }}
                >
                  [[{l.title}]]
                </button>
              ))}
            </div>
          </section>
        )}

        {backlinks.length > 0 && (
          <section className="flex flex-col">
            <button
              type="button"
              onClick={() => setBacklinkOpen((v) => !v)}
              className="h-10 flex items-center gap-2 text-xs px-1"
              style={{ color: C.subtext1 }}
            >
              {backlinkOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
              このノートを参照しているもの ({backlinks.length})
            </button>
            {backlinkOpen &&
              backlinks.map((b, i) => (
                <button
                  key={`${b.fromEntityId}-${i}`}
                  type="button"
                  onClick={() =>
                    onNavigate({
                      kind: b.fromKind,
                      id: b.fromEntityId,
                    })
                  }
                  className="min-h-[56px] flex items-start gap-2 px-3 py-2 text-left"
                  style={{ borderTop: `1px solid ${C.surface1}` }}
                >
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      background: C.surface1,
                      color: C.subtext1,
                    }}
                  >
                    {b.fromKind === "note"
                      ? "Note"
                      : b.fromKind === "daily"
                        ? "Daily"
                        : b.fromKind === "task"
                          ? "Task"
                          : "Event"}
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span
                      className="text-sm font-medium truncate"
                      style={{ color: C.text }}
                    >
                      {b.fromTitle || "(無題)"}
                    </span>
                    <span
                      className="text-[10px] truncate"
                      style={{ color: C.subtext0 }}
                    >
                      {b.snippet}
                    </span>
                  </div>
                </button>
              ))}
          </section>
        )}
      </div>

      {/* iOS 風キーボード追従アクセサリバー
          Editor 表示中は常時可視、focus 中は visualViewport で
          キーボード上に追従する */}
      <KeyboardAccessoryBar
        textareaRef={textareaRef}
        focused={bodyFocused}
        bodyDraft={bodyDraft}
        onChangeBody={handleBodyChange}
        onOpenTagSheet={onOpenTagSheet}
      />
    </div>
  );
}

/**
 * Editor 用キーボード追従ツールバー。
 *
 * - textarea のフォーカス時のみ visualViewport の上に追従。非フォーカス時は
 *   画面下沿いに常時可視 (PC ブラウザでも見える)
 * - 各ボタンは Markdown 記法を選択範囲または現在行に挿入する。`onChangeBody`
 *   経由で既存の handleBodyChange を呼ぶので [[link]] 補完など既存機能を
 *   保ったまま動く
 * - onMouseDown=preventDefault でフォーカスを保持
 */
function KeyboardAccessoryBar({
  textareaRef,
  focused,
  bodyDraft,
  onChangeBody,
  onOpenTagSheet,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  focused: boolean;
  bodyDraft: string;
  onChangeBody: (v: string) => void;
  onOpenTagSheet: () => void;
}) {
  const BAR_HEIGHT = 44;
  const [bottom, setBottom] = useState(0);
  const [commandOpen, setCommandOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [lineEmpty, setLineEmpty] = useState(false);

  // textarea の現在カーソル行が空白だけかを判定。focus 喪失時は false。
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || !focused) {
      setLineEmpty(false);
      return undefined;
    }
    const recalc = () => {
      const t = textareaRef.current;
      if (!t || document.activeElement !== t) {
        setLineEmpty(false);
        return;
      }
      const start = t.selectionStart;
      const before = bodyDraft.slice(0, start);
      const lineStart = before.lastIndexOf("\n") + 1;
      const nextNL = bodyDraft.indexOf("\n", start);
      const lineEnd = nextNL === -1 ? bodyDraft.length : nextNL;
      const line = bodyDraft.slice(lineStart, lineEnd);
      setLineEmpty(line.trim() === "" && t.selectionStart === t.selectionEnd);
    };
    recalc();
    document.addEventListener("selectionchange", recalc);
    return () => document.removeEventListener("selectionchange", recalc);
  }, [bodyDraft, focused, textareaRef]);

  // textarea の IME 状態。composition 中はヒント非表示 + `/` 起動を抑止
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return undefined;
    const onStart = () => setComposing(true);
    const onEnd = () => setComposing(false);
    ta.addEventListener("compositionstart", onStart);
    ta.addEventListener("compositionend", onEnd);
    return () => {
      ta.removeEventListener("compositionstart", onStart);
      ta.removeEventListener("compositionend", onEnd);
    };
  }, [textareaRef]);

  // `/` キーで空行時にコマンドメニューを起動 (M-3)。IME 中は無視。
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || !focused) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      if (e.isComposing) return;
      const t = textareaRef.current;
      if (!t || document.activeElement !== t) return;
      const start = t.selectionStart;
      const before = bodyDraft.slice(0, start);
      const lineStart = before.lastIndexOf("\n") + 1;
      const nextNL = bodyDraft.indexOf("\n", start);
      const lineEnd = nextNL === -1 ? bodyDraft.length : nextNL;
      const line = bodyDraft.slice(lineStart, lineEnd);
      if (line.trim() !== "" || t.selectionStart !== t.selectionEnd) return;
      e.preventDefault();
      setCommandOpen(true);
    };
    ta.addEventListener("keydown", onKeyDown);
    return () => ta.removeEventListener("keydown", onKeyDown);
  }, [bodyDraft, focused, textareaRef]);

  const hintVisible = focused && !composing && lineEmpty && !commandOpen;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      if (!focused) {
        setBottom(0);
        return;
      }
      const vv = window.visualViewport;
      if (!vv) {
        setBottom(0);
        return;
      }
      const offset = window.innerHeight - vv.height - vv.offsetTop;
      setBottom(offset > 1 ? offset : 0);
    };
    update();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
      return () => {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      };
    }
    return undefined;
  }, [focused]);

  const guard = (e: React.MouseEvent) => e.preventDefault();

  const applySelectionAndCursor = (
    ta: HTMLTextAreaElement,
    next: string,
    cursorPos: number,
  ) => {
    onChangeBody(next);
    window.setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  // 選択範囲を left + selected + right で囲む。選択なしならカーソル位置に
  // left + right を挿入してカーソルを中間に。
  const wrapSelection = (left: string, right: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = bodyDraft.slice(0, start);
    const selected = bodyDraft.slice(start, end);
    const after = bodyDraft.slice(end);
    const next = before + left + selected + right + after;
    const cursor =
      selected.length > 0
        ? start + left.length + selected.length + right.length
        : start + left.length;
    applySelectionAndCursor(ta, next, cursor);
  };

  // 現在行を block (例: ``` ``` / --- ) に置換 or 挿入する。
  // 空行ならその場で置換、非空行なら次行に新規挿入する。カーソルは block 内部に移す。
  const insertBlock = (block: string, innerCursorOffset: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const before = bodyDraft.slice(0, start);
    const lineStart = before.lastIndexOf("\n") + 1;
    const nextNL = bodyDraft.indexOf("\n", start);
    const lineEnd = nextNL === -1 ? bodyDraft.length : nextNL;
    const line = bodyDraft.slice(lineStart, lineEnd);
    const emptyLine = line.trim() === "";
    const prefix = emptyLine ? "" : "\n";
    const insertion = prefix + block;
    const next =
      bodyDraft.slice(0, emptyLine ? lineStart : lineEnd) +
      insertion +
      bodyDraft.slice(emptyLine ? lineEnd : lineEnd);
    const insertionStart = emptyLine ? lineStart : lineEnd;
    const cursor = insertionStart + prefix.length + innerCursorOffset;
    applySelectionAndCursor(ta, next, cursor);
  };

  // 現在カーソル行の先頭に prefix を付ける。既に同じ prefix がついていれば
  // 取り除く (トグル動作)。他の見出し / 引用 / リスト記号があれば置換。
  const toggleLinePrefix = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const before = bodyDraft.slice(0, start);
    const lineStart = before.lastIndexOf("\n") + 1;
    const nextNL = bodyDraft.indexOf("\n", start);
    const lineEnd = nextNL === -1 ? bodyDraft.length : nextNL;
    const line = bodyDraft.slice(lineStart, lineEnd);
    let newLine: string;
    if (line.startsWith(prefix)) {
      newLine = line.slice(prefix.length);
    } else {
      // 既存の `#`/`##`/`>`/`-` 始まりは剥がしてから上書き
      const stripped = line.replace(
        /^(#{1,3}\s|>\s|-\s\[\s\]\s|-\s|\d+\.\s)/,
        "",
      );
      newLine = prefix + stripped;
    }
    const next =
      bodyDraft.slice(0, lineStart) + newLine + bodyDraft.slice(lineEnd);
    const cursor = start + (newLine.length - line.length);
    applySelectionAndCursor(ta, next, Math.max(lineStart, cursor));
  };

  const runCommand = (action: () => void) => {
    setCommandOpen(false);
    action();
  };

  const slashCommands: {
    key: string;
    icon: React.ReactNode;
    label: string;
    hint: string;
    onAction: () => void;
  }[] = [
    {
      key: "h1",
      icon: <Heading1 size={18} />,
      label: "見出し1",
      hint: "# 大見出し",
      onAction: () => toggleLinePrefix("# "),
    },
    {
      key: "h2",
      icon: <Heading2 size={18} />,
      label: "見出し2",
      hint: "## 中見出し",
      onAction: () => toggleLinePrefix("## "),
    },
    {
      key: "h3",
      icon: <Heading2 size={16} />,
      label: "見出し3",
      hint: "### 小見出し",
      onAction: () => toggleLinePrefix("### "),
    },
    {
      key: "bullet",
      icon: <ListIcon size={18} />,
      label: "箇条書き",
      hint: "- 項目",
      onAction: () => toggleLinePrefix("- "),
    },
    {
      key: "ordered",
      icon: <ListIcon size={18} />,
      label: "番号付きリスト",
      hint: "1. 項目",
      onAction: () => toggleLinePrefix("1. "),
    },
    {
      key: "task",
      icon: <Check size={18} />,
      label: "タスクリスト",
      hint: "- [ ] タスク",
      onAction: () => toggleLinePrefix("- [ ] "),
    },
    {
      key: "quote",
      icon: <Quote size={18} />,
      label: "引用",
      hint: "> 引用文",
      onAction: () => toggleLinePrefix("> "),
    },
    {
      key: "codeblock",
      icon: <Code size={18} />,
      label: "コードブロック",
      hint: "``` ```",
      onAction: () => insertBlock("```\n\n```", 4),
    },
    {
      key: "divider",
      icon: <ChevronDown size={18} />,
      label: "区切り線",
      hint: "---",
      onAction: () => insertBlock("---\n", 4),
    },
    {
      key: "image",
      icon: <FileText size={18} />,
      label: "画像リンク",
      hint: "![](url)",
      onAction: () => wrapSelection("![", "](url)"),
    },
  ];

  const items: {
    key: string;
    icon: React.ReactNode;
    label: string;
    onAction: () => void;
  }[] = [
    {
      key: "h1",
      icon: <Heading1 size={18} />,
      label: "見出し1",
      onAction: () => toggleLinePrefix("# "),
    },
    {
      key: "h2",
      icon: <Heading2 size={18} />,
      label: "見出し2",
      onAction: () => toggleLinePrefix("## "),
    },
    {
      key: "bold",
      icon: <Bold size={17} />,
      label: "太字",
      onAction: () => wrapSelection("**", "**"),
    },
    {
      key: "italic",
      icon: <Italic size={17} />,
      label: "斜体",
      onAction: () => wrapSelection("*", "*"),
    },
    {
      key: "list",
      icon: <ListIcon size={17} />,
      label: "リスト",
      onAction: () => toggleLinePrefix("- "),
    },
    {
      key: "quote",
      icon: <Quote size={17} />,
      label: "引用",
      onAction: () => toggleLinePrefix("> "),
    },
    {
      key: "code",
      icon: <Code size={17} />,
      label: "コード",
      onAction: () => wrapSelection("`", "`"),
    },
    {
      key: "link",
      icon: <Link2 size={17} />,
      label: "リンク",
      onAction: () => wrapSelection("[[", "]]"),
    },
    {
      key: "tag",
      icon: <Hash size={17} />,
      label: "タグ",
      onAction: onOpenTagSheet,
    },
  ];

  // iOS Form Assistant Bar (= 左 ↑↓ / 右 ✓ の半透明角丸) は OS が描画する
  // 領域で Web からは置換不可。そのすぐ上に角丸 + 半透明 blur + 薄いシャドウ
  // のフローティングバーとして表示し、見た目のトーンを揃える。
  return (
    <div
      className="absolute left-0 right-0 z-[60] flex flex-col items-center transition-[bottom] duration-150 ease-out"
      style={{
        bottom,
        paddingBottom: 6,
        pointerEvents: "none",
      }}
    >
      {hintVisible && (
        <button
          type="button"
          onMouseDown={guard}
          onClick={() => setCommandOpen(true)}
          className="mb-2 rounded-full pointer-events-auto flex items-center gap-1.5 px-3 py-1.5"
          style={{
            background: "rgba(48, 48, 70, 0.78)",
            backdropFilter: "saturate(180%) blur(24px)",
            WebkitBackdropFilter: "saturate(180%) blur(24px)",
            border: "1px solid rgba(203,166,247,0.30)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.28)",
            color: C.subtext1,
          }}
          aria-label="スラッシュコマンドを開く"
        >
          <span
            className="font-mono text-[11px] rounded px-1"
            style={{ background: "rgba(255,255,255,0.08)", color: C.mauve }}
          >
            /
          </span>
          <span className="text-xs">コマンドを挿入</span>
        </button>
      )}
      {commandOpen && (
        <div
          className="mb-2 rounded-2xl pointer-events-auto overflow-hidden"
          onMouseDown={guard}
          style={{
            background: "rgba(48, 48, 70, 0.92)",
            backdropFilter: "saturate(180%) blur(24px)",
            WebkitBackdropFilter: "saturate(180%) blur(24px)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.40)",
            maxWidth: "calc(100% - 12px)",
            width: 280,
            maxHeight: "60vh",
          }}
          role="menu"
          aria-label="スラッシュコマンド"
        >
          <div
            className="flex flex-col py-1 overflow-y-auto"
            style={{ maxHeight: "calc(60vh - 2px)" }}
          >
            {slashCommands.map((cmd) => (
              <button
                key={cmd.key}
                type="button"
                onMouseDown={guard}
                onClick={() => runCommand(cmd.onAction)}
                className="flex items-center gap-3 px-3 py-2 text-left active:bg-white/10 transition-colors"
                role="menuitem"
                aria-label={cmd.label}
              >
                <span
                  className="flex items-center justify-center shrink-0 rounded-md"
                  style={{
                    width: 28,
                    height: 28,
                    background: "rgba(255,255,255,0.06)",
                    color: C.subtext1,
                  }}
                >
                  {cmd.icon}
                </span>
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-sm" style={{ color: C.text }}>
                    {cmd.label}
                  </span>
                  <span
                    className="text-[11px] truncate"
                    style={{ color: C.subtext0 }}
                  >
                    {cmd.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div
        className="px-1 py-0.5 flex items-center gap-0.5 overflow-x-auto rounded-2xl pointer-events-auto"
        style={{
          background: "rgba(48, 48, 70, 0.78)",
          backdropFilter: "saturate(180%) blur(24px)",
          WebkitBackdropFilter: "saturate(180%) blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 6px 18px rgba(0,0,0,0.32)",
          maxWidth: "calc(100% - 12px)",
          height: BAR_HEIGHT,
        }}
      >
        <button
          type="button"
          onMouseDown={guard}
          onClick={() => setCommandOpen((v) => !v)}
          className="rounded-lg transition-colors flex-shrink-0 active:scale-95 flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            color: commandOpen ? C.mauve : C.subtext1,
            background: commandOpen ? "rgba(203,166,247,0.12)" : "transparent",
          }}
          aria-label="ブロックを挿入"
          aria-expanded={commandOpen}
          aria-haspopup="menu"
        >
          <Plus size={18} />
        </button>
        <div
          className="mx-0.5 self-stretch flex-shrink-0"
          style={{ width: 1, background: "rgba(255,255,255,0.08)" }}
          aria-hidden="true"
        />
        {items.map((b) => (
          <button
            key={b.key}
            type="button"
            onMouseDown={guard}
            onClick={b.onAction}
            className="rounded-lg transition-colors flex-shrink-0 active:scale-95 flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              color: C.subtext1,
            }}
            aria-label={b.label}
          >
            {b.icon}
          </button>
        ))}
        <div
          className="mx-1 self-stretch flex-shrink-0"
          style={{ width: 1, background: "rgba(255,255,255,0.08)" }}
          aria-hidden="true"
        />
        <button
          type="button"
          onMouseDown={guard}
          onClick={() => textareaRef.current?.blur()}
          className="rounded-lg transition-colors flex-shrink-0 flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            color: C.subtext0,
          }}
          aria-label="キーボードを閉じる"
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
}

function SaveStatusChip({
  status,
}: {
  status: "editing" | "saving" | "saved";
}) {
  const meta =
    status === "editing"
      ? { color: C.yellow, label: "編集中", icon: null }
      : status === "saving"
        ? { color: C.sky, label: "保存中", icon: <ChevronUp size={10} /> }
        : { color: C.green, label: "保存済み", icon: <Check size={10} /> };
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
      style={{ background: `${meta.color}22`, color: meta.color }}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

function SortSheet({
  open,
  sortKey,
  onPick,
  onClose,
}: {
  open: boolean;
  sortKey: SortKey;
  onPick: (k: SortKey) => void;
  onClose: () => void;
}) {
  const items: { id: SortKey; label: string }[] = [
    { id: "updatedAt", label: "更新日時 (新しい順)" },
    { id: "createdAt", label: "作成日時 (新しい順)" },
    { id: "title", label: "タイトル (五十音順)" },
  ];
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="並び替え"
      snapPoints={[0.5]}
    >
      <div className="flex flex-col">
        {items.map((it) => {
          const active = it.id === sortKey;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onPick(it.id)}
              className="min-h-[48px] px-3 flex items-center gap-2 text-left"
              style={{ borderBottom: `1px solid ${C.surface1}` }}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{
                  background: active ? C.mauve : "transparent",
                  border: `1px solid ${active ? C.mauve : C.overlay0}`,
                }}
              />
              <span className="text-sm flex-1" style={{ color: C.text }}>
                {it.label}
              </span>
              {active && <Check size={14} color={C.green} />}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

function FilterSheet({
  open,
  tags,
  allNotes,
  kind,
  selectedIds,
  onToggle,
  onClear,
  onClose,
}: {
  open: boolean;
  tags: WikiTag[];
  allNotes: Note[];
  kind: Kind;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of allNotes) {
      if (n.kind !== kind) continue;
      for (const id of n.wikiTagIds) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [allNotes, kind]);
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="フィルタ"
      rightLabel={selectedIds.length > 0 ? "すべてクリア" : undefined}
      onRightClick={onClear}
    >
      <div
        className="px-3 py-2 text-[11px] uppercase tracking-wider"
        style={{ color: C.subtext0 }}
      >
        タグ
      </div>
      <div className="flex flex-col">
        {tags.map((t) => {
          const selected = selectedIds.includes(t.id);
          const count = counts.get(t.id) ?? 0;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onToggle(t.id)}
              className="min-h-[44px] px-3 flex items-center gap-2 text-left"
              style={{
                background: selected ? C.surface0 : "transparent",
                borderBottom: `1px solid ${C.surface1}`,
              }}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: t.color }}
              />
              <span className="text-sm flex-1" style={{ color: C.text }}>
                #{t.name}
              </span>
              <span className="text-[10px] mr-2" style={{ color: C.subtext0 }}>
                ({count})
              </span>
              {selected && <Check size={14} color={C.green} />}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

function ItemMenuSheet({
  open,
  note,
  onPin,
  onDuplicate,
  onDelete,
  onClose,
}: {
  open: boolean;
  note: Note | null;
  onPin: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  // 閉アニメ中 (open=false → unmount) に note が null になっても中身が
  // 消えてガクつかないよう、最後に開いた対象を保持して表示する。
  const lastRef = useRef<Note | null>(note);
  if (note) lastRef.current = note;
  const shown = note ?? lastRef.current;
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        shown
          ? shown.kind === "daily"
            ? formatDailyTitle(shown)
            : shown.title || "(無題)"
          : ""
      }
      snapPoints={[0.5]}
    >
      <MenuRow
        icon={shown?.pinned ? <PinOff size={18} /> : <Pin size={18} />}
        label={shown?.pinned ? "ピン留めを解除" : "ピン留め"}
        onClick={onPin}
      />
      {shown?.kind === "notes" && (
        <MenuRow icon={<Copy size={18} />} label="複製" onClick={onDuplicate} />
      )}
      <MenuRow
        icon={<Trash2 size={18} />}
        label="削除"
        onClick={onDelete}
        danger
      />
    </BottomSheet>
  );
}

function EditorMenuSheet({
  open,
  note,
  onPin,
  onDuplicate,
  onShare,
  onDelete,
  onClose,
}: {
  open: boolean;
  note: Note | null;
  onPin: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  // 閉アニメ中に note が null へ落ちても表示が崩れないよう最後の対象を保持。
  const lastRef = useRef<Note | null>(note);
  if (note) lastRef.current = note;
  const shown = note ?? lastRef.current;
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="メニュー"
      snapPoints={[0.5]}
    >
      <MenuRow
        icon={shown?.pinned ? <PinOff size={18} /> : <Pin size={18} />}
        label={shown?.pinned ? "ピン留めを解除" : "ピン留め"}
        onClick={onPin}
      />
      {shown?.kind === "notes" && (
        <MenuRow icon={<Copy size={18} />} label="複製" onClick={onDuplicate} />
      )}
      <MenuRow
        icon={<Share2 size={18} />}
        label="共有 (mock)"
        onClick={onShare}
      />
      <MenuRow
        icon={<Trash2 size={18} />}
        label="削除"
        onClick={onDelete}
        danger
      />
    </BottomSheet>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[56px] px-4 flex items-center gap-3 text-left"
      style={{
        color: danger ? C.red : C.text,
        borderBottom: `1px solid ${C.surface1}`,
      }}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}

function MoodSheet({
  open,
  current,
  onPick,
  onClose,
}: {
  open: boolean;
  current: Mood;
  onPick: (m: Mood) => void;
  onClose: () => void;
}) {
  // 閉アニメ中も選択中マークが安定するよう、open 中の値を保持する。
  const lastRef = useRef<Mood>(current);
  if (open) lastRef.current = current;
  const shown = open ? current : lastRef.current;
  const items: Mood[] = ["green", "sky", "yellow", "peach", "red"];
  return (
    <BottomSheet open={open} onClose={onClose} title="気分">
      {items.map((m) => {
        const active = shown === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onPick(m)}
            className="w-full min-h-[56px] px-4 flex items-center gap-3 text-left"
            style={{
              background: active ? C.surface0 : "transparent",
              borderBottom: `1px solid ${C.surface1}`,
            }}
          >
            <span
              className="w-6 h-6 rounded-full"
              style={{ background: MOOD_COLOR[m] }}
            />
            <span className="text-base flex-1" style={{ color: C.text }}>
              {MOOD_LABEL[m]}
            </span>
            {active && <Check size={16} color={C.green} />}
          </button>
        );
      })}
    </BottomSheet>
  );
}

function TagSheet({
  open,
  tags,
  selectedIds,
  onToggle,
  onCreate,
  onClose,
}: {
  open: boolean;
  tags: WikiTag[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onCreate: (name: string, color: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [newColor, setNewColor] = useState<string>(TAG_COLOR_OPTIONS[0]);
  // 閉アニメ中 (open=false) に selectedIds が空配列へ落ちても選択マークが
  // 消えてガクつかないよう、open 中の選択集合を保持する。
  const lastSelectedRef = useRef<string[]>(selectedIds);
  if (open) lastSelectedRef.current = selectedIds;
  const shownSelectedIds = open ? selectedIds : lastSelectedRef.current;
  // 常時マウント化に伴い、開くたびに検索文字列をリセットして
  // 前回の入力が残らないようにする (条件描画時は毎回 mount でクリアされていた)。
  useEffect(() => {
    if (open) {
      setQuery("");
      setComposing(false);
    }
  }, [open]);
  const filtered = useMemo(() => {
    const q = (composing ? "" : query).trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, query, composing]);
  const canCreate =
    !composing &&
    query.trim().length > 0 &&
    !tags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="タグを追加"
      initialSnapIndex={1}
    >
      <div
        className="p-3 sticky top-0"
        style={{
          background: C.mantle,
          borderBottom: `1px solid ${C.surface1}`,
        }}
      >
        <div className="flex items-center gap-2">
          <select
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            aria-label="色"
            className="h-10 rounded-md px-2 text-sm shrink-0"
            style={{
              background: C.surface0,
              color: newColor,
              border: `1px solid ${C.surface1}`,
              fontWeight: 700,
            }}
          >
            {TAG_COLOR_OPTIONS.map((c) => (
              <option key={c} value={c}>
                ●
              </option>
            ))}
          </select>
          <div
            className="flex-1 flex items-center h-10 rounded-md px-2 gap-2"
            style={{
              background: C.surface0,
              border: `1px solid ${C.surface1}`,
            }}
          >
            <Search size={16} color={C.subtext0} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              placeholder="タグを検索 / 新規作成"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: C.text }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="クリア"
              >
                <X size={14} color={C.subtext0} />
              </button>
            )}
          </div>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              onCreate(query.trim(), newColor);
              setQuery("");
            }}
            className="mt-2 w-full h-9 rounded-md text-sm font-medium flex items-center justify-center gap-1"
            style={{ background: C.mauve, color: C.base }}
          >
            <Plus size={14} /> 「{query.trim()}」を作成
          </button>
        )}
      </div>
      <div className="flex flex-col">
        {filtered.length === 0 && !canCreate && (
          <div
            className="px-3 py-4 text-sm text-center"
            style={{ color: C.subtext0 }}
          >
            該当タグなし
          </div>
        )}
        {filtered.map((t) => {
          const selected = shownSelectedIds.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onToggle(t.id)}
              className="min-h-[44px] px-3 flex items-center gap-2 text-left"
              style={{
                background: selected ? C.surface0 : "transparent",
                borderBottom: `1px solid ${C.surface1}`,
              }}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: t.color }}
              />
              <span className="text-sm flex-1" style={{ color: C.text }}>
                #{t.name}
              </span>
              {selected && <Check size={14} color={C.green} />}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

function ConfirmModal({
  title,
  message,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  message?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        aria-label="閉じる"
        className="fixed inset-0"
        style={{ background: C.crust, opacity: 0.7 }}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-xs rounded-2xl p-4 flex flex-col gap-3 pointer-events-auto"
          style={{ background: C.base, border: `1px solid ${C.surface1}` }}
        >
          <div className="text-sm font-medium" style={{ color: C.text }}>
            {title}
          </div>
          {message && (
            <div className="text-xs truncate" style={{ color: C.subtext0 }}>
              {message}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-10 rounded-md text-sm"
              style={{ border: `1px solid ${C.surface1}`, color: C.text }}
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="h-10 rounded-md text-sm font-medium"
              style={{ background: danger ? C.red : C.mauve, color: C.base }}
            >
              実行
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
