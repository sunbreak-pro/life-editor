import {
  ArrowUpDown,
  BookOpen,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  FileText,
  Filter as FilterIcon,
  LayoutGrid,
  List as ListIcon,
  Menu,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings as SettingsIcon,
  Share2,
  Timer as TimerIcon,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
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
import type { Mood, Note, ScheduleItem, WikiTag } from "../lib/types";
import { findBacklinks, resolveLink, suggestLinks } from "../lib/wikiLink";

const C = {
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
  surface0: "#313244",
  surface1: "#45475a",
  surface2: "#585b70",
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",
  overlay0: "#6c7086",
  mauve: "#cba6f7",
  pink: "#f5c2e7",
  peach: "#fab387",
  yellow: "#f9e2af",
  green: "#a6e3a1",
  sky: "#89dceb",
  blue: "#89b4fa",
  red: "#f38ba8",
} as const;

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [sheet, setSheet] = useState<SheetType>(null);
  const [longPressTarget, setLongPressTarget] = useState<Note | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Note | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const tagById = mapTags(wikiTags);
    return allNotes.filter((n) => {
      if (n.kind !== kind) return false;
      if (q) {
        const hay =
          n.title.toLowerCase() +
          " " +
          n.excerpt.toLowerCase() +
          " " +
          n.wikiTagIds
            .map((id) => tagById.get(id)?.name ?? "")
            .join(" ")
            .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterTagIds.length > 0) {
        const ok = filterTagIds.some((id) => n.wikiTagIds.includes(id));
        if (!ok) return false;
      }
      return true;
    });
  }, [allNotes, wikiTags, kind, searchQuery, filterTagIds]);

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
      className="mx-auto max-w-md h-screen flex flex-col relative overflow-hidden"
      style={{ background: C.base, color: C.text }}
    >
      <TopBar
        kind={kind}
        onKindChange={setKind}
        layout={layout}
        onLayoutChange={setLayout}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((v) => !v)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSort={() => setSheet("sort")}
        onOpenFilter={() => setSheet("filter")}
        filterActive={filterTagIds.length > 0}
      />

      <main className="flex-1 overflow-auto" style={{ background: C.base }}>
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

      <BottomTabBar />

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
              setEditingId(target.id);
            } else {
              nav(`/schedule?focus=${target.id}`);
            }
          }}
        />
      )}

      {sheet === "sort" && (
        <SortSheet
          sortKey={sortKey}
          onPick={(k) => {
            setSortKey(k);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "filter" && (
        <FilterSheet
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
      )}

      {sheet === "itemMenu" && longPressTarget && (
        <ItemMenuSheet
          note={longPressTarget}
          onPin={() => {
            togglePinNote(longPressTarget.id);
            setSheet(null);
            setLongPressTarget(null);
          }}
          onDuplicate={() => {
            duplicateNote(longPressTarget.id);
            setSheet(null);
            setLongPressTarget(null);
          }}
          onDelete={() => {
            setConfirmDelete(longPressTarget);
            setSheet(null);
          }}
          onClose={() => {
            setSheet(null);
            setLongPressTarget(null);
          }}
        />
      )}

      {sheet === "editorMenu" && editing && (
        <EditorMenuSheet
          note={editing}
          onPin={() => {
            togglePinNote(editing.id);
            setSheet(null);
          }}
          onDuplicate={() => {
            const dup = duplicateNote(editing.id);
            setSheet(null);
            if (dup) setEditingId(dup.id);
          }}
          onShare={() => {
            console.log("[mock share]", editing.title);
            setSheet(null);
            alert(`「${editing.title || "(無題)"}」を共有 (mock)`);
          }}
          onDelete={() => {
            setConfirmDelete(editing);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "mood" && editing && editing.kind === "daily" && (
        <MoodSheet
          current={editing.mood ?? "green"}
          onPick={(m) => {
            updateNote(editing.id, { mood: m });
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "tag" && editing && (
        <TagSheet
          tags={wikiTags}
          selectedIds={editing.wikiTagIds}
          onToggle={(id) => {
            if (editing.wikiTagIds.includes(id)) {
              detachTag(editing.id, id);
            } else {
              attachTag(editing.id, id);
            }
          }}
          onCreate={(name, color) => {
            const created = addWikiTag(name, color);
            attachTag(editing.id, created.id);
          }}
          onClose={() => setSheet(null)}
        />
      )}

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
    </div>
  );
}

function TopBar({
  kind,
  onKindChange,
  layout,
  onLayoutChange,
  searchOpen,
  onToggleSearch,
  searchQuery,
  onSearchChange,
  onOpenSort,
  onOpenFilter,
  filterActive,
}: {
  kind: Kind;
  onKindChange: (k: Kind) => void;
  layout: Layout;
  onLayoutChange: (l: Layout) => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenSort: () => void;
  onOpenFilter: () => void;
  filterActive: boolean;
}) {
  return (
    <>
      <header
        className="h-12 flex items-center px-1 shrink-0"
        style={{
          background: C.mantle,
          borderBottom: `1px solid ${C.surface1}`,
        }}
      >
        <button
          type="button"
          aria-label="メニュー"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <Menu size={20} color={C.text} />
        </button>
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
          onClick={onToggleSearch}
          ariaLabel="検索"
          color={searchOpen ? C.mauve : C.text}
        >
          <Search size={18} />
        </IconBtn>
        <IconBtn
          onClick={() => onLayoutChange(layout === "card" ? "row" : "card")}
          ariaLabel="レイアウト切替"
          color={C.mauve}
        >
          {layout === "card" ? (
            <LayoutGrid size={18} />
          ) : (
            <ListIcon size={18} />
          )}
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
      {searchOpen && (
        <div
          className="px-3 py-2 shrink-0"
          style={{
            background: C.mantle,
            borderBottom: `1px solid ${C.surface1}`,
          }}
        >
          <div
            className="flex items-center h-10 rounded-md px-2 gap-2"
            style={{
              background: C.surface0,
              border: `1px solid ${C.surface1}`,
            }}
          >
            <Search size={16} color={C.subtext0} />
            <input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="タイトル / 本文 / タグ"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: C.text }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="クリア"
              >
                <X size={14} color={C.subtext0} />
              </button>
            )}
          </div>
        </div>
      )}
    </>
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
}: {
  layout: Layout;
  pinned: Note[];
  unpinned: Note[];
  tagById: Map<string, WikiTag>;
  onOpen: (id: string) => void;
  onLongPress: (n: Note) => void;
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
}: {
  notes: Note[];
  layout: Layout;
  tagById: Map<string, WikiTag>;
  onOpen: (id: string) => void;
  onLongPress: (n: Note) => void;
}) {
  if (layout === "card") {
    return (
      <div className="flex flex-col gap-3 p-4">
        {notes.map((n) => (
          <NoteCard
            key={n.id}
            note={n}
            tagById={tagById}
            onOpen={() => onOpen(n.id)}
            onLongPress={() => onLongPress(n)}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      {notes.map((n) => (
        <NoteRow
          key={n.id}
          note={n}
          tagById={tagById}
          onOpen={() => onOpen(n.id)}
          onLongPress={() => onLongPress(n)}
        />
      ))}
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

function BottomSheetShell({
  title,
  height,
  onClose,
  rightLabel,
  onRightClick,
  children,
}: {
  title: string;
  height: string;
  onClose: () => void;
  rightLabel?: string;
  onRightClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="fixed inset-0"
        style={{ background: C.crust, opacity: 0.5 }}
      />
      <div
        className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-md rounded-t-2xl flex flex-col"
        style={{ background: C.mantle, height }}
      >
        <div className="flex flex-col items-center pt-2 pb-1 shrink-0">
          <span
            className="w-10 h-1 rounded-full"
            style={{ background: C.overlay0 }}
          />
        </div>
        <header
          className="h-10 flex items-center px-3 shrink-0"
          style={{ borderBottom: `1px solid ${C.surface1}` }}
        >
          <div className="flex-1 text-sm font-medium">{title}</div>
          {rightLabel && onRightClick && (
            <button
              type="button"
              onClick={onRightClick}
              className="text-xs px-2 min-h-[36px]"
              style={{ color: C.mauve }}
            >
              {rightLabel}
            </button>
          )}
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </>
  );
}

function SortSheet({
  sortKey,
  onPick,
  onClose,
}: {
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
    <BottomSheetShell title="並び替え" height="40%" onClose={onClose}>
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
    </BottomSheetShell>
  );
}

function FilterSheet({
  tags,
  allNotes,
  kind,
  selectedIds,
  onToggle,
  onClear,
  onClose,
}: {
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
    <BottomSheetShell
      title="フィルタ"
      height="60%"
      onClose={onClose}
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
    </BottomSheetShell>
  );
}

function ItemMenuSheet({
  note,
  onPin,
  onDuplicate,
  onDelete,
  onClose,
}: {
  note: Note;
  onPin: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheetShell
      title={
        note.kind === "daily" ? formatDailyTitle(note) : note.title || "(無題)"
      }
      height="40%"
      onClose={onClose}
    >
      <MenuRow
        icon={note.pinned ? <PinOff size={18} /> : <Pin size={18} />}
        label={note.pinned ? "ピン留めを解除" : "ピン留め"}
        onClick={onPin}
      />
      {note.kind === "notes" && (
        <MenuRow icon={<Copy size={18} />} label="複製" onClick={onDuplicate} />
      )}
      <MenuRow
        icon={<Trash2 size={18} />}
        label="削除"
        onClick={onDelete}
        danger
      />
    </BottomSheetShell>
  );
}

function EditorMenuSheet({
  note,
  onPin,
  onDuplicate,
  onShare,
  onDelete,
  onClose,
}: {
  note: Note;
  onPin: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheetShell title="メニュー" height="40%" onClose={onClose}>
      <MenuRow
        icon={note.pinned ? <PinOff size={18} /> : <Pin size={18} />}
        label={note.pinned ? "ピン留めを解除" : "ピン留め"}
        onClick={onPin}
      />
      {note.kind === "notes" && (
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
    </BottomSheetShell>
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
  current,
  onPick,
  onClose,
}: {
  current: Mood;
  onPick: (m: Mood) => void;
  onClose: () => void;
}) {
  const items: Mood[] = ["green", "sky", "yellow", "peach", "red"];
  return (
    <BottomSheetShell title="気分" height="50%" onClose={onClose}>
      {items.map((m) => {
        const active = current === m;
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
    </BottomSheetShell>
  );
}

function TagSheet({
  tags,
  selectedIds,
  onToggle,
  onCreate,
  onClose,
}: {
  tags: WikiTag[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onCreate: (name: string, color: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [newColor, setNewColor] = useState<string>(TAG_COLOR_OPTIONS[0]);
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
    <BottomSheetShell title="タグを追加" height="70%" onClose={onClose}>
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
          const selected = selectedIds.includes(t.id);
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
    </BottomSheetShell>
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

function BottomTabBar() {
  const tabs: { to: string; label: string; Icon: typeof CalendarIcon }[] = [
    { to: "/schedule", label: "Sch", Icon: CalendarIcon },
    { to: "/work", label: "Wrk", Icon: Clock },
    { to: "/materials", label: "Mat", Icon: FileText },
    { to: "/settings", label: "Set", Icon: SettingsIcon },
  ];
  return (
    <nav
      className="h-14 grid grid-cols-4 shrink-0"
      style={{ background: C.mantle, borderTop: `1px solid ${C.surface1}` }}
    >
      {tabs.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className="flex flex-col items-center justify-center gap-0.5 active:opacity-70"
          style={({ isActive }) => ({
            color: isActive ? C.mauve : C.overlay0,
          })}
        >
          <Icon size={20} />
          <span className="text-[10px]">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
