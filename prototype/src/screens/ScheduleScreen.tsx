import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter as FilterIcon,
  Plus,
  Trash2,
  X,
} from "lucide-react";
// NOTE: `Search` (lucide) was removed with the cross-section search UI during the
// shared-shell refactor; search now lives in AppHeader. react-router's
// useSearchParams below is unrelated and stays.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BottomSheet } from "../components/BottomSheet";
import { Drawer } from "../components/Drawer";
import { SessionHistoryList } from "../components/SessionHistoryList";
import { useShell } from "../context/ShellContext";
import { useDismissOnEscape } from "../hooks/useDismissOnEscape";
import { useMockStore } from "../hooks/useMockStore";
import {
  addScheduleItem,
  addWikiTag,
  deleteScheduleItem,
  toggleStatus,
  updateScheduleItem,
} from "../lib/mockStore";
import { C } from "../lib/theme";
import type {
  ItemRole,
  ScheduleItem,
  ScheduleItemType,
  TaskStatus,
  WikiTag,
} from "../lib/types";

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

type ViewMode = "month" | "three" | "list" | "history";

const WEEK_DAYS_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;
const HOUR_PX = 48;
const HOUR_START = 8;
const HOUR_END = 22;

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(s?: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function formatMonthTitle(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

function formatDayHeader(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEK_DAYS_JA[d.getDay()]})`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getStatusColor(status: TaskStatus): string {
  if (status === "doing") return C.yellow;
  if (status === "done") return C.green;
  return C.overlay0;
}

function getTypeAccent(type: ScheduleItemType): string {
  if (type === "event") return C.sky;
  if (type === "birthday") return C.peach;
  if (type === "holiday") return C.red;
  return C.overlay0;
}

function buildMonthCells(month: Date): { date: Date; inMonth: boolean }[] {
  const first = startOfMonth(month);
  const gridStart = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = addDays(gridStart, i);
    return { date: d, inMonth: d.getMonth() === month.getMonth() };
  });
}

function compareTime(a: ScheduleItem, b: ScheduleItem): number {
  if (a.time && b.time) return a.time.localeCompare(b.time);
  if (a.time) return -1;
  if (b.time) return 1;
  return a.createdAt - b.createdAt;
}

interface ListGroup {
  label: string;
  items: ScheduleItem[];
}

type SortKey = "time" | "updatedAt" | "title";

function pickSortFn(
  sortKey: SortKey,
): (a: ScheduleItem, b: ScheduleItem) => number {
  if (sortKey === "title") return (a, b) => a.title.localeCompare(b.title);
  if (sortKey === "updatedAt") return (a, b) => b.updatedAt - a.updatedAt;
  return compareTime;
}

function buildListGroups(
  items: ScheduleItem[],
  today: Date,
  sortKey: SortKey = "time",
): ListGroup[] {
  const todayStr = ymd(today);
  const tomorrowStr = ymd(addDays(today, 1));
  const weekEnd = addDays(today, 7);
  const noDue: ScheduleItem[] = [];
  const todayItems: ScheduleItem[] = [];
  const tomorrowItems: ScheduleItem[] = [];
  const weekItems: ScheduleItem[] = [];
  for (const it of items) {
    if (!it.due) {
      noDue.push(it);
      continue;
    }
    if (it.due === todayStr) todayItems.push(it);
    else if (it.due === tomorrowStr) tomorrowItems.push(it);
    else {
      const dueDate = parseYmd(it.due);
      if (dueDate && dueDate > today && dueDate <= weekEnd) {
        weekItems.push(it);
      }
    }
  }
  const sortFn = pickSortFn(sortKey);
  [todayItems, tomorrowItems, weekItems].forEach((g) => g.sort(sortFn));
  // noDue は時刻情報がないので sortKey に従う (time のときは fallback で updatedAt)
  if (sortKey === "time") {
    noDue.sort((a, b) => b.updatedAt - a.updatedAt);
  } else {
    noDue.sort(sortFn);
  }
  return [
    { label: "今日", items: todayItems },
    { label: "明日", items: tomorrowItems },
    { label: "今週", items: weekItems },
    { label: "期限なし", items: noDue },
  ].filter((g) => g.items.length > 0);
}

type RecurrenceKind = "daily" | "weekly" | "monthly";

/** add-item セレクタの 5 role 定義（表示順）。CLAUDE.md §4.3 */
const ROLE_OPTIONS: { v: ItemRole; label: string }[] = [
  { v: "task", label: "タスク" },
  { v: "event", label: "予定" },
  { v: "routine", label: "ルーチン" },
  { v: "note", label: "ノート" },
  { v: "daily", label: "日次" },
];

const roleLabelJa = (role: ItemRole): string =>
  ROLE_OPTIONS.find((r) => r.v === role)?.label ?? role;

/** ScheduleItem の type から 5 role を逆引き（編集時の初期 role 決定用） */
const roleFromType = (type: ScheduleItemType): ItemRole =>
  type === "event" || type === "birthday" ? "event" : "task";

interface EditDraft {
  id?: string;
  title: string;
  type: ScheduleItemType;
  /** 作成導線の役割選択（items_meta role）。task/event は type に対応 */
  role: ItemRole;
  /** routine 選択時のみ使用 */
  recurrence: RecurrenceKind;
  status: TaskStatus;
  due: string;
  time: string;
  endTime: string;
  description: string;
  wikiTagIds: string[];
}

const emptyDraft = (preset?: Partial<EditDraft>): EditDraft => ({
  title: "",
  type: "task",
  role: "task",
  recurrence: "weekly",
  status: "todo",
  due: "",
  time: "",
  endTime: "",
  description: "",
  wikiTagIds: [],
  ...preset,
});

function draftFromItem(item: ScheduleItem): EditDraft {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    role: roleFromType(item.type),
    recurrence: "weekly",
    status: item.status,
    due: item.due ?? "",
    time: item.time ?? "",
    endTime: item.endTime ?? "",
    description: item.description ?? "",
    wikiTagIds: [...item.wikiTagIds],
  };
}

function StatusCheckbox({
  status,
  onClick,
  disabled,
}: {
  status: TaskStatus;
  onClick: () => void;
  disabled?: boolean;
}) {
  const label =
    status === "todo" ? "未着手" : status === "doing" ? "進行中" : "完了";
  return (
    <button
      type="button"
      aria-label={`ステータス: ${label}`}
      onClick={onClick}
      disabled={disabled}
      className="min-h-[44px] min-w-[44px] flex items-center justify-center transition-transform active:scale-90 disabled:opacity-50"
    >
      {status === "todo" && (
        <span
          className="w-6 h-6 rounded-full border-2"
          style={{ borderColor: C.overlay0 }}
        />
      )}
      {status === "doing" && (
        <span
          className="w-6 h-6 rounded-full"
          style={{ background: C.yellow }}
        />
      )}
      {status === "done" && (
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: C.green }}
        >
          <Check size={16} color={C.base} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function WikiTagChip({
  tag,
  onClick,
  onRemove,
  size = "sm",
}: {
  tag: WikiTag;
  onClick?: () => void;
  onRemove?: () => void;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${pad}`}
      style={{ background: `${tag.color}22`, color: tag.color }}
    >
      <button
        type="button"
        onClick={onClick}
        className="font-medium"
        aria-label={`タグ #${tag.name} で横断検索`}
      >
        #{tag.name}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`#${tag.name} を外す`}
          className="opacity-70 hover:opacity-100"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

export function ScheduleScreen() {
  const navigate = useNavigate();
  const { sidebarOpen, closeSidebar } = useShell();
  const [searchParams, setSearchParams] = useSearchParams();
  const allScheduleItems = useMockStore((s) => s.scheduleItems);
  const wikiTags = useMockStore((s) => s.wikiTags);
  const allSessions = useMockStore((s) => s.timerSessions);
  const scheduleItems = useMemo(
    () => allScheduleItems.filter((i) => !i.isDeleted),
    [allScheduleItems],
  );
  const sessions = useMemo(
    () => allSessions.filter((s) => !s.isDeleted),
    [allSessions],
  );

  const [view, setView] = useState<ViewMode>("month");
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [today, setToday] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setToday(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const focusHandledRef = useRef<string | null>(null);

  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<TaskStatus[]>([]);
  const [filterTypes, setFilterTypes] = useState<ScheduleItemType[]>([]);
  const [sortKey, setSortKey] = useState<"time" | "updatedAt" | "title">(
    "time",
  );

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [modalDraft, setModalDraft] = useState<EditDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ScheduleItem | null>(null);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  // routine/note/daily は本プロトタイプに一覧描画導線が無いためモック確定をトースト通知する
  const [roleToast, setRoleToast] = useState<string | null>(null);

  useEffect(() => {
    if (!roleToast) return;
    const id = window.setTimeout(() => setRoleToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [roleToast]);

  const filtered = useMemo(() => {
    return scheduleItems.filter((it) => {
      if (filterTagIds.length > 0) {
        const ok = filterTagIds.every((id) => it.wikiTagIds.includes(id));
        if (!ok) return false;
      }
      if (filterStatuses.length > 0) {
        if (!filterStatuses.includes(it.status)) return false;
      }
      if (filterTypes.length > 0) {
        if (!filterTypes.includes(it.type)) return false;
      }
      return true;
    });
  }, [scheduleItems, filterTagIds, filterStatuses, filterTypes]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const it of filtered) {
      if (!it.due) continue;
      const arr = map.get(it.due) ?? [];
      arr.push(it);
      map.set(it.due, arr);
    }
    for (const arr of map.values()) arr.sort(compareTime);
    return map;
  }, [filtered]);

  const tagById = useMemo(() => {
    const m = new Map<string, WikiTag>();
    for (const t of wikiTags) m.set(t.id, t);
    return m;
  }, [wikiTags]);

  // 月 / 3日 のセル計算は SwipePane の renderPage 内で都度行うので
  // ここでは事前計算しない (3 ペーン分必要なため)
  const listGroups = useMemo(
    () => buildListGroups(filtered, today, sortKey),
    [filtered, today, sortKey],
  );

  const openCreate = (preset?: Partial<EditDraft>) =>
    setModalDraft(emptyDraft({ due: ymd(today), ...preset }));

  const openEdit = (item: ScheduleItem) => setModalDraft(draftFromItem(item));

  useEffect(() => {
    const focusId = searchParams.get("focus");
    if (!focusId) {
      focusHandledRef.current = null;
      return;
    }
    if (focusHandledRef.current === focusId) return;
    const target = scheduleItems.find((it) => it.id === focusId);
    if (!target) return;
    focusHandledRef.current = focusId;
    const due = parseYmd(target.due);
    if (due) {
      setAnchorDate(due);
    }
    setView("three");
    setSelectedDay(null);
    setModalDraft(draftFromItem(target));
    const next = new URLSearchParams(searchParams);
    next.delete("focus");
    setSearchParams(next, { replace: true });
  }, [searchParams, scheduleItems, setSearchParams]);

  const handleSave = () => {
    if (!modalDraft) return;
    const title = modalDraft.title.trim();
    if (!title) return;
    // routine/note/daily は Schedule 画面に描画導線が無い（C-3: セレクタのみ 5 role 化）。
    // 新規作成時はモック確定としてトースト通知し、schedule item は作らない。
    const role = modalDraft.role;
    if (
      !modalDraft.id &&
      (role === "routine" || role === "note" || role === "daily")
    ) {
      setRoleToast(`（モック）${roleLabelJa(role)}を作成しました`);
      setModalDraft(null);
      return;
    }
    const cleaned = {
      title,
      type: modalDraft.type,
      status: modalDraft.status,
      due: modalDraft.due || undefined,
      time: modalDraft.time || undefined,
      endTime: modalDraft.endTime || undefined,
      description: modalDraft.description || undefined,
      wikiTagIds: modalDraft.wikiTagIds,
    };
    if (modalDraft.id) {
      updateScheduleItem(modalDraft.id, cleaned);
    } else {
      addScheduleItem(cleaned);
    }
    setModalDraft(null);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    deleteScheduleItem(confirmDelete.id);
    setConfirmDelete(null);
    setModalDraft(null);
  };

  const handleTagChipClick = (tagId: string) => {
    navigate(`/cross-search?tag=${tagId}`);
  };

  return (
    <div
      className="h-full flex flex-col relative overflow-hidden"
      style={{ background: C.base, color: C.text }}
    >
      {view === "month" && (
        <ScheduleToolbar
          title={formatMonthTitle(anchorDate)}
          onPrev={() => setAnchorDate(addMonths(anchorDate, -1))}
          onNext={() => setAnchorDate(addMonths(anchorDate, 1))}
          onToday={() => {
            const now = new Date();
            setAnchorDate(now);
            setToday(now);
          }}
        />
      )}
      <SegmentControl
        value={view}
        onChange={(v) => {
          setView(v);
          setSelectedDay(null);
        }}
      />
      <main
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        style={{ background: C.base }}
      >
        {view === "month" && (
          <SwipePane
            onPrev={() => setAnchorDate(addMonths(anchorDate, -1))}
            onNext={() => setAnchorDate(addMonths(anchorDate, 1))}
            renderPage={(offset) => {
              const pageDate =
                offset === 0 ? anchorDate : addMonths(anchorDate, offset);
              return (
                <MonthView
                  month={pageDate}
                  cells={buildMonthCells(pageDate)}
                  itemsByDay={itemsByDay}
                  today={today}
                  selectedDay={offset === 0 ? selectedDay : null}
                  onCellClick={(d) => {
                    if (offset !== 0) return;
                    if (d.getMonth() !== pageDate.getMonth()) return;
                    setSelectedDay(d);
                  }}
                />
              );
            }}
          />
        )}
        {view === "three" && (
          <SwipePane
            onPrev={() => setAnchorDate(addDays(anchorDate, -3))}
            onNext={() => setAnchorDate(addDays(anchorDate, 3))}
            renderPage={(offset) => {
              const pageAnchor =
                offset === 0 ? anchorDate : addDays(anchorDate, offset * 3);
              const days = [
                addDays(pageAnchor, -1),
                pageAnchor,
                addDays(pageAnchor, 1),
              ];
              return (
                <ThreeDayView
                  days={days}
                  itemsByDay={itemsByDay}
                  today={today}
                  onEventClick={(item) => {
                    if (offset !== 0) return;
                    openEdit(item);
                  }}
                  onSlotClick={(day, hour) => {
                    if (offset !== 0) return;
                    openCreate({
                      due: ymd(day),
                      time: `${String(hour).padStart(2, "0")}:00`,
                      endTime: `${String(Math.min(hour + 1, 23)).padStart(2, "0")}:00`,
                      type: "event",
                    });
                  }}
                />
              );
            }}
          />
        )}
        {view === "list" && (
          <ListView
            groups={listGroups}
            tagById={tagById}
            onToggleStatus={(item) => toggleStatus(item.id)}
            onRowClick={(item) => openEdit(item)}
            onTagClick={handleTagChipClick}
          />
        )}
        {view === "history" && <SessionHistoryList sessions={sessions} />}
      </main>
      {view !== "history" && (
        <button
          type="button"
          onClick={() => openCreate()}
          aria-label="新規予定を追加"
          className="absolute right-4 bottom-20 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center transition-transform active:scale-95"
          style={{ background: C.mauve, color: C.base }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}
      <DayDetailSheet
        open={!!selectedDay}
        date={selectedDay}
        items={selectedDay ? (itemsByDay.get(ymd(selectedDay)) ?? []) : []}
        tagById={tagById}
        onClose={() => setSelectedDay(null)}
        onAdd={() => {
          if (selectedDay) openCreate({ due: ymd(selectedDay) });
        }}
        onOpenThree={() => {
          if (!selectedDay) return;
          setAnchorDate(selectedDay);
          setView("three");
          setSelectedDay(null);
        }}
        onRowClick={(item) => openEdit(item)}
        onToggleStatus={(item) => toggleStatus(item.id)}
        onTagClick={handleTagChipClick}
      />
      {modalDraft && (
        <AddEventModal
          draft={modalDraft}
          tags={wikiTags}
          tagById={tagById}
          onChange={setModalDraft}
          onClose={() => setModalDraft(null)}
          onSave={handleSave}
          onAskDelete={() => {
            const original = scheduleItems.find((i) => i.id === modalDraft.id);
            if (original) setConfirmDelete(original);
          }}
          onOpenTagSheet={() => setTagSheetOpen(true)}
          tagSheetOpen={tagSheetOpen}
          onCloseTagSheet={() => setTagSheetOpen(false)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="この予定を削除しますか?"
          message={confirmDelete.title}
          danger
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}
      <Drawer open={sidebarOpen} onClose={closeSidebar}>
        <ScheduleSidebarContent
          onClose={closeSidebar}
          wikiTags={wikiTags}
          filterTagIds={filterTagIds}
          onToggleTagFilter={(id) =>
            setFilterTagIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            )
          }
          filterStatuses={filterStatuses}
          onToggleStatusFilter={(s) =>
            setFilterStatuses((prev) =>
              prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
            )
          }
          filterTypes={filterTypes}
          onToggleTypeFilter={(t) =>
            setFilterTypes((prev) =>
              prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
            )
          }
          sortKey={sortKey}
          onChangeSortKey={setSortKey}
        />
      </Drawer>
      {roleToast && (
        <div
          role="status"
          aria-live="polite"
          className="absolute left-1/2 -translate-x-1/2 bottom-24 z-[60] px-4 py-2 rounded-full text-sm shadow-lg pointer-events-none"
          style={{ background: C.surface2, color: C.text }}
        >
          {roleToast}
        </div>
      )}
    </div>
  );
}

/**
 * Peeking 型 SwipePane。
 *
 * 仕様:
 *  - 3 ペーン (前 / 当 / 次) を `width: 300%` の横並びで描画
 *  - 常に `translateX(calc(-33.3333% + dragX))` で中央 (当) を表示
 *  - ドラッグ中は左右の隣接ページが「ちらっと見える」状態
 *  - 解放時に閾値 (= width/3 もしくは fast flick) 超えなら隣ページが中央に
 *    来る位置までスライドアニメ → 親が anchorDate を更新 → 同フレームで
 *    `dragX = 0` に戻して transition オフ。新しい 3 ペーンが瞬時に中央
 *    位置で描画されるので連続感が出る
 *  - 純粋なタップ (axis 未確定 = 8px 未満) は何もせず click を通す
 *    (DayDetailSheet が出ない旧バグの根本原因)
 */
type SwipeMode = "idle" | "drag" | "animating";

function SwipePane({
  onPrev,
  onNext,
  renderPage,
}: {
  onPrev: () => void;
  onNext: () => void;
  renderPage: (offset: -1 | 0 | 1) => React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{
    x: number;
    y: number;
    pid: number;
    t: number;
  } | null>(null);
  const axisRef = useRef<"horizontal" | "vertical" | null>(null);
  const [dragX, setDragX] = useState(0);
  const [mode, setMode] = useState<SwipeMode>("idle");

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (mode === "animating") return;
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      pid: e.pointerId,
      t: Date.now(),
    };
    axisRef.current = null;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const s = startRef.current;
    if (!s || s.pid !== e.pointerId) return;
    if (mode === "animating") return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (axisRef.current === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      if (axisRef.current === "horizontal") setMode("drag");
    }
    if (axisRef.current === "vertical") return;
    setDragX(dx);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const s = startRef.current;
    startRef.current = null;
    if (!s || s.pid !== e.pointerId) return;

    // 純粋なタップ (horizontal axis に乗らなかった) は何もしない。
    // 状態を初期化して click を子要素に通す。
    if (axisRef.current !== "horizontal") {
      axisRef.current = null;
      setMode("idle");
      setDragX(0);
      return;
    }

    const dx = e.clientX - s.x;
    const dt = Date.now() - s.t;
    const width = containerRef.current?.offsetWidth ?? 320;
    const distance = Math.abs(dx);
    const isFastFlick = dt < 250 && distance > 30;
    const shouldCommit = distance > width / 3 || isFastFlick;

    setMode("animating");

    if (!shouldCommit) {
      // スナップバック: 中央へ戻す
      setDragX(0);
      window.setTimeout(() => {
        axisRef.current = null;
        setMode("idle");
      }, 220);
      return;
    }

    // コミット: 隣ペーンが中央に来る位置まで持っていく → アニメ完了と
    // 同じ tick で「親の anchorDate 更新」「dragX = 0」「mode = idle」を
    // 全部発火する。rAF を挟むと「anchorDate だけ更新されて dragX はまだ
    // width のまま」の中間 paint が出てしまい、リバウンドして見える。
    // React 18 の自動 batching で 1 つの render に統合される前提。
    const direction = dx > 0 ? 1 : -1;
    setDragX(direction * width);
    window.setTimeout(() => {
      if (direction > 0) onPrev();
      else onNext();
      setMode("idle"); // transition: none に切替
      setDragX(0); // 新中央が中央位置へ瞬時に
      axisRef.current = null;
    }, 220);
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    const s = startRef.current;
    startRef.current = null;
    if (!s || s.pid !== e.pointerId) return;
    if (axisRef.current === "horizontal") {
      setMode("animating");
      setDragX(0);
      window.setTimeout(() => {
        axisRef.current = null;
        setMode("idle");
      }, 220);
    } else {
      axisRef.current = null;
      setMode("idle");
      setDragX(0);
    }
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    // 実ドラッグ済 (axisRef = horizontal) または animation 中のみ click 吸収。
    // 純粋なタップ (axisRef = null) は通す。
    if (axisRef.current === "horizontal" || mode === "animating") {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // transition は "animating" のときだけオン (snap-back / commit のアニメ用)。
  // "idle" でオンにしてしまうと、commit 完了時の `setDragX(width → 0)` が
  // 220ms かけて逆方向に流れて、リバウンドして見えてしまう。
  const transition =
    mode === "animating"
      ? "transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1)"
      : "none";

  return (
    <div ref={containerRef} className="overflow-hidden h-full">
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={handleClickCapture}
        className="flex h-full"
        style={{
          width: "300%",
          transform: `translate3d(calc(-33.3333% + ${dragX}px), 0, 0)`,
          transition,
          touchAction: "pan-y",
          willChange: mode === "idle" ? "auto" : "transform",
        }}
      >
        <div
          className="h-full overflow-hidden"
          style={{ flex: "0 0 33.3333%", width: "33.3333%" }}
          aria-hidden="true"
        >
          {renderPage(-1)}
        </div>
        <div
          className="h-full overflow-hidden"
          style={{ flex: "0 0 33.3333%", width: "33.3333%" }}
        >
          {renderPage(0)}
        </div>
        <div
          className="h-full overflow-hidden"
          style={{ flex: "0 0 33.3333%", width: "33.3333%" }}
          aria-hidden="true"
        >
          {renderPage(1)}
        </div>
      </div>
    </div>
  );
}

/**
 * Schedule-specific sub-toolbar (IA v3 — under the shared AppHeader).
 *
 * The shared AppHeader owns menu / section title / search; this strip keeps only
 * the screen-specific month navigation, shown for the month view. The view
 * switcher lives in the separate `SegmentControl` rendered right below this.
 */
function ScheduleToolbar({
  title,
  onPrev,
  onNext,
  onToday,
}: {
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div
      className="h-12 flex items-center px-2 shrink-0"
      style={{
        background: C.surface0,
        borderBottom: `1px solid ${C.surface1}`,
      }}
    >
      <h2 className="flex-1 text-base font-medium" style={{ color: C.text }}>
        {title}
      </h2>
      <button
        type="button"
        onClick={onPrev}
        aria-label="前の月"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <ChevronLeft size={20} color={C.text} />
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label="次の月"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <ChevronRight size={20} color={C.text} />
      </button>
      <button
        type="button"
        onClick={onToday}
        className="text-sm px-3 min-h-[44px] rounded-md ml-1"
        style={{ border: `1px solid ${C.mauve}`, color: C.mauve }}
      >
        Today
      </button>
    </div>
  );
}

function SegmentControl({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const items: { v: ViewMode; label: string }[] = [
    { v: "month", label: "Month" },
    { v: "three", label: "Three" },
    { v: "list", label: "List" },
    { v: "history", label: "History" },
  ];
  return (
    <div
      className="h-10 grid grid-cols-4 shrink-0"
      role="tablist"
      aria-label="表示切替"
      style={{
        background: C.mantle,
        borderBottom: `1px solid ${C.surface1}`,
      }}
    >
      {items.map((it) => {
        const active = it.v === value;
        return (
          <button
            key={it.v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.v)}
            className="text-sm transition-transform active:scale-[0.98]"
            style={{
              background: active ? C.mauve : "transparent",
              color: active ? C.base : C.subtext0,
              fontWeight: active ? 600 : 400,
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function MonthView({
  month,
  cells,
  itemsByDay,
  today,
  selectedDay,
  onCellClick,
}: {
  month: Date;
  cells: { date: Date; inMonth: boolean }[];
  itemsByDay: Map<string, ScheduleItem[]>;
  today: Date;
  selectedDay: Date | null;
  onCellClick: (d: Date) => void;
}) {
  const weekRows = cells.length / 7;
  return (
    <div
      className="grid grid-cols-7 gap-px h-full"
      style={{
        background: C.surface1,
        gridTemplateRows: `auto repeat(${weekRows}, minmax(0, 1fr))`,
      }}
    >
      {WEEK_DAYS_JA.map((d, i) => (
        <div
          key={d}
          className="h-8 flex items-center justify-center text-xs"
          style={{
            background: C.mantle,
            color: i === 0 ? C.red : i === 6 ? C.sky : C.subtext0,
          }}
        >
          {d}
        </div>
      ))}
      {cells.map((cell, idx) => (
        <MonthCell
          key={idx}
          date={cell.date}
          inMonth={cell.inMonth}
          items={itemsByDay.get(ymd(cell.date)) ?? []}
          isToday={isSameDay(cell.date, today)}
          isSelected={!!selectedDay && isSameDay(cell.date, selectedDay)}
          onClick={() => onCellClick(cell.date)}
          weekday={cell.date.getDay()}
          monthRef={month}
        />
      ))}
    </div>
  );
}

function MonthCell({
  date,
  inMonth,
  items,
  isToday,
  isSelected,
  onClick,
  weekday,
}: {
  date: Date;
  inMonth: boolean;
  items: ScheduleItem[];
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
  weekday: number;
  monthRef: Date;
}) {
  const visible = items.slice(0, 3);
  const extra = items.length - visible.length;
  const dayColor = !inMonth
    ? C.overlay0
    : weekday === 0
      ? C.red
      : weekday === 6
        ? C.sky
        : C.text;
  return (
    <button
      type="button"
      onClick={inMonth ? onClick : undefined}
      disabled={!inMonth}
      className="relative text-left h-full min-h-0"
      style={{
        background: inMonth ? C.base : C.mantle,
        outline: isSelected ? `2px solid ${C.mauve}` : undefined,
        outlineOffset: isSelected ? "-2px" : undefined,
      }}
    >
      <div className="absolute inset-0 overflow-hidden p-1 flex flex-col gap-px">
        <div className="flex justify-end">
          {isToday ? (
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px]"
              style={{ background: C.mauve, color: C.base, fontWeight: 600 }}
            >
              {date.getDate()}
            </span>
          ) : (
            <span className="text-[11px]" style={{ color: dayColor }}>
              {date.getDate()}
            </span>
          )}
        </div>
        {visible.map((it) => (
          <MonthChip key={it.id} item={it} />
        ))}
        {extra > 0 && (
          <div className="text-[10px]" style={{ color: C.subtext0 }}>
            +{extra}
          </div>
        )}
      </div>
    </button>
  );
}

function MonthChip({ item }: { item: ScheduleItem }) {
  const dot =
    item.type === "task"
      ? getStatusColor(item.status)
      : getTypeAccent(item.type);
  const strike = item.type === "task" && item.status === "done";
  return (
    <div
      className="h-4 flex items-center gap-1 px-1 rounded text-[10px] truncate"
      style={{ background: C.surface0 }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: dot }}
      />
      <span
        className="truncate"
        style={{
          color: strike ? C.overlay0 : C.text,
          textDecoration: strike ? "line-through" : undefined,
        }}
      >
        {item.title}
      </span>
    </div>
  );
}

function ThreeDayView({
  days,
  itemsByDay,
  today,
  onEventClick,
  onSlotClick,
}: {
  days: Date[];
  itemsByDay: Map<string, ScheduleItem[]>;
  today: Date;
  onEventClick: (item: ScheduleItem) => void;
  onSlotClick: (day: Date, hour: number) => void;
}) {
  const totalHeight = (HOUR_END - HOUR_START) * HOUR_PX;
  return (
    <div className="flex flex-col">
      <div
        className="grid grid-cols-[40px_repeat(3,1fr)] sticky top-0 z-10"
        style={{
          background: C.mantle,
          borderBottom: `1px solid ${C.surface1}`,
        }}
      >
        <div className="h-12" />
        {days.map((d) => {
          const todayLabel = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className="h-12 flex flex-col items-center justify-center text-xs"
              style={{
                color: todayLabel ? C.mauve : C.subtext0,
                fontWeight: todayLabel ? 600 : 400,
              }}
            >
              <div>{formatDayHeader(d)}</div>
              {todayLabel && (
                <div className="text-[10px] mt-0.5" style={{ color: C.mauve }}>
                  今日
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div
        className="grid grid-cols-[40px_repeat(3,1fr)] relative"
        style={{ height: totalHeight }}
      >
        <div className="relative">
          {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 text-[10px] text-right pr-1"
              style={{
                top: i * HOUR_PX,
                color: C.subtext0,
              }}
            >
              {HOUR_START + i}:00
            </div>
          ))}
        </div>
        {days.map((d) => (
          <DayColumn
            key={d.toISOString()}
            day={d}
            isToday={isSameDay(d, today)}
            items={itemsByDay.get(ymd(d)) ?? []}
            onEventClick={onEventClick}
            onSlotClick={(hour) => onSlotClick(d, hour)}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({
  isToday,
  items,
  onEventClick,
  onSlotClick,
}: {
  day: Date;
  isToday: boolean;
  items: ScheduleItem[];
  onEventClick: (item: ScheduleItem) => void;
  onSlotClick: (hour: number) => void;
}) {
  return (
    <div
      className="relative"
      style={{
        background: isToday ? C.surface0 : C.base,
        borderLeft: `1px solid ${C.surface1}`,
      }}
    >
      {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => {
        const hour = HOUR_START + i;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSlotClick(hour)}
            aria-label={`${hour}:00 に予定を追加`}
            className="absolute left-0 right-0 text-left active:bg-white/5"
            style={{
              top: i * HOUR_PX,
              height: HOUR_PX,
              borderTop: `1px solid ${C.surface1}40`,
            }}
          />
        );
      })}
      {items.map((it) => (
        <TimelineEvent key={it.id} item={it} onClick={() => onEventClick(it)} />
      ))}
    </div>
  );
}

function TimelineEvent({
  item,
  onClick,
}: {
  item: ScheduleItem;
  onClick: () => void;
}) {
  if (!item.time) {
    return null;
  }
  const [hh, mm] = item.time.split(":").map(Number);
  const start = (hh - HOUR_START) * HOUR_PX + (mm / 60) * HOUR_PX;
  let height = HOUR_PX;
  if (item.endTime) {
    const [eh, em] = item.endTime.split(":").map(Number);
    const endMin = eh * 60 + em - (hh * 60 + mm);
    height = Math.max(24, (endMin / 60) * HOUR_PX);
  }
  const accent =
    item.type === "task"
      ? getStatusColor(item.status)
      : getTypeAccent(item.type);
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute left-1 right-1 rounded text-left px-1 py-0.5 overflow-hidden"
      style={{
        top: start,
        height,
        background: `${accent}33`,
        borderLeft: `3px solid ${accent}`,
        color: C.text,
      }}
    >
      <div className="text-[10px] truncate font-medium">{item.title}</div>
      <div className="text-[9px]" style={{ color: C.subtext0 }}>
        {item.time}
        {item.endTime ? `-${item.endTime}` : ""}
      </div>
    </button>
  );
}

function ListView({
  groups,
  tagById,
  onToggleStatus,
  onRowClick,
  onTagClick,
}: {
  groups: ListGroup[];
  tagById: Map<string, WikiTag>;
  onToggleStatus: (item: ScheduleItem) => void;
  onRowClick: (item: ScheduleItem) => void;
  onTagClick: (tagId: string) => void;
}) {
  if (groups.length === 0) {
    return (
      <div
        className="h-full flex items-center justify-center text-sm"
        style={{ color: C.subtext0 }}
      >
        該当する予定がありません
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      {groups.map((g) => (
        <section key={g.label}>
          <header
            className="px-4 py-2 text-xs font-medium sticky top-0 z-10"
            style={{
              background: C.mantle,
              color: C.subtext1,
              borderBottom: `1px solid ${C.surface1}`,
            }}
          >
            {g.label} ({g.items.length})
          </header>
          {g.items.map((it) => (
            <ListItemRow
              key={it.id}
              item={it}
              tagById={tagById}
              onToggleStatus={() => onToggleStatus(it)}
              onClick={() => onRowClick(it)}
              onTagClick={onTagClick}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function ListItemRow({
  item,
  tagById,
  onToggleStatus,
  onClick,
  onTagClick,
}: {
  item: ScheduleItem;
  tagById: Map<string, WikiTag>;
  onToggleStatus: () => void;
  onClick: () => void;
  onTagClick: (id: string) => void;
}) {
  const isReadonly = item.type === "holiday" || item.type === "birthday";
  const accent =
    item.type === "task"
      ? getStatusColor(item.status)
      : getTypeAccent(item.type);
  return (
    <div
      className="flex items-center min-h-[56px] px-1 gap-1"
      style={{ borderBottom: `1px solid ${C.surface1}` }}
    >
      <StatusCheckbox
        status={item.status}
        onClick={onToggleStatus}
        disabled={isReadonly}
      />
      <button
        type="button"
        onClick={onClick}
        className="flex-1 text-left flex flex-col gap-0.5 min-w-0 py-2 active:opacity-70"
      >
        <div className="flex items-center gap-2 min-w-0">
          {item.type !== "task" && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
              style={{ background: `${accent}22`, color: accent }}
            >
              {item.type === "event"
                ? "予定"
                : item.type === "birthday"
                  ? "誕生日"
                  : "祝日"}
            </span>
          )}
          {item.time && (
            <span className="text-xs shrink-0" style={{ color: C.subtext0 }}>
              {item.time}
              {item.endTime ? `-${item.endTime}` : ""}
            </span>
          )}
          <span
            className="text-sm truncate"
            style={{
              color:
                item.status === "done" && item.type === "task"
                  ? C.overlay0
                  : C.text,
              textDecoration:
                item.status === "done" && item.type === "task"
                  ? "line-through"
                  : undefined,
            }}
          >
            {item.title}
          </span>
        </div>
      </button>
      <div className="flex items-center gap-1 pr-2 max-w-[40%] overflow-hidden">
        {item.wikiTagIds.slice(0, 2).map((id) => {
          const t = tagById.get(id);
          if (!t) return null;
          return (
            <WikiTagChip key={id} tag={t} onClick={() => onTagClick(id)} />
          );
        })}
        {item.wikiTagIds.length > 2 && (
          <span className="text-[10px]" style={{ color: C.subtext0 }}>
            +{item.wikiTagIds.length - 2}
          </span>
        )}
      </div>
    </div>
  );
}

function DayDetailSheet({
  open,
  date,
  items,
  tagById,
  onClose,
  onAdd,
  onOpenThree,
  onRowClick,
  onToggleStatus,
  onTagClick,
}: {
  open: boolean;
  date: Date | null;
  items: ScheduleItem[];
  tagById: Map<string, WikiTag>;
  onClose: () => void;
  onAdd: () => void;
  onOpenThree: () => void;
  onRowClick: (item: ScheduleItem) => void;
  onToggleStatus: (item: ScheduleItem) => void;
  onTagClick: (id: string) => void;
}) {
  const title = date
    ? `${date.getMonth() + 1}月${date.getDate()}日 (${WEEK_DAYS_JA[date.getDay()]})`
    : "";
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      rightLabel="+ 追加"
      onRightClick={onAdd}
    >
      <div className="flex flex-col">
        {items.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-3 text-sm py-10"
            style={{ color: C.subtext0 }}
          >
            <div>この日に予定はありません</div>
            <button
              type="button"
              onClick={onAdd}
              className="h-10 px-4 rounded-md text-sm font-medium flex items-center gap-2"
              style={{ background: C.mauve, color: C.base }}
            >
              <Plus size={16} /> 予定を追加
            </button>
          </div>
        ) : (
          items.map((it) => (
            <ListItemRow
              key={it.id}
              item={it}
              tagById={tagById}
              onToggleStatus={() => onToggleStatus(it)}
              onClick={() => onRowClick(it)}
              onTagClick={onTagClick}
            />
          ))
        )}
        <div
          className="grid grid-cols-2 gap-2 p-3"
          style={{ borderTop: `1px solid ${C.surface1}` }}
        >
          <button
            type="button"
            onClick={onAdd}
            className="h-10 rounded-md text-sm font-medium flex items-center justify-center gap-1"
            style={{ background: C.mauve, color: C.base }}
          >
            <Plus size={16} /> 予定を追加
          </button>
          <button
            type="button"
            onClick={onOpenThree}
            className="h-10 rounded-md text-sm flex items-center justify-center gap-1"
            style={{ border: `1px solid ${C.surface1}`, color: C.text }}
          >
            <Clock size={16} /> 3日ビューで開く
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function AddEventModal({
  draft,
  tags,
  tagById,
  onChange,
  onClose,
  onSave,
  onAskDelete,
  onOpenTagSheet,
  tagSheetOpen,
  onCloseTagSheet,
}: {
  draft: EditDraft;
  tags: WikiTag[];
  tagById: Map<string, WikiTag>;
  onChange: (d: EditDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onAskDelete: () => void;
  onOpenTagSheet: () => void;
  tagSheetOpen: boolean;
  onCloseTagSheet: () => void;
}) {
  const isHoliday = draft.type === "holiday";
  const isBirthday = draft.type === "birthday";
  const isEditing = !!draft.id;
  const role = draft.role;
  // role 別フォーム出し分け（C-3）
  const isNoteLike = role === "note" || role === "daily"; // 本文中心・時刻なし
  const isRoutine = role === "routine";
  const showDate = role !== "note"; // note は日付を持たない
  const showTime = !isBirthday && !isNoteLike; // task/event/routine のみ時刻
  const bodyLabel = isNoteLike ? "本文" : "説明 (任意)";
  const titleValid = draft.title.trim().length > 0;
  const eventTimeMissing =
    role === "event" && !isBirthday && (!draft.due || !draft.time);
  const dailyDateMissing = role === "daily" && !draft.due;
  const canSave =
    titleValid && !isHoliday && !eventTimeMissing && !dailyDateMissing;
  const headerTitle = isEditing ? "予定の編集" : `${roleLabelJa(role)}の追加`;

  // Esc で閉じる。テキスト入力中の IME 変換キャンセル (Escape) では閉じない。
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !e.isComposing) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={headerTitle}
      className="absolute inset-0 z-50 flex flex-col"
      style={{ background: C.base }}
    >
      <header
        className="h-12 flex items-center px-1 shrink-0"
        style={{
          background: C.surface0,
          borderBottom: `1px solid ${C.surface1}`,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X size={20} color={C.text} />
        </button>
        <h2
          className="flex-1 text-center text-base font-medium"
          style={{ color: C.text }}
        >
          {headerTitle}
        </h2>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="text-sm px-3 min-h-[44px] rounded-md mr-1 disabled:opacity-50"
          style={{ background: C.mauve, color: C.base, fontWeight: 600 }}
        >
          保存
        </button>
      </header>

      {isHoliday && (
        <div
          className="px-3 py-2 text-xs"
          style={{ background: `${C.red}22`, color: C.red }}
        >
          祝日は編集できません (読み取り専用)
        </div>
      )}

      <div className="flex-1 overflow-auto p-3 flex flex-col gap-4">
        <Field label="タイトル">
          <input
            value={draft.title}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            disabled={isHoliday}
            placeholder="新しい予定"
            className="w-full h-11 rounded-md px-3 text-sm"
            style={{
              background: C.surface0,
              color: C.text,
              border: `1px solid ${C.surface1}`,
            }}
          />
        </Field>

        {!isEditing && (
          <Field label="種類">
            <div
              role="radiogroup"
              aria-label="作成する項目の種類"
              className="grid grid-cols-5 gap-1.5"
            >
              {ROLE_OPTIONS.map((opt) => {
                const active = role === opt.v;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() =>
                      onChange({
                        ...draft,
                        role: opt.v,
                        // schedule item として保存するのは task/event のみ。
                        // それ以外は有効な ScheduleItemType "task" を維持（保存は分岐で抑止）。
                        type: opt.v === "event" ? "event" : "task",
                        // 時刻を持たない role では時刻をクリア
                        time:
                          opt.v === "note" || opt.v === "daily"
                            ? ""
                            : draft.time,
                        endTime:
                          opt.v === "note" || opt.v === "daily"
                            ? ""
                            : draft.endTime,
                      })
                    }
                    className="min-h-[44px] rounded-md text-xs px-0.5"
                    style={{
                      background: active ? C.mauve : C.surface0,
                      color: active ? C.base : C.text,
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {!isEditing && isRoutine && (
          <Field label="繰り返し">
            <div
              role="radiogroup"
              aria-label="繰り返し間隔"
              className="grid grid-cols-3 gap-2"
            >
              {(
                [
                  { v: "daily", label: "毎日" },
                  { v: "weekly", label: "毎週" },
                  { v: "monthly", label: "毎月" },
                ] as const
              ).map((opt) => {
                const active = draft.recurrence === opt.v;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange({ ...draft, recurrence: opt.v })}
                    className="min-h-[44px] rounded-md text-sm"
                    style={{
                      background: active ? C.mauve : C.surface0,
                      color: active ? C.base : C.text,
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {showDate && (
          <Field
            label={
              isRoutine ? "開始日" : role === "daily" ? "日付 (必須)" : "日付"
            }
          >
            <input
              type="date"
              value={draft.due}
              onChange={(e) => onChange({ ...draft, due: e.target.value })}
              disabled={isHoliday}
              className="w-full h-11 rounded-md px-3 text-sm"
              style={{
                background: C.surface0,
                color: C.text,
                border: `1px solid ${C.surface1}`,
              }}
            />
          </Field>
        )}

        {showTime && (
          <Field label={role === "event" ? "時刻 (必須)" : "時刻 (任意)"}>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                value={draft.time}
                onChange={(e) => onChange({ ...draft, time: e.target.value })}
                disabled={isHoliday}
                className="h-11 rounded-md px-3 text-sm"
                style={{
                  background: C.surface0,
                  color: C.text,
                  border: `1px solid ${C.surface1}`,
                }}
              />
              <input
                type="time"
                value={draft.endTime}
                onChange={(e) =>
                  onChange({ ...draft, endTime: e.target.value })
                }
                disabled={isHoliday}
                placeholder="終了"
                className="h-11 rounded-md px-3 text-sm"
                style={{
                  background: C.surface0,
                  color: C.text,
                  border: `1px solid ${C.surface1}`,
                }}
              />
            </div>
          </Field>
        )}

        <Field label="タグ">
          <div className="flex items-center flex-wrap gap-2">
            {draft.wikiTagIds.map((id) => {
              const tag = tagById.get(id);
              if (!tag) return null;
              return (
                <WikiTagChip
                  key={id}
                  tag={tag}
                  size="md"
                  onRemove={
                    isHoliday
                      ? undefined
                      : () =>
                          onChange({
                            ...draft,
                            wikiTagIds: draft.wikiTagIds.filter(
                              (x) => x !== id,
                            ),
                          })
                  }
                />
              );
            })}
            {!isHoliday && (
              <button
                type="button"
                onClick={onOpenTagSheet}
                aria-label="タグを追加"
                className="h-7 min-w-[28px] px-2 rounded-full text-xs flex items-center gap-1"
                style={{
                  background: C.surface0,
                  color: C.subtext0,
                  border: `1px dashed ${C.surface1}`,
                }}
              >
                <Plus size={12} /> 追加
              </button>
            )}
          </div>
        </Field>

        <Field label={bodyLabel}>
          <textarea
            value={draft.description}
            onChange={(e) =>
              onChange({ ...draft, description: e.target.value })
            }
            disabled={isHoliday}
            rows={isNoteLike ? 6 : 4}
            placeholder={isNoteLike ? "本文を入力..." : undefined}
            className="w-full rounded-md px-3 py-2 text-sm leading-relaxed"
            style={{
              background: C.surface0,
              color: C.text,
              border: `1px solid ${C.surface1}`,
              resize: "vertical",
            }}
          />
        </Field>

        {isEditing && !isHoliday && (
          <button
            type="button"
            onClick={onAskDelete}
            className="h-11 rounded-md text-sm flex items-center justify-center gap-2 mt-2"
            style={{
              border: `1px solid ${C.red}`,
              color: C.red,
              background: "transparent",
            }}
          >
            <Trash2 size={16} /> ゴミ箱へ移動
          </button>
        )}
      </div>

      <TagSheet
        open={tagSheetOpen}
        tags={tags}
        selectedIds={draft.wikiTagIds}
        onClose={onCloseTagSheet}
        onPick={(id) =>
          onChange({
            ...draft,
            wikiTagIds: draft.wikiTagIds.includes(id)
              ? draft.wikiTagIds.filter((x) => x !== id)
              : [...draft.wikiTagIds, id],
          })
        }
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: C.subtext0 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function TagSheet({
  open,
  tags,
  selectedIds,
  onClose,
  onPick,
}: {
  open: boolean;
  tags: WikiTag[];
  selectedIds: string[];
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(TAG_COLOR_OPTIONS[0]);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleCreate = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key !== "Enter") return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    const created = addWikiTag(trimmed, newColor);
    onPick(created.id);
    setNewName("");
  };
  return (
    <BottomSheet open={open} onClose={onClose} title="タグ">
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto p-3 flex flex-col gap-2">
          {tags.map((t) => {
            const selected = selectedIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onPick(t.id)}
                className="min-h-[44px] px-3 rounded-md flex items-center gap-2 text-left"
                style={{
                  background: selected ? C.surface1 : C.surface0,
                  color: C.text,
                }}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: t.color }}
                />
                <span className="text-sm flex-1">#{t.name}</span>
                {selected && <Check size={16} color={C.green} />}
              </button>
            );
          })}
        </div>
        <div
          className="p-3 flex items-center gap-2 shrink-0"
          style={{ borderTop: `1px solid ${C.surface1}` }}
        >
          <select
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            aria-label="新しいタグの色"
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
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleCreate}
            placeholder="新しいタグ名 + Enter"
            className="flex-1 h-10 rounded-md px-3 text-sm"
            style={{
              background: C.surface0,
              color: C.text,
              border: `1px solid ${C.surface1}`,
            }}
          />
        </div>
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
  useDismissOnEscape(true, onCancel);
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        aria-label="閉じる"
        className="absolute inset-0 z-[60]"
        style={{ background: C.crust, opacity: 0.7 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[88%] z-[60] rounded-xl p-4 flex flex-col gap-3"
        style={{
          background: C.base,
          border: `1px solid ${C.surface1}`,
        }}
      >
        <div className="text-sm font-medium" style={{ color: C.text }}>
          {title}
        </div>
        {message && (
          <div className="text-xs" style={{ color: C.subtext0 }}>
            {message}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-md text-sm"
            style={{
              border: `1px solid ${C.surface1}`,
              color: C.text,
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 rounded-md text-sm font-medium"
            style={{
              background: danger ? C.red : C.mauve,
              color: C.base,
            }}
          >
            実行
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Schedule-specific sidebar body, rendered inside the shared <Drawer>.
 *
 * The Drawer owns the slide-in panel + backdrop chrome; this component returns
 * only the filter header + body. Cross-section search now lives in the shared
 * AppHeader, so this sidebar is filter-only. The X button here closes the whole
 * drawer via `onClose` (= shell `closeSidebar`).
 */
function ScheduleSidebarContent({
  onClose,
  wikiTags,
  filterTagIds,
  onToggleTagFilter,
  filterStatuses,
  onToggleStatusFilter,
  filterTypes,
  onToggleTypeFilter,
  sortKey,
  onChangeSortKey,
}: {
  onClose: () => void;
  wikiTags: WikiTag[];
  filterTagIds: string[];
  onToggleTagFilter: (id: string) => void;
  filterStatuses: TaskStatus[];
  onToggleStatusFilter: (s: TaskStatus) => void;
  filterTypes: ScheduleItemType[];
  onToggleTypeFilter: (t: ScheduleItemType) => void;
  sortKey: SortKey;
  onChangeSortKey: (k: SortKey) => void;
}) {
  return (
    <>
      <header
        className="h-12 flex items-center px-1 shrink-0"
        style={{ borderBottom: `1px solid ${C.surface1}` }}
      >
        <div
          className="min-h-[44px] min-w-[44px] flex items-center justify-center"
          style={{ color: C.mauve }}
        >
          <FilterIcon size={20} />
        </div>
        <div
          className="flex-1 text-sm font-medium"
          style={{ color: C.subtext1 }}
        >
          フィルタ
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X size={20} color={C.text} />
        </button>
      </header>
      <div className="flex-1 overflow-auto">
        <div className="flex flex-col">
          <FilterSection title="タイプ">
            {(
              [
                { v: "event", label: "イベント", color: C.sky },
                { v: "task", label: "タスク", color: C.green },
                { v: "birthday", label: "誕生日", color: C.peach },
                { v: "holiday", label: "祝日", color: C.red },
              ] as { v: ScheduleItemType; label: string; color: string }[]
            ).map(({ v, label, color }) => {
              const selected = filterTypes.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onToggleTypeFilter(v)}
                  className="min-h-[44px] px-3 flex items-center gap-2 text-left"
                  style={{
                    background: selected ? C.surface0 : "transparent",
                    color: C.text,
                  }}
                  aria-pressed={selected}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="text-sm flex-1">{label}</span>
                  {selected && <Check size={16} color={C.green} />}
                </button>
              );
            })}
          </FilterSection>
          <FilterSection title="並び順 (DayFlow)">
            {(
              [
                { v: "time", label: "時刻順" },
                { v: "updatedAt", label: "更新日時 (新しい順)" },
                { v: "title", label: "タイトル順" },
              ] as { v: SortKey; label: string }[]
            ).map(({ v, label }) => {
              const selected = sortKey === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChangeSortKey(v)}
                  className="min-h-[44px] px-3 flex items-center gap-2 text-left"
                  style={{
                    background: selected ? C.surface0 : "transparent",
                    color: C.text,
                  }}
                  role="radio"
                  aria-checked={selected}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{
                      background: selected ? C.mauve : "transparent",
                      border: `1px solid ${selected ? C.mauve : C.overlay0}`,
                    }}
                  />
                  <span className="text-sm flex-1">{label}</span>
                </button>
              );
            })}
          </FilterSection>
          {wikiTags.length > 0 && (
            <FilterSection title="タグ">
              {wikiTags.map((t) => {
                const selected = filterTagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onToggleTagFilter(t.id)}
                    className="min-h-[44px] px-3 flex items-center gap-2 text-left"
                    style={{
                      background: selected ? C.surface0 : "transparent",
                      color: C.text,
                    }}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ background: t.color }}
                    />
                    <span className="text-sm flex-1">#{t.name}</span>
                    {selected && <Check size={16} color={C.green} />}
                  </button>
                );
              })}
            </FilterSection>
          )}
          <FilterSection title="ステータス">
            {(["todo", "doing", "done"] as const).map((s) => {
              const selected = filterStatuses.includes(s);
              const label =
                s === "todo" ? "未着手" : s === "doing" ? "進行中" : "完了";
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onToggleStatusFilter(s)}
                  className="min-h-[44px] px-3 flex items-center gap-2 text-left"
                  style={{
                    background: selected ? C.surface0 : "transparent",
                    color: C.text,
                  }}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: getStatusColor(s) }}
                  />
                  <span className="text-sm flex-1">{label}</span>
                  {selected && <Check size={16} color={C.green} />}
                </button>
              );
            })}
          </FilterSection>
        </div>
      </div>
    </>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header
        className="px-3 py-2 text-[11px] tracking-wider uppercase"
        style={{
          color: C.subtext0,
          background: C.crust,
        }}
      >
        {title}
      </header>
      {children}
    </section>
  );
}
