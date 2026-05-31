import {
  BookOpen,
  Calendar as CalendarIcon,
  CheckSquare,
  FileText,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMockStore } from "../hooks/useMockStore";
import { C } from "../lib/theme";
import type { Note, ScheduleItem, WikiTag } from "../lib/types";

/**
 * Cross-cutting search core — query + kind/tag filters over schedule items and
 * notes. Shared by the global SearchOverlay (from the Header) and the
 * /cross-search fallback page. Owns no chrome (handle / bottom bar); the host
 * supplies that.
 *
 * Behavior (per 2026-05-30 requirements):
 *  - Empty state: with no query AND no active filter, show NO candidates (a
 *    hint only). Results appear once the user types or picks a filter.
 *  - Filters expanded beyond tags: kind chips (Tasks / Events / Notes / Daily)
 *    rendered inline alongside tag chips (no nested bottom sheet).
 */
type ResultKind = "task" | "event" | "birthday" | "holiday" | "note" | "daily";
type KindFilter = "task" | "event" | "note" | "daily";

interface ResultRow {
  id: string;
  kind: ResultKind;
  title: string;
  excerpt: string;
  updatedAt: number;
  wikiTagIds: string[];
  meta: string;
}

const KIND_LABEL: Record<ResultKind, string> = {
  task: "Task",
  event: "Event",
  birthday: "Birthday",
  holiday: "Holiday",
  note: "Note",
  daily: "Daily",
};

// Result kind → coarse filter bucket (birthday/holiday fold into Events).
const toKindFilter = (k: ResultKind): KindFilter => {
  if (k === "task") return "task";
  if (k === "note") return "note";
  if (k === "daily") return "daily";
  return "event";
};

const KIND_FILTERS: { key: KindFilter; label: string; icon: typeof Search }[] =
  [
    { key: "task", label: "タスク", icon: CheckSquare },
    { key: "event", label: "予定", icon: CalendarIcon },
    { key: "note", label: "ノート", icon: FileText },
    { key: "daily", label: "デイリー", icon: BookOpen },
  ];

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

const formatDailyTitle = (date: string): string => {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日(${w})`;
};

const scheduleToRow = (it: ScheduleItem): ResultRow => ({
  id: it.id,
  kind: it.type,
  title: it.title,
  excerpt: it.description ?? "",
  updatedAt: it.updatedAt,
  wikiTagIds: it.wikiTagIds,
  meta: it.due ? `${it.due}${it.time ? ` ${it.time}` : ""}` : "期限なし",
});

const noteToRow = (n: Note): ResultRow => ({
  id: n.id,
  kind: n.kind === "daily" ? "daily" : "note",
  title:
    n.kind === "daily" && n.date
      ? formatDailyTitle(n.date)
      : n.title || "(無題)",
  excerpt: n.excerpt,
  updatedAt: n.updatedAt,
  wikiTagIds: n.wikiTagIds,
  meta: formatTimeAgo(n.updatedAt),
});

const iconFor = (kind: ResultKind) => {
  if (kind === "note") return FileText;
  if (kind === "daily") return BookOpen;
  if (kind === "task") return CheckSquare;
  return CalendarIcon;
};

export function CrossSearchBody({
  initialTag = null,
  onNavigate,
}: {
  initialTag?: string | null;
  onNavigate?: () => void;
}) {
  const nav = useNavigate();
  const allScheduleItems = useMockStore((s) => s.scheduleItems);
  const allNotes = useMockStore((s) => s.notes);
  const wikiTags = useMockStore((s) => s.wikiTags);
  const scheduleItems = useMemo(
    () => allScheduleItems.filter((x) => !x.isDeleted),
    [allScheduleItems],
  );
  const notes = useMemo(() => allNotes.filter((n) => !n.isDeleted), [allNotes]);

  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [selectedKinds, setSelectedKinds] = useState<KindFilter[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    initialTag ? [initialTag] : [],
  );

  const tagById = useMemo(() => {
    const m = new Map<string, WikiTag>();
    for (const t of wikiTags) m.set(t.id, t);
    return m;
  }, [wikiTags]);

  const q = composing ? "" : query.trim().toLowerCase();
  const hasFilter = selectedKinds.length > 0 || selectedTagIds.length > 0;
  // Show candidates only once there is a query or an active filter.
  const active = q.length > 0 || hasFilter;

  const results: ResultRow[] = useMemo(() => {
    if (!active) return [];
    const all: ResultRow[] = [
      ...scheduleItems.map(scheduleToRow),
      ...notes.map(noteToRow),
    ];
    return all
      .filter((r) => {
        if (
          selectedKinds.length > 0 &&
          !selectedKinds.includes(toKindFilter(r.kind))
        ) {
          return false;
        }
        if (q) {
          const hay = (
            r.title +
            " " +
            r.excerpt +
            " " +
            r.wikiTagIds.map((id) => tagById.get(id)?.name ?? "").join(" ")
          ).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (selectedTagIds.length > 0) {
          if (!selectedTagIds.some((id) => r.wikiTagIds.includes(id)))
            return false;
        }
        return true;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [active, scheduleItems, notes, q, selectedKinds, selectedTagIds, tagById]);

  const toggleKind = (k: KindFilter) =>
    setSelectedKinds((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    );
  const toggleTag = (id: string) =>
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleResultClick = (r: ResultRow) => {
    if (r.kind === "note" || r.kind === "daily") {
      nav(`/materials?open=${r.id}`);
    } else {
      nav(`/schedule?focus=${r.id}`);
    }
    onNavigate?.();
  };

  return (
    <div className="flex flex-col h-full" style={{ background: C.base }}>
      {/* Search input */}
      <div className="px-3 pt-2 pb-2 shrink-0" style={{ background: C.mantle }}>
        <div
          className="flex items-center h-11 rounded-lg px-3 gap-2"
          style={{ background: C.surface0, border: `1px solid ${C.surface1}` }}
        >
          <Search size={18} color={C.subtext0} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            placeholder="タスク・予定・ノート・タグを検索"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: C.text }}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="クリア"
            >
              <X size={16} color={C.subtext0} />
            </button>
          )}
        </div>
      </div>

      {/* Kind filter chips */}
      <div
        className="px-3 py-2 flex items-center gap-2 overflow-x-auto shrink-0"
        style={{ background: C.mantle }}
      >
        {KIND_FILTERS.map(({ key, label, icon: Icon }) => {
          const on = selectedKinds.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleKind(key)}
              aria-pressed={on}
              className="h-8 px-3 rounded-full text-xs flex items-center gap-1.5 shrink-0"
              style={{
                background: on ? C.mauve : C.surface0,
                color: on ? C.base : C.subtext1,
                border: `1px solid ${on ? C.mauve : C.surface1}`,
                fontWeight: on ? 600 : 400,
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Tag filter chips */}
      {wikiTags.length > 0 && (
        <div
          className="px-3 pb-2 flex items-center gap-2 overflow-x-auto shrink-0"
          style={{
            background: C.mantle,
            borderBottom: `1px solid ${C.surface1}`,
          }}
        >
          {wikiTags.map((t) => {
            const on = selectedTagIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.id)}
                aria-pressed={on}
                className="h-8 px-3 rounded-full text-xs flex items-center gap-1 shrink-0"
                style={{
                  background: on ? `${t.color}33` : C.surface0,
                  color: on ? t.color : C.subtext1,
                  border: `1px solid ${on ? `${t.color}99` : C.surface1}`,
                }}
              >
                #{t.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Results — hidden until there is a query or active filter */}
      <main
        className="flex-1 min-h-0 overflow-auto"
        style={{ background: C.base }}
      >
        {!active ? (
          <div
            className="h-full flex flex-col items-center justify-center gap-2 text-sm px-6 text-center"
            style={{ color: C.subtext0 }}
          >
            <Search size={32} />
            <div>
              キーワードを入力するか、フィルタを選ぶと候補が表示されます
            </div>
          </div>
        ) : results.length === 0 ? (
          <div
            className="h-full flex flex-col items-center justify-center gap-2 text-sm"
            style={{ color: C.subtext0 }}
          >
            <Search size={32} />
            <div>該当なし</div>
          </div>
        ) : (
          <>
            <div className="px-3 py-2 text-xs" style={{ color: C.subtext0 }}>
              {results.length} 件
            </div>
            {results.map((r) => (
              <ResultRowCmp
                key={r.id}
                row={r}
                tagById={tagById}
                onClick={() => handleResultClick(r)}
              />
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function ResultRowCmp({
  row,
  tagById,
  onClick,
}: {
  row: ResultRow;
  tagById: Map<string, WikiTag>;
  onClick: () => void;
}) {
  const Icon = iconFor(row.kind);
  const firstTag = row.wikiTagIds.map((id) => tagById.get(id)).find(Boolean);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[64px] px-3 py-2 flex items-center gap-3 text-left active:bg-white/5"
      style={{ borderBottom: `1px solid ${C.surface1}` }}
    >
      <div
        className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
        style={{ background: C.surface0 }}
      >
        <Icon size={18} color={C.subtext1} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
            style={{ background: C.surface1, color: C.subtext1 }}
          >
            {KIND_LABEL[row.kind]}
          </span>
          <span
            className="text-sm font-medium truncate"
            style={{ color: C.text }}
          >
            {row.title}
          </span>
        </div>
        <div
          className="text-[11px] truncate flex items-center gap-2"
          style={{ color: C.subtext0 }}
        >
          <span>{row.meta}</span>
          {firstTag && (
            <span style={{ color: firstTag.color }}>#{firstTag.name}</span>
          )}
          {row.excerpt && <span className="truncate">— {row.excerpt}</span>}
        </div>
      </div>
    </button>
  );
}
