import {
  BookOpen,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  Clock,
  FileText,
  Plus,
  Search,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { useMockStore } from "../hooks/useMockStore";
import type { Note, ScheduleItem, WikiTag } from "../lib/types";

const C = {
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
  surface0: "#313244",
  surface1: "#45475a",
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",
  overlay0: "#6c7086",
  mauve: "#cba6f7",
  green: "#a6e3a1",
} as const;

type ResultKind = "task" | "event" | "birthday" | "holiday" | "note" | "daily";

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
  return CalendarIcon;
};

export function CrossSearchScreen() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const initialTag = params.get("tag");
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
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    initialTag ? [initialTag] : [],
  );
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  const tagById = useMemo(() => {
    const m = new Map<string, WikiTag>();
    for (const t of wikiTags) m.set(t.id, t);
    return m;
  }, [wikiTags]);

  const results: ResultRow[] = useMemo(() => {
    const q = composing ? "" : query.trim().toLowerCase();
    const all: ResultRow[] = [
      ...scheduleItems.map(scheduleToRow),
      ...notes.map(noteToRow),
    ];
    return all
      .filter((r) => {
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
          const ok = selectedTagIds.some((id) => r.wikiTagIds.includes(id));
          if (!ok) return false;
        }
        return true;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [scheduleItems, notes, query, composing, selectedTagIds, tagById]);

  const handleResultClick = (r: ResultRow) => {
    if (r.kind === "note" || r.kind === "daily") {
      nav(`/materials?open=${r.id}`);
    } else {
      nav(`/schedule?focus=${r.id}`);
    }
  };

  return (
    <div
      className="mx-auto max-w-md h-screen flex flex-col relative overflow-hidden"
      style={{ background: C.base, color: C.text }}
    >
      <header
        className="h-12 flex items-center px-1 shrink-0"
        style={{
          background: C.mantle,
          borderBottom: `1px solid ${C.surface1}`,
        }}
      >
        <button
          type="button"
          onClick={() => nav(-1)}
          aria-label="戻る"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ChevronLeft size={22} color={C.text} />
        </button>
        <h1
          className="flex-1 text-center text-base font-medium"
          style={{ color: C.text }}
        >
          横断検索
        </h1>
        <span className="min-w-[44px]" />
      </header>

      <div
        className="px-3 py-2 shrink-0"
        style={{
          background: C.mantle,
          borderBottom: `1px solid ${C.surface1}`,
        }}
      >
        <div
          className="flex items-center h-12 rounded-md px-3 gap-2"
          style={{
            background: C.surface0,
            border: `1px solid ${C.surface1}`,
          }}
        >
          <Search size={18} color={C.subtext0} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            placeholder="タグ・タイトル・本文"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: C.text }}
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

      <div
        className="px-3 py-2 flex items-center gap-2 overflow-x-auto shrink-0"
        style={{ borderBottom: `1px solid ${C.surface1}` }}
      >
        {selectedTagIds.map((id) => {
          const t = tagById.get(id);
          if (!t) return null;
          return (
            <span
              key={id}
              className="h-8 pl-3 pr-1 rounded-full flex items-center gap-1 text-xs shrink-0"
              style={{
                background: `${t.color}22`,
                color: t.color,
                border: `1px solid ${t.color}66`,
              }}
            >
              #{t.name}
              <button
                type="button"
                onClick={() =>
                  setSelectedTagIds((prev) => prev.filter((x) => x !== id))
                }
                aria-label={`#${t.name} を外す`}
                className="w-6 h-6 flex items-center justify-center opacity-70 active:opacity-100"
              >
                <X size={12} />
              </button>
            </span>
          );
        })}
        <button
          type="button"
          onClick={() => setTagPickerOpen(true)}
          className="h-8 px-3 rounded-full text-xs flex items-center gap-1 shrink-0"
          style={{
            background: C.surface0,
            color: C.subtext0,
            border: `1px dashed ${C.surface1}`,
          }}
        >
          <Plus size={12} /> タグを追加
        </button>
      </div>

      <main className="flex-1 overflow-auto" style={{ background: C.base }}>
        <div className="px-3 py-2 text-xs" style={{ color: C.subtext0 }}>
          {results.length} 件
        </div>
        {results.length === 0 ? (
          <div
            className="h-full flex flex-col items-center justify-center gap-2 text-sm"
            style={{ color: C.subtext0 }}
          >
            <Search size={32} />
            <div>該当なし</div>
          </div>
        ) : (
          results.map((r) => (
            <ResultRowCmp
              key={r.id}
              row={r}
              tagById={tagById}
              onClick={() => handleResultClick(r)}
            />
          ))
        )}
      </main>

      <BottomTabBar />

      {tagPickerOpen && (
        <TagPickerSheet
          tags={wikiTags}
          selectedIds={selectedTagIds}
          onToggle={(id) =>
            setSelectedTagIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            )
          }
          onClose={() => setTagPickerOpen(false)}
        />
      )}
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

function TagPickerSheet({
  tags,
  selectedIds,
  onToggle,
  onClose,
}: {
  tags: WikiTag[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
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
        style={{ background: C.mantle, maxHeight: "70%" }}
      >
        <div className="flex flex-col items-center pt-2 pb-1">
          <span
            className="w-10 h-1 rounded-full"
            style={{ background: C.overlay0 }}
          />
        </div>
        <header
          className="h-10 flex items-center px-3"
          style={{ borderBottom: `1px solid ${C.surface1}` }}
        >
          <div className="flex-1 text-sm font-medium">タグで絞り込み</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X size={16} color={C.text} />
          </button>
        </header>
        <div className="flex-1 overflow-auto">
          {tags.map((t) => {
            const selected = selectedIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onToggle(t.id)}
                className="w-full min-h-[44px] px-3 flex items-center gap-2 text-left"
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
