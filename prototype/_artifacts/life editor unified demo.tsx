/**
 * ============================================================================
 *  life-editor mobile - Schedule view (Unified Demo)
 * ============================================================================
 *
 *  ⚠️ 不変要件マニフェスト (Invariant Manifest)
 *  ----------------------------------------------------------------------------
 *  本ファイルが定義する以下の要件は、引き継ぎチャット・本実装移植・
 *  Claude Code でのマージ時においても必ず維持しなければならない。
 *
 *  [MV-1] MonthView Calendar Cell Invariant (最重要)
 *    - 月ビューの 42 セルは、内部イベント件数 (0〜N) に関わらず
 *      すべて 幅:高さ = 1:1.5 の完全同一サイズで固定。
 *    - 「アイテム数で行高が変動する」状態は仕様違反。
 *    - 実装: 外側 `relative` + `paddingBottom: '150%'`
 *           内側 `absolute inset-0 overflow-hidden`
 *    - 採用理由: `aspect-ratio` は Grid セル内でコンテンツ無しの場合に
 *      高さがゼロに潰れる挙動が発生するため、より確実な
 *      padding-bottom: 150% パターン (古典的aspect-ratio実装) を採用。
 *      padding のパーセント値は親要素 (=Gridセル) の幅を基準にするため、
 *      Grid セル幅が決まれば高さが自動的に確定する。
 *    - 禁止: `min-h-[Npx]`, `aspect-[N/M]` への依存
 *    - 表示: 最大3件 + 超過は「+N」で集約
 *    - 詳細: schedule-spec.md
 *
 *  [TAB-1] BottomTab グレーアウト要件
 *    - Schedule 以外のタブ (Work / Materials / Settings) は
 *      enabled:false でグレーアウト、切替不可。
 *    - 「今後実装予定」が視覚的に伝わる状態を維持。
 *
 *  [FAB-1] FAB 固定配置要件
 *    - 追加ボタンは Schedule タブの全ビューで画面右下に常時固定。
 *    - スクロールで追従させない。
 *    - 実装: <main> の外側兄弟として absolute 配置、ルートは h-screen。
 *
 *  [STATUS-1] タスクステータス循環要件
 *    - チェックボックスタップで 未→中→完→未 の順に循環。
 *    - ビジュアル: 未=空 / 中=Yellow塗りつぶし / 完=Greenチェック。
 *    - 時刻あり/なしを問わず、全予定で同一の UI を使う。
 *
 *  [SHEET-1] DayDetailSheet 要件
 *    - 月ビュー(MonthView)の当月日付セルをタップで起動。
 *    - 高さ: 画面の 50% で固定 (h-1/2)。
 *    - 月外日付 (前月末・翌月初) はタップ無効。
 *    - 開いた状態で他の日付をタップ → 内容のみ切替 (シートは閉じない)。
 *    - 閉じる: バックドロップタップ、X ボタン。
 *    - 「+ 予定を追加」→ AddEventModal を **選択日プリセット** で開く。
 *    - 「3日ビューで開く」→ scheduleView を 'three' に切替 (シートは閉じる)。
 *    - 実装: transform: translateY(100%↔0) + transition-transform duration-300。
 *
 *  [DATA-1] 当面のデータ分離 (TODO: 将来統一)
 *    - 予定リスト (ListView) は `groups` 配列 (今日/明日/今週/期限なし)。
 *    - 月ビュー (MonthView) + ボトムシート は `eventsByDate` (日付別 Record)。
 *    - 現状は別管理。
 *    - 将来は単一データソース (events: DayEvent[]) から両方を導出する形に統合予定。
 *      その際は AddEventModal の保存先も統一する。
 *
 *  [SIDEBAR-1] Sidebar 検索・フィルタ要件
 *    - サイドバー最上部に「検索」「フィルタ」アイコンを横並びで配置。
 *    - タップでサイドバー内にパネルを **排他展開**。
 *      (検索開いた状態でフィルタタップ → 検索閉じてフィルタ開く)
 *    - 検索パネル: テキスト入力欄 (Search アイコン + Input + クリア)。
 *    - フィルタパネル: 3 セクション
 *        - タグ        (dev / work / biz / holiday)
 *        - ステータス  (未着手 / 着手中 / 完了)
 *        - カレンダー  (個人 / 仕事 / 祝日 / 誕生日)
 *    - 旧 ScheduleSidebar の「カレンダー」独立セクションは廃止し、
 *      フィルタパネル内に統合 (サイドバー上で一元管理)。
 *    - 当面は UI のみ、実際の絞り込み機能は未実装。
 *      (将来実装する際はデータ統合 [DATA-1] と同時期が自然)
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  FileText,
  Settings as SettingsIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  Menu,
  X,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

// =============================================
// Catppuccin Mocha palette
// =============================================
const C = {
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',
  surface0: '#313244',
  surface1: '#45475a',
  surface2: '#585b70',
  overlay0: '#6c7086',
  text: '#cdd6f4',
  subtext1: '#bac2de',
  subtext0: '#a6adc8',
  mauve: '#cba6f7',
  pink: '#f5c2e7',
  peach: '#fab387',
  yellow: '#f9e2af',
  green: '#a6e3a1',
  sky: '#89dceb',
  blue: '#89b4fa',
  red: '#f38ba8',
};

type TabKey = 'schedule' | 'work' | 'materials' | 'settings';
type ScheduleView = 'month' | 'three' | 'list';

// =============================================
// Schedule domain types
// =============================================
type TaskStatus = 'todo' | 'doing' | 'done';
type TagKey = 'dev' | 'work' | 'biz' | 'holiday';

type ListItem = {
  id: string;
  title: string;
  time: string | null;
  tag: TagKey;
  status: TaskStatus;
  memo?: string;
};

type Group = {
  label: string;
  items: ListItem[];
};

// ステータスの循環順 (タップごとに次のステータスへ)
const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'doing',
  doing: 'done',
  done: 'todo',
};

// タグ色マッピング
const TAG_COLORS: Record<TagKey, string> = {
  dev: C.mauve,
  work: C.sky,
  biz: C.peach,
  holiday: C.pink,
};

// 初期データ (コンポーネント外に置くことで毎レンダリングでの再生成を防ぐ)
const INITIAL_GROUPS: Group[] = [
  {
    label: '今日',
    items: [
      { id: 't-1', title: 'チームMTG', time: '10:00 - 11:00', tag: 'work', status: 'todo' },
      { id: 't-2', title: 'life-editor 仕様書レビュー', time: null, tag: 'dev', status: 'doing' },
      { id: 't-3', title: '請求書を送る', time: null, tag: 'biz', status: 'done' },
    ],
  },
  {
    label: '明日',
    items: [
      { id: 't-4', title: '統合版デモのフィードバック反映', time: null, tag: 'dev', status: 'todo' },
    ],
  },
  {
    label: '今週',
    items: [
      { id: 't-5', title: '海の日(祝日)', time: '7月20日', tag: 'holiday', status: 'todo' },
      { id: 't-6', title: 'MCP Server の検証', time: null, tag: 'dev', status: 'doing' },
    ],
  },
  {
    label: '期限なし',
    items: [
      { id: 't-7', title: 'ターミナル機能の削除', time: null, tag: 'dev', status: 'todo' },
    ],
  },
];

// =============================================
// MonthView + DayDetailSheet 用データ (日付ベース)
// [DATA-1]: 当面 INITIAL_GROUPS と分離管理。将来統一予定。
// =============================================
type DayEventType = 'birthday' | 'holiday' | 'event';

type DayEvent = {
  id: string;
  title: string;
  time: string | null; // null = 終日
  tag: TagKey;
  status: TaskStatus;
  type: DayEventType; // 月ビューでのチップ色分けに利用
};

// 月ビューでタップされた日付の特定情報
type SelectedDay = {
  year: number;
  month: number;
  date: number;
};

// 日付キー = "M-D" (例: "7-19")
const dayKey = (month: number, date: number) => `${month}-${date}`;

const INITIAL_EVENTS_BY_DATE: Record<string, DayEvent[]> = {
  '7-1': [
    { id: 'd-7-1-1', title: 'お母さん誕生日', time: null, tag: 'holiday', status: 'todo', type: 'birthday' },
  ],
  '7-13': [
    { id: 'd-7-13-1', title: 'チームMTG', time: '10:00 - 11:00', tag: 'work', status: 'todo', type: 'event' },
  ],
  '7-19': [
    { id: 'd-7-19-1', title: 'チームMTG', time: '10:00 - 11:00', tag: 'work', status: 'todo', type: 'event' },
    { id: 'd-7-19-2', title: 'life-editor 仕様書レビュー', time: null, tag: 'dev', status: 'doing', type: 'event' },
    { id: 'd-7-19-3', title: '請求書を送る', time: null, tag: 'biz', status: 'done', type: 'event' },
  ],
  '7-20': [
    { id: 'd-7-20-1', title: '海の日', time: null, tag: 'holiday', status: 'todo', type: 'holiday' },
  ],
  '7-24': [
    { id: 'd-7-24-1', title: '通院', time: '09:00 - 10:00', tag: 'biz', status: 'todo', type: 'event' },
    { id: 'd-7-24-2', title: '読書会', time: '14:00 - 16:00', tag: 'biz', status: 'todo', type: 'event' },
    { id: 'd-7-24-3', title: '〆切', time: null, tag: 'work', status: 'todo', type: 'event' },
    { id: 'd-7-24-4', title: 'リリース', time: null, tag: 'dev', status: 'todo', type: 'event' },
  ],
  '7-30': [
    { id: 'd-7-30-1', title: '誕生日', time: null, tag: 'holiday', status: 'todo', type: 'birthday' },
    { id: 'd-7-30-2', title: '飲み会', time: '19:00 - 22:00', tag: 'biz', status: 'todo', type: 'event' },
  ],
};

// =============================================
// Root
// =============================================
export default function LifeEditorUnifiedDemo() {
  // Schedule 以外はグレーアウト(切替不可)
  const [tab, setTab] = useState<TabKey>('schedule');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [addModalOpen, setAddModalOpen] = useState(false);
  // AddEventModal の defaultDate (ボトムシート経由の +追加 でセットされる)
  const [addModalDefaultDate, setAddModalDefaultDate] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  // [DATA-1] eventsByDate は MonthView + DayDetailSheet で共有
  const [eventsByDate, setEventsByDate] = useState<Record<string, DayEvent[]>>(
    INITIAL_EVENTS_BY_DATE,
  );

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Schedule 以外は受け付けない (今後実装予定)
  const changeTab = useCallback((t: TabKey) => {
    if (t !== 'schedule') return;
    setTab(t);
    setSidebarOpen(false);
  }, []);

  // ステータスを 未→中→完→未 の順で循環させる
  const handleToggleStatus = useCallback((groupIdx: number, itemId: string) => {
    setGroups((prev) =>
      prev.map((g, gi) => {
        if (gi !== groupIdx) return g;
        return {
          ...g,
          items: g.items.map((it) =>
            it.id === itemId ? { ...it, status: NEXT_STATUS[it.status] } : it,
          ),
        };
      }),
    );
  }, []);

  // eventsByDate 側のステータスを循環させる (ボトムシートのチェックボックス用)
  const handleToggleDayEventStatus = useCallback((dateKey: string, eventId: string) => {
    setEventsByDate((prev) => {
      const list = prev[dateKey];
      if (!list) return prev;
      return {
        ...prev,
        [dateKey]: list.map((ev) =>
          ev.id === eventId ? { ...ev, status: NEXT_STATUS[ev.status] } : ev,
        ),
      };
    });
  }, []);

  // 新規予定追加: 「今日」グループ末尾に追加 (ListView 側のデータに反映)
  // [DATA-1] により当面 eventsByDate には反映しない
  const handleAddItem = useCallback(
    (input: { title: string; date: string; time: string | null; tag: TagKey; memo: string }) => {
      const newItem: ListItem = {
        id: `item-${Date.now()}`,
        title: input.title,
        time: input.time,
        tag: input.tag,
        status: 'todo',
        memo: input.memo || undefined,
      };
      setGroups((prev) =>
        prev.map((g, gi) => (gi === 0 ? { ...g, items: [...g.items, newItem] } : g)),
      );
    },
    [],
  );

  // AddEventModal を起動。defaultDate を指定すると初期日付に反映
  const openAddModal = useCallback((defaultDate?: string) => {
    setAddModalDefaultDate(defaultDate ?? null);
    setAddModalOpen(true);
  }, []);
  const closeAddModal = useCallback(() => {
    setAddModalOpen(false);
    setAddModalDefaultDate(null);
  }, []);

  // FAB は日付プリセットなしで起動
  const handleFabAdd = useCallback(() => openAddModal(), [openAddModal]);

  return (
    <div
      className="h-screen mx-auto max-w-md flex flex-col relative overflow-hidden"
      style={{ background: C.base, color: C.text }}
    >
      <main className="flex-1 overflow-y-auto pb-20">
        <ScheduleScreen
          onMenu={openSidebar}
          groups={groups}
          onToggleStatus={handleToggleStatus}
          eventsByDate={eventsByDate}
          onToggleDayEventStatus={handleToggleDayEventStatus}
          onOpenAddModal={openAddModal}
        />
      </main>

      {/* FAB - main の外側で画面右下に絶対配置 */}
      <button
        onClick={handleFabAdd}
        className="absolute bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform duration-200 active:scale-95 z-40"
        style={{ background: C.mauve, color: C.base }}
        aria-label="新規予定追加"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      <BottomTabBar active={tab} onChange={changeTab} />
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />

      <AddEventModal
        open={addModalOpen}
        onClose={closeAddModal}
        onSave={handleAddItem}
        defaultDate={addModalDefaultDate}
      />
    </div>
  );
}

// =============================================
// Bottom Tab Bar
// Schedule 以外はグレーアウト(今後実装予定)
// =============================================
function BottomTabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  const items: { key: TabKey; label: string; icon: React.ReactNode; enabled: boolean }[] = [
    { key: 'schedule', label: 'Schedule', icon: <Calendar size={20} />, enabled: true },
    { key: 'work', label: 'Work', icon: <Clock size={20} />, enabled: false },
    { key: 'materials', label: 'Materials', icon: <FileText size={20} />, enabled: false },
    { key: 'settings', label: 'Settings', icon: <SettingsIcon size={20} />, enabled: false },
  ];
  return (
    <nav
      className="absolute bottom-0 left-0 right-0 border-t z-30"
      style={{ background: C.mantle, borderColor: C.surface0 }}
    >
      <div className="grid grid-cols-4">
        {items.map((it) => {
          const isActive = active === it.key;
          const color = !it.enabled ? C.surface2 : isActive ? C.mauve : C.overlay0;

          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              disabled={!it.enabled}
              className="flex flex-col items-center py-2.5 gap-0.5 transition-all duration-200 relative"
              style={{
                color,
                cursor: it.enabled ? 'pointer' : 'not-allowed',
                opacity: it.enabled ? 1 : 0.4,
              }}
              aria-label={!it.enabled ? `${it.label} (今後実装予定)` : it.label}
            >
              <div
                className="transition-transform duration-200"
                style={{ transform: isActive ? 'translateY(-2px)' : 'none' }}
              >
                {it.icon}
              </div>
              <span className="text-[10px] font-medium tracking-wide">{it.label}</span>
              {/* 未実装インジケーター: ラベル右上に小さなドット */}
              {!it.enabled && (
                <div
                  className="absolute top-1.5 right-1/2 -mr-3 w-1 h-1 rounded-full"
                  style={{ background: C.surface2 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// =============================================
// Left Sidebar (Drawer) - Schedule 専用
// =============================================
function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <div
        onClick={onClose}
        className="absolute inset-0 z-40 transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.5)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />
      <aside
        className="absolute top-0 bottom-0 left-0 w-72 z-50 flex flex-col transition-transform duration-300"
        style={{
          background: C.mantle,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <header
          className="flex items-center justify-between px-4 py-4 border-b"
          style={{ borderColor: C.surface0 }}
        >
          <div className="text-xs uppercase tracking-widest" style={{ color: C.overlay0 }}>
            Schedule
          </div>
          <button onClick={onClose} style={{ color: C.subtext1 }}>
            <X size={20} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">
          <ScheduleSidebar />
        </div>
      </aside>
    </>
  );
}

// =============================================
// Screen Header
// =============================================
function ScreenHeader({
  title,
  subtitle,
  onMenu,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  onMenu: () => void;
  rightAction?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between px-4 pt-4 pb-3">
      <button
        onClick={onMenu}
        className="p-2 -ml-2 rounded-lg transition-colors"
        style={{ color: C.subtext1 }}
        aria-label="メニューを開く"
      >
        <Menu size={22} />
      </button>
      <div className="flex-1 text-center">
        <div className="text-base font-semibold" style={{ color: C.text }}>
          {title}
        </div>
        {subtitle && (
          <div className="text-[11px] mt-0.5" style={{ color: C.overlay0 }}>
            {subtitle}
          </div>
        )}
      </div>
      <div className="min-w-[44px] flex justify-end">{rightAction}</div>
    </header>
  );
}

// =============================================
// Schedule Screen
// =============================================
function ScheduleScreen({
  onMenu,
  groups,
  onToggleStatus,
  eventsByDate,
  onToggleDayEventStatus,
  onOpenAddModal,
}: {
  onMenu: () => void;
  groups: Group[];
  onToggleStatus: (groupIdx: number, itemId: string) => void;
  eventsByDate: Record<string, DayEvent[]>;
  onToggleDayEventStatus: (dateKey: string, eventId: string) => void;
  onOpenAddModal: (defaultDate?: string) => void;
}) {
  const [view, setView] = useState<ScheduleView>('month');
  // ボトムシートで表示中の日付 (null なら閉じている)
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null);

  const handleDayTap = useCallback((day: SelectedDay) => {
    setSelectedDay(day);
  }, []);

  const closeSheet = useCallback(() => setSelectedDay(null), []);

  // ボトムシートの「+追加」: タップ日付を YYYY-MM-DD 形式に整形して AddEventModal を開く
  const handleSheetAdd = useCallback(() => {
    if (!selectedDay) return;
    const yyyy = String(selectedDay.year).padStart(4, '0');
    const mm = String(selectedDay.month).padStart(2, '0');
    const dd = String(selectedDay.date).padStart(2, '0');
    onOpenAddModal(`${yyyy}-${mm}-${dd}`);
    setSelectedDay(null); // ボトムシートは閉じる
  }, [selectedDay, onOpenAddModal]);

  // ボトムシートの「3日ビューで開く」
  const handleSheetOpenThree = useCallback(() => {
    setView('three');
    setSelectedDay(null);
  }, []);

  return (
    <div className="flex flex-col">
      <ScreenHeader
        title="Schedule"
        subtitle="2026年 7月"
        onMenu={onMenu}
        rightAction={
          <button
            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
            style={{ borderColor: C.surface1, color: C.subtext1 }}
          >
            今日
          </button>
        }
      />

      <div className="px-3 pb-3">
        <div className="flex p-1 rounded-xl" style={{ background: C.surface0 }}>
          {[
            { key: 'month' as const, label: '月' },
            { key: 'three' as const, label: '3日' },
            { key: 'list' as const, label: '予定' },
          ].map((v) => {
            const isActive = view === v.key;
            return (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className="flex-1 py-1.5 text-xs font-medium rounded-lg transition-all duration-200"
                style={{
                  background: isActive ? C.mauve : 'transparent',
                  color: isActive ? C.base : C.subtext1,
                }}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1">
        {view === 'month' && (
          <MonthView eventsByDate={eventsByDate} onDayTap={handleDayTap} />
        )}
        {view === 'three' && <ThreeDayView />}
        {view === 'list' && <ListView groups={groups} onToggleStatus={onToggleStatus} />}
      </div>

      {/* DayDetailSheet: 月ビューの日付タップで起動 */}
      <DayDetailSheet
        selectedDay={selectedDay}
        events={
          selectedDay ? eventsByDate[dayKey(selectedDay.month, selectedDay.date)] ?? [] : []
        }
        onClose={closeSheet}
        onToggleStatus={onToggleDayEventStatus}
        onAddEvent={handleSheetAdd}
        onOpenThreeView={handleSheetOpenThree}
      />
    </div>
  );
}

// ============================================================================
// Month View
// ============================================================================
//
// ⚠️ 不変要件 [MV-1]: Calendar Cell Invariant
//
//   全 42 セルは内部イベント件数 (0〜N) に関わらず、
//   幅:高さ = 1:1.5 の完全同一サイズでなければならない。
//
// ──────────── 実装パターン (必ず守ること) ────────────
//
//   <div className="relative"                           ← 寸法決定レイヤー
//        style={{ paddingBottom: '150%' }}>
//     <div className="absolute inset-0 ...              ← 中身レイヤー
//                     overflow-hidden flex flex-col">
//       {/* 日付バッジ + イベントチップ */}
//     </div>
//   </div>
//
// ──────────── なぜ padding-bottom: 150% か (aspect-ratio ではなく) ────────────
//
//   CSS の `aspect-ratio` プロパティは「希望比率」であり、
//   Grid セル内で子コンテンツが無い場合 (absolute で外に出した場合) に
//   セルの高さがゼロに潰れる挙動が観測された。
//
//   一方、`padding-bottom: <percentage>` は CSS 仕様で
//   「**親要素の幅**」を基準に解決されるため、
//   Grid セル内でも確実に動作する。
//
//   - セル幅 = Grid によって 1fr で割り振られた値
//   - セル高さ = padding-bottom: 150% = セル幅 × 1.5
//   - → 全セルが完全同一サイズ
//
//   このパターンは 20 年以上使われているレスポンシブ aspect ratio の
//   定石であり、ブラウザ互換性も完璧。
//
// ──────────── 2 層構造が必要な理由 ────────────
//
//   外側 (padding-bottom) で寸法を決定し、内側 (absolute inset-0) で
//   コンテンツを描画する。コンテンツがセルを押し広げないため。
//
// ──────────── 禁止事項 ────────────
//
//   ✗ min-h-[Npx]               → コンテンツで伸びる
//   ✗ aspect-[N/M] への依存     → Grid セル内で潰れる可能性
//   ✗ h-auto, 高さ無指定        → コンテンツ依存で不安定
//
// ──────────── 表示件数ルール ────────────
//
//   - 表示上限: 3件 (VISIBLE 定数)
//   - 4件目以降: "+N" で集約表示
//   - "+N" 行が出てもセル寸法は変わらない
//
function MonthView({
  eventsByDate,
  onDayTap,
}: {
  eventsByDate: Record<string, DayEvent[]>;
  onDayTap: (day: SelectedDay) => void;
}) {
  const weekHeaders = ['日', '月', '火', '水', '木', '金', '土'];

  // 月初の曜日ずれを含めて 6週(42セル) を生成する想定のサンプル
  // 6/28(日) スタート → 8/8(土) まで
  const days: { date: number; current: boolean; month: number }[] = [
    { date: 28, current: false, month: 6 },
    { date: 29, current: false, month: 6 },
    { date: 30, current: false, month: 6 },
    ...Array.from({ length: 31 }, (_, i) => ({ date: i + 1, current: true, month: 7 })),
    ...Array.from({ length: 8 }, (_, i) => ({ date: i + 1, current: false, month: 8 })),
  ];

  const today = 19;
  const todayMonth = 7;
  const todayYear = 2026;

  return (
    <div className="px-3">
      {/* 曜日ヘッダー (日付セルと grid-cols-7 でピクセル一致) */}
      <div className="grid grid-cols-7 mb-1">
        {weekHeaders.map((d, i) => {
          let color = C.subtext0;
          if (i === 0) color = C.red;
          if (i === 6) color = C.blue;
          return (
            <div
              key={d}
              className="text-center text-[11px] py-1.5 font-medium"
              style={{ color }}
            >
              {d}
            </div>
          );
        })}
      </div>

      {/* 日付セル: grid-cols-7 で等幅、padding-bottom: 150% で全セル同サイズ確定 */}
      <div className="grid grid-cols-7 gap-px" style={{ background: C.surface0 }}>
        {days.map((d, i) => {
          const dayIdx = i % 7;
          const key = dayKey(d.month, d.date);
          const dayEvents = eventsByDate[key] || [];
          const isToday = d.current && d.date === today && d.month === todayMonth;

          let dateColor = C.text;
          if (!d.current) dateColor = C.overlay0;
          else if (dayIdx === 0) dateColor = C.red;
          else if (dayIdx === 6) dateColor = C.blue;

          const VISIBLE = 3;
          const visibleEvents = dayEvents.slice(0, VISIBLE);
          const hiddenCount = dayEvents.length - VISIBLE;

          // セル中身 (button/div で共通利用)
          const cellInner = (
            <div className="absolute inset-0 p-1 flex flex-col overflow-hidden text-left">
              {/* 日付バッジ */}
              <div
                className="text-[11px] flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0"
                style={{
                  color: isToday ? C.base : dateColor,
                  background: isToday ? C.mauve : 'transparent',
                  fontWeight: isToday ? 700 : 500,
                }}
              >
                {d.date}
              </div>

              {/* イベントチップ */}
              <div className="mt-0.5 flex-1 flex flex-col gap-0.5 min-h-0">
                {visibleEvents.map((ev, ei) => (
                  <div
                    key={ei}
                    className="text-[9px] px-1 py-0.5 rounded leading-tight truncate flex-shrink-0"
                    style={{
                      background:
                        ev.type === 'birthday'
                          ? C.peach
                          : ev.type === 'holiday'
                          ? C.pink
                          : C.surface1,
                      color: ev.type === 'event' ? C.subtext1 : C.crust,
                      fontWeight: ev.type !== 'event' ? 600 : 500,
                    }}
                  >
                    {ev.title}
                  </div>
                ))}
                {hiddenCount > 0 && (
                  <div
                    className="text-[9px] leading-tight font-medium flex-shrink-0 pl-1"
                    style={{ color: C.overlay0 }}
                  >
                    +{hiddenCount}
                  </div>
                )}
              </div>
            </div>
          );

          // [SHEET-1] 月外日付はタップ無効。当月のみ button にしてタップ可能化
          // [MV-1] 寸法は外側 (padding-bottom: 150%) で確実に固定。中身は absolute inset-0 で従属
          if (d.current) {
            return (
              <button
                key={i}
                onClick={() =>
                  onDayTap({ year: todayYear, month: d.month, date: d.date })
                }
                className="relative block w-full transition-colors duration-150 active:brightness-125"
                style={{ background: C.base, paddingBottom: '150%' }}
                aria-label={`${d.month}月${d.date}日 (予定 ${dayEvents.length} 件)`}
              >
                {cellInner}
              </button>
            );
          }

          return (
            <div
              key={i}
              className="relative"
              style={{ background: C.base, paddingBottom: '150%' }}
            >
              {cellInner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Three Day View ----
function ThreeDayView() {
  const HOUR_HEIGHT = 56;
  const START_HOUR = 7;
  const END_HOUR = 23;
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  const cols = [
    {
      dayLabel: '月',
      date: 18,
      isToday: false,
      events: [{ start: 9, end: 10, title: '読書', color: C.sky }],
    },
    {
      dayLabel: '火',
      date: 19,
      isToday: true,
      events: [
        { start: 10, end: 11, title: 'チームMTG', color: C.mauve },
        { start: 14, end: 16, title: 'コーディング', color: C.green },
      ],
    },
    {
      dayLabel: '水',
      date: 20,
      isToday: false,
      events: [{ start: 19, end: 21, title: '夕食会', color: C.peach }],
    },
  ];

  const NOW_HOUR = 14;
  const NOW_MIN = 30;
  const todayColIdx = cols.findIndex((c) => c.isToday);
  const nowOffset = (NOW_HOUR - START_HOUR) * HOUR_HEIGHT + (NOW_MIN / 60) * HOUR_HEIGHT;
  const colCount = cols.length;

  return (
    <div className="pb-4">
      <div
        className="grid sticky top-0 z-10 pb-2"
        style={{
          gridTemplateColumns: `40px repeat(${colCount}, 1fr)`,
          background: C.base,
        }}
      >
        <div />
        {cols.map((c, i) => (
          <div key={i} className="flex flex-col items-center pt-1 gap-0.5">
            <span
              className="text-[10px] font-medium"
              style={{ color: c.isToday ? C.blue : C.subtext0 }}
            >
              {c.dayLabel}
            </span>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-base"
              style={{
                background: c.isToday ? C.blue : 'transparent',
                color: c.isToday ? C.base : C.text,
                fontWeight: c.isToday ? 600 : 300,
              }}
            >
              {c.date}
            </div>
          </div>
        ))}
      </div>

      <div
        className="relative grid"
        style={{ gridTemplateColumns: `40px repeat(${colCount}, 1fr)` }}
      >
        <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
          {hours.map((h, i) => (
            <div
              key={h}
              className="text-[10px] text-right pr-1.5 absolute right-0"
              style={{ color: C.overlay0, top: i * HOUR_HEIGHT - 6, width: 40 }}
            >
              {h}:00
            </div>
          ))}
        </div>

        {cols.map((c, ci) => (
          <div
            key={ci}
            className="relative border-l"
            style={{
              borderColor: C.surface0,
              height: hours.length * HOUR_HEIGHT,
            }}
          >
            {hours.map((h, hi) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t"
                style={{ borderColor: C.surface0, top: hi * HOUR_HEIGHT }}
              />
            ))}

            {c.events.map((ev, ei) => (
              <div
                key={ei}
                className="absolute left-1 right-1 rounded-md px-2 py-1 overflow-hidden cursor-pointer"
                style={{
                  top: (ev.start - START_HOUR) * HOUR_HEIGHT + 1,
                  height: (ev.end - ev.start) * HOUR_HEIGHT - 2,
                  background: `${ev.color}26`,
                  borderLeft: `3px solid ${ev.color}`,
                }}
              >
                <div
                  className="text-[11px] font-medium leading-tight"
                  style={{ color: C.text }}
                >
                  {ev.title}
                </div>
                <div className="text-[9px] mt-0.5" style={{ color: C.subtext0 }}>
                  {String(ev.start).padStart(2, '0')}:00 -{' '}
                  {String(ev.end).padStart(2, '0')}:00
                </div>
              </div>
            ))}

            {ci === todayColIdx && (
              <div
                className="absolute left-0 right-0 pointer-events-none z-10"
                style={{ top: nowOffset }}
              >
                <div
                  className="absolute w-2.5 h-2.5 rounded-full"
                  style={{ background: C.red, top: -5, left: -5 }}
                />
                <div className="h-px" style={{ background: C.red }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- List View ----
function ListView({
  groups,
  onToggleStatus,
}: {
  groups: Group[];
  onToggleStatus: (groupIdx: number, itemId: string) => void;
}) {
  return (
    <div className="px-4 pb-4 space-y-5">
      {groups.map((g, gi) => (
        <div key={g.label}>
          <div
            className="text-[11px] uppercase tracking-widest font-semibold mb-2"
            style={{ color: C.overlay0 }}
          >
            {g.label}
          </div>
          {g.items.length === 0 ? (
            <div className="text-xs px-3 py-2" style={{ color: C.overlay0 }}>
              項目なし
            </div>
          ) : (
            <div className="space-y-1.5">
              {g.items.map((it) => (
                <ListItemRow
                  key={it.id}
                  item={it}
                  onToggle={() => onToggleStatus(gi, it.id)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// React.memo で個別の行を独立してメモ化
const ListItemRow = React.memo(function ListItemRow({
  item,
  onToggle,
}: {
  item: ListItem;
  onToggle: () => void;
}) {
  const isDone = item.status === 'done';
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: C.surface0 }}
    >
      <StatusCheckbox status={item.status} onClick={onToggle} />
      <div className="flex-1 min-w-0">
        <div
          className="text-sm font-medium truncate"
          style={{
            color: isDone ? C.overlay0 : C.text,
            textDecoration: isDone ? 'line-through' : 'none',
          }}
        >
          {item.title}
        </div>
        {item.time && (
          <div className="text-[11px] mt-0.5" style={{ color: C.subtext0 }}>
            {item.time}
          </div>
        )}
      </div>
      <div
        className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
        style={{
          background: `${TAG_COLORS[item.tag]}33`,
          color: TAG_COLORS[item.tag],
        }}
      >
        {item.tag}
      </div>
    </div>
  );
});

// ---- Status Checkbox (3 ステータス) ----
// 未着手: 空(透明) / 着手中: Yellow 塗りつぶし / 完了: Green + Check
function StatusCheckbox({
  status,
  onClick,
}: {
  status: TaskStatus;
  onClick: () => void;
}) {
  let borderColor = C.overlay0;
  let background: string = 'transparent';
  let content: React.ReactNode = null;

  if (status === 'doing') {
    borderColor = C.yellow;
    background = C.yellow;
  } else if (status === 'done') {
    borderColor = C.green;
    background = C.green;
    content = <Check size={12} strokeWidth={3} style={{ color: C.base }} />;
  }

  return (
    <button
      onClick={onClick}
      className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200"
      style={{ borderColor, background }}
      aria-label={`ステータス: ${status} (タップで切替)`}
    >
      {content}
    </button>
  );
}

// =============================================
// DayDetailSheet (ボトムシート)
// =============================================
//
// [SHEET-1]: 月ビューの日付タップで起動する 50% 高さのボトムシート。
//   - transform: translateY(100%↔0) でアニメーション
//   - selectedDay が null → 閉じる, それ以外 → 開く
//   - 「他日タップ時はコンテンツ切替・シートは開いたまま」を実現するため、
//     親側で selectedDay を更新するだけで切り替わる設計。
//
// Z-index 構成 (上から):
//   - AddEventModal (z-50)
//   - Sidebar (z-50)
//   - DayDetailSheet (z-30) ← Backdrop と Sheet で構成
//   - BottomTabBar (z-30)
//   - FAB (z-40)
//
const monthDateLabel = (m: number, d: number): string => {
  const weekday = ['日', '月', '火', '水', '木', '金', '土'];
  // Date コンストラクタの月は 0-indexed なので m - 1
  // 年は当面 2026 固定 (Phase 6 の月ナビゲーション実装時に動的化予定)
  const date = new Date(2026, m - 1, d);
  return `${m}月${d}日 (${weekday[date.getDay()]})`;
};

function DayDetailSheet({
  selectedDay,
  events,
  onClose,
  onToggleStatus,
  onAddEvent,
  onOpenThreeView,
}: {
  selectedDay: SelectedDay | null;
  events: DayEvent[];
  onClose: () => void;
  onToggleStatus: (dateKey: string, eventId: string) => void;
  onAddEvent: () => void;
  onOpenThreeView: () => void;
}) {
  const open = selectedDay !== null;
  const key = selectedDay ? dayKey(selectedDay.month, selectedDay.date) : '';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 z-30 transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.5)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />

      {/* Sheet (50% 固定高さ) */}
      <div
        className="absolute left-0 right-0 bottom-0 z-30 rounded-t-2xl flex flex-col transition-transform duration-300"
        style={{
          background: C.mantle,
          height: '50%',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
        }}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        {/* ハンドル + ヘッダー */}
        <div
          className="flex-shrink-0 border-b"
          style={{ borderColor: C.surface0 }}
        >
          {/* グラブハンドル (装飾) */}
          <div className="flex justify-center pt-2 pb-1">
            <div
              className="w-9 h-1 rounded-full"
              style={{ background: C.surface2 }}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-2">
            <div>
              <div className="text-sm font-semibold" style={{ color: C.text }}>
                {selectedDay
                  ? monthDateLabel(selectedDay.month, selectedDay.date)
                  : ''}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: C.subtext0 }}>
                {events.length === 0 ? '予定なし' : `${events.length}件の予定`}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg"
              style={{ color: C.subtext1 }}
              aria-label="閉じる"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* イベントリスト (スクロール領域) */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {events.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-6">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: C.surface0 }}
              >
                <Calendar size={22} style={{ color: C.overlay0 }} />
              </div>
              <div className="text-sm" style={{ color: C.subtext0 }}>
                この日の予定はまだありません
              </div>
              <div className="text-[11px]" style={{ color: C.overlay0 }}>
                下の「+ 予定を追加」から登録できます
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {events.map((ev) => (
                <DayEventRow
                  key={ev.id}
                  event={ev}
                  onToggle={() => onToggleStatus(key, ev.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* アクション (下部固定) */}
        <div
          className="flex-shrink-0 px-4 py-3 border-t flex gap-2"
          style={{ borderColor: C.surface0 }}
        >
          <button
            onClick={onAddEvent}
            className="flex-1 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all duration-200 active:scale-95"
            style={{ background: C.mauve, color: C.base }}
          >
            <Plus size={14} strokeWidth={2.5} />
            予定を追加
          </button>
          <button
            onClick={onOpenThreeView}
            className="flex-1 py-2.5 rounded-lg text-xs font-medium border transition-colors active:brightness-125"
            style={{ borderColor: C.surface1, color: C.subtext1 }}
          >
            3日ビューで開く
          </button>
        </div>
      </div>
    </>
  );
}

// 個別の予定行 (React.memo で個別メモ化)
const DayEventRow = React.memo(function DayEventRow({
  event,
  onToggle,
}: {
  event: DayEvent;
  onToggle: () => void;
}) {
  const isDone = event.status === 'done';
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: C.surface0 }}
    >
      <StatusCheckbox status={event.status} onClick={onToggle} />
      <div className="flex-1 min-w-0">
        <div
          className="text-sm font-medium truncate"
          style={{
            color: isDone ? C.overlay0 : C.text,
            textDecoration: isDone ? 'line-through' : 'none',
          }}
        >
          {event.title}
        </div>
        {event.time && (
          <div className="text-[11px] mt-0.5" style={{ color: C.subtext0 }}>
            {event.time}
          </div>
        )}
      </div>
      <div
        className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
        style={{
          background: `${TAG_COLORS[event.tag]}33`,
          color: TAG_COLORS[event.tag],
        }}
      >
        {event.tag}
      </div>
    </div>
  );
});

// =============================================
// Add Event Modal (フルスクリーン)
// =============================================
function AddEventModal({
  open,
  onClose,
  onSave,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (input: {
    title: string;
    date: string;
    time: string | null;
    tag: TagKey;
    memo: string;
  }) => void;
  // [SHEET-1] ボトムシート経由で開く場合に選択日が入る
  defaultDate?: string | null;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('2026-07-19');
  const [time, setTime] = useState('10:00');
  const [allDay, setAllDay] = useState(true);
  const [tag, setTag] = useState<TagKey>('dev');
  const [memo, setMemo] = useState('');

  // モーダルが開いたタイミングでフォームを初期化
  // defaultDate が指定されていれば日付に反映 (ボトムシート経由のケース)
  useEffect(() => {
    if (open) {
      setTitle('');
      setDate(defaultDate ?? '2026-07-19');
      setTime('10:00');
      setAllDay(true);
      setTag('dev');
      setMemo('');
    }
  }, [open, defaultDate]);

  if (!open) return null;

  const canSave = title.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      title: title.trim(),
      date,
      time: allDay ? null : time,
      tag,
      memo: memo.trim(),
    });
    onClose();
  };

  const tagOptions: TagKey[] = ['dev', 'work', 'biz', 'holiday'];

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col"
      style={{ background: C.base }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex items-center justify-between px-3 py-3 border-b flex-shrink-0"
        style={{ borderColor: C.surface0 }}
      >
        <button
          onClick={onClose}
          className="p-2 rounded-lg transition-colors"
          style={{ color: C.subtext1 }}
          aria-label="閉じる"
        >
          <X size={22} />
        </button>
        <div className="text-sm font-semibold" style={{ color: C.text }}>
          新規予定
        </div>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
          style={{
            background: canSave ? C.mauve : C.surface1,
            color: canSave ? C.base : C.overlay0,
            opacity: canSave ? 1 : 0.5,
          }}
        >
          保存
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タイトル"
          className="w-full bg-transparent text-lg font-medium outline-none pb-2 border-b"
          style={{ color: C.text, borderColor: C.surface1 }}
          autoFocus
        />

        <div className="flex items-center justify-between py-1">
          <div className="text-sm" style={{ color: C.text }}>
            終日
          </div>
          <button
            onClick={() => setAllDay((v) => !v)}
            className="w-11 h-6 rounded-full relative transition-colors duration-200"
            style={{ background: allDay ? C.mauve : C.surface1 }}
            aria-label={`終日: ${allDay ? 'ON' : 'OFF'}`}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200"
              style={{
                left: allDay ? '22px' : '2px',
                background: C.base,
              }}
            />
          </button>
        </div>

        <div
          className="flex items-center justify-between py-2 border-b"
          style={{ borderColor: C.surface0 }}
        >
          <div className="text-sm" style={{ color: C.text }}>
            日付
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-sm outline-none cursor-pointer"
            style={{ color: C.subtext1, colorScheme: 'dark' }}
          />
        </div>

        {!allDay && (
          <div
            className="flex items-center justify-between py-2 border-b"
            style={{ borderColor: C.surface0 }}
          >
            <div className="text-sm" style={{ color: C.text }}>
              時刻
            </div>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="bg-transparent text-sm outline-none cursor-pointer"
              style={{ color: C.subtext1, colorScheme: 'dark' }}
            />
          </div>
        )}

        <div>
          <div className="text-sm mb-2.5" style={{ color: C.text }}>
            タグ
          </div>
          <div className="flex flex-wrap gap-2">
            {tagOptions.map((t) => {
              const isActive = tag === t;
              const color = TAG_COLORS[t];
              return (
                <button
                  key={t}
                  onClick={() => setTag(t)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                  style={{
                    background: isActive ? `${color}33` : 'transparent',
                    color: isActive ? color : C.subtext0,
                    border: `1px solid ${isActive ? color : C.surface1}`,
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-sm mb-2.5" style={{ color: C.text }}>
            メモ
          </div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="メモを入力..."
            rows={5}
            className="w-full p-3 rounded-lg text-sm outline-none resize-none"
            style={{ background: C.surface0, color: C.text }}
          />
        </div>
      </div>
    </div>
  );
}

// =============================================
// Schedule Sidebar
// =============================================
//
// [SIDEBAR-1]: 最上部にアイコン行を配置し、検索/フィルタを排他展開する。
// activePanel が単一の state なので、自然と排他制御になる。
//
type SidebarPanel = 'search' | 'filter' | null;

// フィルタ状態 (UI のみで実フィルタはしない)
type CalendarFlags = {
  personal: boolean;
  work: boolean;
  holiday: boolean;
  birthday: boolean;
};

const ALL_TAGS: TagKey[] = ['dev', 'work', 'biz', 'holiday'];
const ALL_STATUSES: TaskStatus[] = ['todo', 'doing', 'done'];
const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '未着手',
  doing: '着手中',
  done: '完了',
};

function ScheduleSidebar() {
  const [activePanel, setActivePanel] = useState<SidebarPanel>(null);

  // 検索クエリ (機能なし、入力UIのみ)
  const [searchQuery, setSearchQuery] = useState('');

  // フィルタ選択状態 (機能なし、選択UIのみ)
  const [selectedTags, setSelectedTags] = useState<TagKey[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([]);
  const [calendars, setCalendars] = useState<CalendarFlags>({
    personal: true,
    work: true,
    holiday: true,
    birthday: false,
  });

  // パネルを排他トグル: 同じアイコンを再タップで閉じる、別アイコンタップで切り替え
  const togglePanel = (panel: 'search' | 'filter') => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const toggleTag = (t: TagKey) => {
    setSelectedTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const toggleStatus = (s: TaskStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const toggleCalendar = (k: keyof CalendarFlags) => {
    setCalendars((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  // フィルタの選択数 (バッジ表示用)
  const filterCount =
    selectedTags.length +
    selectedStatuses.length +
    Object.values(calendars).filter((v) => !v).length; // OFF になっているカレンダー数を「絞り込み中」とカウント

  const clearAllFilters = () => {
    setSelectedTags([]);
    setSelectedStatuses([]);
    setCalendars({ personal: true, work: true, holiday: true, birthday: false });
  };

  return (
    <div className="p-4 space-y-5">
      {/* [SIDEBAR-1] 最上部アイコン行: 検索 / フィルタ */}
      <section>
        <div className="flex gap-2">
          <SidebarIconButton
            icon={<Search size={18} />}
            label="検索"
            active={activePanel === 'search'}
            onClick={() => togglePanel('search')}
          />
          <SidebarIconButton
            icon={<SlidersHorizontal size={18} />}
            label="フィルタ"
            active={activePanel === 'filter'}
            badge={filterCount > 0 ? filterCount : undefined}
            onClick={() => togglePanel('filter')}
          />
        </div>

        {/* 排他展開: 検索パネル */}
        {activePanel === 'search' && (
          <div className="mt-3">
            <SearchPanel
              query={searchQuery}
              onChange={setSearchQuery}
              onClear={() => setSearchQuery('')}
            />
          </div>
        )}

        {/* 排他展開: フィルタパネル */}
        {activePanel === 'filter' && (
          <div className="mt-3">
            <FilterPanel
              selectedTags={selectedTags}
              onToggleTag={toggleTag}
              selectedStatuses={selectedStatuses}
              onToggleStatus={toggleStatus}
              calendars={calendars}
              onToggleCalendar={toggleCalendar}
              onClear={clearAllFilters}
              showClear={filterCount > 0}
            />
          </div>
        )}
      </section>

      {/* ミニカレンダー (既存) */}
      <section>
        <ScheduleMiniCalendar />
      </section>

      {/* 今日のサマリー (既存) */}
      <section>
        <div className="text-xs uppercase tracking-widest mb-2" style={{ color: C.overlay0 }}>
          今日のサマリー
        </div>
        <div className="p-3 rounded-lg space-y-1.5" style={{ background: C.surface0 }}>
          <div className="flex justify-between text-xs">
            <span style={{ color: C.subtext1 }}>予定</span>
            <span style={{ color: C.text, fontWeight: 600 }}>3件</span>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color: C.subtext1 }}>タスク</span>
            <span style={{ color: C.text, fontWeight: 600 }}>2件</span>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color: C.subtext1 }}>完了</span>
            <span style={{ color: C.green, fontWeight: 600 }}>1件</span>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---- Sidebar の検索/フィルタ用アイコンボタン ----
function SidebarIconButton({
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all duration-200 relative"
      style={{
        background: active ? `${C.mauve}26` : C.surface0,
        color: active ? C.mauve : C.subtext1,
        border: `1px solid ${active ? C.mauve : 'transparent'}`,
      }}
      aria-label={label}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
      {badge !== undefined && (
        <span
          className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
          style={{ background: C.mauve, color: C.base }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ---- 検索パネル (UI のみ・機能なし) ----
function SearchPanel({
  query,
  onChange,
  onClear,
}: {
  query: string;
  onChange: (q: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{ background: C.surface0 }}
      >
        <Search size={14} style={{ color: C.overlay0 }} />
        <input
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="タイトルや内容で検索..."
          className="flex-1 bg-transparent outline-none text-sm min-w-0"
          style={{ color: C.text }}
          autoFocus
        />
        {query && (
          <button
            onClick={onClear}
            className="flex-shrink-0"
            style={{ color: C.overlay0 }}
            aria-label="検索クエリをクリア"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {/* 実機能はないが、入力中のヒント表示でフィードバックを返す */}
      <div className="text-[10px] px-1" style={{ color: C.overlay0 }}>
        {query
          ? `「${query}」で検索中… (デモのため結果は表示されません)`
          : 'タイトル・メモ・タグから絞り込めます'}
      </div>
    </div>
  );
}

// ---- フィルタパネル (UI のみ・機能なし) ----
function FilterPanel({
  selectedTags,
  onToggleTag,
  selectedStatuses,
  onToggleStatus,
  calendars,
  onToggleCalendar,
  onClear,
  showClear,
}: {
  selectedTags: TagKey[];
  onToggleTag: (t: TagKey) => void;
  selectedStatuses: TaskStatus[];
  onToggleStatus: (s: TaskStatus) => void;
  calendars: CalendarFlags;
  onToggleCalendar: (k: keyof CalendarFlags) => void;
  onClear: () => void;
  showClear: boolean;
}) {
  return (
    <div
      className="p-3 rounded-lg space-y-4"
      style={{ background: C.surface0 }}
    >
      {/* タグ */}
      <FilterSection title="タグ">
        <div className="flex flex-wrap gap-1.5">
          {ALL_TAGS.map((t) => {
            const isOn = selectedTags.includes(t);
            const color = TAG_COLORS[t];
            return (
              <button
                key={t}
                onClick={() => onToggleTag(t)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-150"
                style={{
                  background: isOn ? `${color}33` : 'transparent',
                  color: isOn ? color : C.subtext0,
                  border: `1px solid ${isOn ? color : C.surface1}`,
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* ステータス */}
      <FilterSection title="ステータス">
        <div className="flex flex-wrap gap-1.5">
          {ALL_STATUSES.map((s) => {
            const isOn = selectedStatuses.includes(s);
            // ステータスごとに視認しやすい色を当てる
            const color =
              s === 'todo' ? C.overlay0 : s === 'doing' ? C.yellow : C.green;
            return (
              <button
                key={s}
                onClick={() => onToggleStatus(s)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-150"
                style={{
                  background: isOn ? `${color}33` : 'transparent',
                  color: isOn ? color : C.subtext0,
                  border: `1px solid ${isOn ? color : C.surface1}`,
                }}
              >
                {STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* カレンダー種別 (既存セクションをここに統合) */}
      <FilterSection title="カレンダー">
        <div className="space-y-1.5">
          {(
            [
              { key: 'personal' as const, label: '個人', color: C.mauve },
              { key: 'work' as const, label: '仕事', color: C.sky },
              { key: 'holiday' as const, label: '祝日', color: C.pink },
              { key: 'birthday' as const, label: '誕生日', color: C.peach },
            ] as const
          ).map((c) => {
            const on = calendars[c.key];
            return (
              <button
                key={c.key}
                onClick={() => onToggleCalendar(c.key)}
                className="w-full flex items-center gap-2.5 py-1 text-left"
              >
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{
                    background: on ? c.color : 'transparent',
                    border: `1px solid ${c.color}`,
                  }}
                />
                <span className="text-sm" style={{ color: on ? C.text : C.subtext0 }}>
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* クリアボタン (絞り込みが何かしらあるときだけ表示) */}
      {showClear && (
        <button
          onClick={onClear}
          className="w-full py-1.5 rounded-md text-[11px] font-medium transition-colors"
          style={{ background: C.surface1, color: C.subtext1 }}
        >
          フィルタをクリア
        </button>
      )}
    </div>
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
    <div>
      <div
        className="text-[10px] uppercase tracking-widest font-semibold mb-2"
        style={{ color: C.overlay0 }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

// ---- ミニカレンダー (既存ロジックを関数分離) ----
function ScheduleMiniCalendar() {
  const weekHeaders = ['日', '月', '火', '水', '木', '金', '土'];
  const miniDays = [
    ...Array.from({ length: 3 }, (_, i) => ({ date: 28 + i, current: false })),
    ...Array.from({ length: 28 }, (_, i) => ({ date: i + 1, current: true })),
  ];
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-widest" style={{ color: C.overlay0 }}>
          ミニカレンダー
        </div>
        <div className="flex items-center gap-1">
          <button style={{ color: C.subtext0 }}>
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs" style={{ color: C.text }}>
            7月
          </span>
          <button style={{ color: C.subtext0 }}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekHeaders.map((d, i) => (
          <div
            key={d}
            className="text-[9px]"
            style={{ color: i === 0 ? C.red : i === 6 ? C.blue : C.overlay0 }}
          >
            {d}
          </div>
        ))}
        {miniDays.slice(0, 28).map((d, i) => {
          const isToday = d.current && d.date === 19;
          return (
            <div
              key={i}
              className="text-[10px] aspect-square flex items-center justify-center rounded"
              style={{
                color: !d.current ? C.overlay0 : isToday ? C.base : C.text,
                background: isToday ? C.mauve : 'transparent',
                fontWeight: isToday ? 700 : 400,
              }}
            >
              {d.date}
            </div>
          );
        })}
      </div>
    </>
  );
}
