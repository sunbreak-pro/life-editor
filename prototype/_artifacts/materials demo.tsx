import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  FileText,
  BookOpen,
  LayoutGrid,
  List as ListIcon,
  Search,
  ArrowUpDown,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  X,
  Check,
  Pin,
  Copy,
  Trash2,
  Bold,
  Italic,
  Heading1,
  Quote,
  Code,
  Link2,
  Hash,
  Folder,
  Calendar,
  Clock,
  Settings as SettingsIcon,
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

// =============================================
// Types
// =============================================
type MaterialKind = 'notes' | 'daily';
type Layout = 'card' | 'list';
type SortKey = 'updated' | 'created' | 'title';
type Mood = 'green' | 'sky' | 'yellow' | 'peach' | 'red';
type SheetType = 'sort' | 'item-menu' | 'editor-menu' | 'filter' | 'mood' | 'tag';
type SaveStatus = 'saved' | 'editing' | 'saving';
type ViewMode = 'list' | 'editor';

type Tag = { id: string; name: string; color: string; count: number };
type Notebook = { id: string; name: string; count: number };
type Note = {
  id: string;
  kind: MaterialKind;
  title: string;
  excerpt: string;
  body: string;
  notebookId: string;
  tagIds: string[];
  updatedAt: number;
  createdAt: number;
  pinned: boolean;
  date?: string;
  weekday?: string;
  mood?: Mood;
  sessions?: number;
};

// =============================================
// Mock data
// =============================================
const TAGS: Tag[] = [
  { id: 't1', name: 'dev', color: C.mauve, count: 12 },
  { id: 't2', name: 'arch', color: C.sky, count: 5 },
  { id: 't3', name: 'retro', color: C.peach, count: 4 },
  { id: 't4', name: 'book', color: C.green, count: 6 },
  { id: 't5', name: 'sync', color: C.yellow, count: 3 },
  { id: 't6', name: 'idea', color: C.pink, count: 7 },
];

const NOTEBOOKS: Notebook[] = [
  { id: 'all', name: 'すべて', count: 16 },
  { id: 'proj', name: 'プロジェクト', count: 6 },
  { id: 'journal', name: '日記', count: 8 },
  { id: 'book', name: '読書ログ', count: 2 },
];

// 相対時刻を作るためのヘルパ。NOW を基準に過去 N 時間前
const NOW = Date.now();
const H = (h: number) => NOW - h * 3600_000;

const INITIAL_NOTES: Note[] = [
  // ---- Notes (8) ----
  {
    id: 'n1',
    kind: 'notes',
    title: 'life-editor 設計メモ',
    excerpt: 'Tauri + Rust + React 19 構成。MCP Server は別プロセスで稼働...',
    body: 'Tauri 2.0 と Rust のバックエンド、React 19 + Vite のフロントエンドで構成。\n\nDataService 抽象化済み。MCP Server は別プロセスの Node.js + better-sqlite3。',
    notebookId: 'proj',
    tagIds: ['t1', 't2'],
    updatedAt: H(2),
    createdAt: H(72),
    pinned: true,
  },
  {
    id: 'n2',
    kind: 'notes',
    title: 'Phase B 振り返り',
    excerpt: '26機能を実装完了。次フェーズはターミナル廃止と Remote MCP...',
    body: 'Tier 1: 8機能、Tier 2: 12機能、Tier 3: 6機能、計26機能を定義済み。\n\nDBマイグレーションは V69 まで進んでおり約 40 テーブル。',
    notebookId: 'proj',
    tagIds: ['t3'],
    updatedAt: H(24),
    createdAt: H(168),
    pinned: true,
  },
  {
    id: 'n3',
    kind: 'notes',
    title: '読書ログ: SRE 本',
    excerpt: 'エラーバジェットの章。SLO の設定方法と組織への浸透...',
    body: 'SLO の設定は技術ではなく組織の問題。\n\nエラーバジェットを使い切ったら新機能リリースを止める、というルールが鍵。',
    notebookId: 'book',
    tagIds: ['t4'],
    updatedAt: H(72),
    createdAt: H(240),
    pinned: false,
  },
  {
    id: 'n4',
    kind: 'notes',
    title: '同期戦略の検討',
    excerpt: 'Last-write-wins + バージョンカラム。CRDT は将来検討...',
    body: 'D1 の書き込み制限を踏まえ、last-write-wins で十分。\n\nCRDT は複雑度が高すぎる。',
    notebookId: 'proj',
    tagIds: ['t1', 't5'],
    updatedAt: H(168),
    createdAt: H(336),
    pinned: false,
  },
  {
    id: 'n5',
    kind: 'notes',
    title: 'CI/CD 計画',
    excerpt: 'GitHub Actions + Claude Code Action でビルドエラー自動解析...',
    body: '失敗時のみトリガーで API コスト削減。Sonnet ティアモデルを使う。',
    notebookId: 'proj',
    tagIds: ['t1'],
    updatedAt: H(96),
    createdAt: H(192),
    pinned: false,
  },
  {
    id: 'n6',
    kind: 'notes',
    title: 'タグシステム設計',
    excerpt: 'fsnotify で `#hashtag` 抽出、日本語 Unicode 対応...',
    body: 'フォルダ階層とは独立してタグでアクセス。\n\nアイデアを横断する第二の整理軸。',
    notebookId: 'proj',
    tagIds: ['t2', 't6'],
    updatedAt: H(120),
    createdAt: H(216),
    pinned: false,
  },
  {
    id: 'n7',
    kind: 'notes',
    title: 'アイデア: フローティング検索',
    excerpt: '⌘K で全体検索、結果をその場で開く Spotlight 風...',
    body: 'Spotlight 風の体験。命令パレット兼任。',
    notebookId: 'proj',
    tagIds: ['t6'],
    updatedAt: H(48),
    createdAt: H(264),
    pinned: false,
  },
  {
    id: 'n8',
    kind: 'notes',
    title: '読書ログ: アジャイル開発',
    excerpt: 'スクラムとカンバンの違い。チーム規模との適合性...',
    body: 'チームサイズ次第で手法を選ぶ。一人開発ならカンバン。',
    notebookId: 'book',
    tagIds: ['t4', 't6'],
    updatedAt: H(192),
    createdAt: H(360),
    pinned: false,
  },

  // ---- Daily (8) ----
  {
    id: 'd1',
    kind: 'daily',
    title: '今日の集中',
    excerpt: '統合版デモのフィードバックを反映。3日ビューを大幅改修...',
    body: '## 今日の振り返り\n\n統合版デモを進めた。フィードバックを反映して3日ビューを改修。\n\n## 学び・気づき\n\n細部の作り込みで完成度が大きく変わる。\n\n## 明日の予定\n\nMaterials の詳細実装。',
    notebookId: 'journal',
    tagIds: ['t1'],
    updatedAt: H(1),
    createdAt: H(8),
    pinned: true,
    date: '2026-07-19',
    weekday: '火',
    mood: 'green',
    sessions: 4,
  },
  {
    id: 'd2',
    kind: 'daily',
    title: 'デモ初版完了',
    excerpt: '4画面分の骨組みができた。Catppuccin の色合いが意外と...',
    body: '## 今日の振り返り\n\n4画面の骨組みができた。\n\n## 学び・気づき\n\nCatppuccin の色合いが心地よい。\n\n## 明日の予定\n\nフィードバックを反映する。',
    notebookId: 'journal',
    tagIds: ['t1'],
    updatedAt: H(25),
    createdAt: H(30),
    pinned: false,
    date: '2026-07-18',
    weekday: '月',
    mood: 'green',
    sessions: 6,
  },
  {
    id: 'd3',
    kind: 'daily',
    title: '休息日',
    excerpt: '散歩と読書。来週の計画を軽く整理。',
    body: '## 今日の振り返り\n\n散歩と読書。気持ちをリセット。',
    notebookId: 'journal',
    tagIds: [],
    updatedAt: H(48),
    createdAt: H(52),
    pinned: false,
    date: '2026-07-17',
    weekday: '日',
    mood: 'sky',
    sessions: 1,
  },
  {
    id: 'd4',
    kind: 'daily',
    title: '同期周りの調査',
    excerpt: 'D1 の書き込み制限について。バージョンカラム方式で対応...',
    body: '## 今日の振り返り\n\nD1 の制限を調査。バージョンカラムで last-write-wins を実装する方針。',
    notebookId: 'journal',
    tagIds: ['t5'],
    updatedAt: H(72),
    createdAt: H(76),
    pinned: false,
    date: '2026-07-16',
    weekday: '土',
    mood: 'yellow',
    sessions: 3,
  },
  {
    id: 'd5',
    kind: 'daily',
    title: 'ターミナル廃止の決断',
    excerpt: 'xterm.js を捨てて Remote MCP に集約する方向...',
    body: '## 今日の振り返り\n\nアーキテクチャ転換を決定。シンプル化に向けて。',
    notebookId: 'journal',
    tagIds: ['t2'],
    updatedAt: H(96),
    createdAt: H(100),
    pinned: false,
    date: '2026-07-15',
    weekday: '金',
    mood: 'peach',
    sessions: 5,
  },
  {
    id: 'd6',
    kind: 'daily',
    title: 'バグデー',
    excerpt: '同期の競合エラーを2件修正。テストが甘かった...',
    body: '## 今日の振り返り\n\nバグ修正で1日。テストカバレッジを上げる必要あり。',
    notebookId: 'journal',
    tagIds: ['t1', 't5'],
    updatedAt: H(120),
    createdAt: H(124),
    pinned: false,
    date: '2026-07-14',
    weekday: '木',
    mood: 'red',
    sessions: 2,
  },
  {
    id: 'd7',
    kind: 'daily',
    title: 'プロトタイピング',
    excerpt: 'モバイル版 UI を Claude で生成しつつ調整...',
    body: '## 今日の振り返り\n\nプロトタイプを多数試作。AIとの協働は捗る。',
    notebookId: 'journal',
    tagIds: ['t1'],
    updatedAt: H(144),
    createdAt: H(148),
    pinned: false,
    date: '2026-07-13',
    weekday: '水',
    mood: 'green',
    sessions: 7,
  },
  {
    id: 'd8',
    kind: 'daily',
    title: '計画見直し',
    excerpt: 'Phase C の優先順位を決め直し。タスク管理を前倒し...',
    body: '## 今日の振り返り\n\nロードマップを再構成。',
    notebookId: 'journal',
    tagIds: ['t6'],
    updatedAt: H(168),
    createdAt: H(172),
    pinned: false,
    date: '2026-07-12',
    weekday: '火',
    mood: 'sky',
    sessions: 4,
  },
];

const MOOD_LABEL: Record<Mood, string> = {
  green: '充実',
  sky: '穏やか',
  yellow: '集中',
  peach: '楽しい',
  red: 'しんどい',
};

const MOOD_COLOR: Record<Mood, string> = {
  green: C.green,
  sky: C.sky,
  yellow: C.yellow,
  peach: C.peach,
  red: C.red,
};

// ノート本文の Daily テンプレ。新規 Daily 作成時の初期 body
const DAILY_TEMPLATE = '## 今日の振り返り\n\n\n## 学び・気づき\n\n\n## 明日の予定\n';

// =============================================
// Helpers
// =============================================
// 「相対時刻」を出すヘルパ。一覧で時間を端的に伝えるため
const timeAgo = (ts: number): string => {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'たった今';
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}日前`;
  return `${Math.floor(d / 7)}週間前`;
};

// =============================================
// Root component
// =============================================
export default function MaterialsDemo() {
  // 画面モード(一覧 or エディタ)
  const [view, setView] = useState<ViewMode>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  // データ本体
  const [notes, setNotes] = useState<Note[]>(INITIAL_NOTES);

  // 一覧の表示制御
  const [kind, setKind] = useState<MaterialKind>('notes');
  const [layout, setLayout] = useState<Layout>('card');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [filterNotebookId, setFilterNotebookId] = useState<string | null>(null);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

  // シート制御。activeSheet で排他、targetId は長押し対象の id を覚える
  const [activeSheet, setActiveSheet] = useState<SheetType | null>(null);
  const [sheetTargetId, setSheetTargetId] = useState<string | null>(null);

  const editing = notes.find((n) => n.id === editingId) || null;

  const openEditor = (id: string) => {
    setEditingId(id);
    setView('editor');
  };
  // editingId は keep しておきアニメ中に EditorView が消えないようにする
  const closeEditor = () => setView('list');

  // ---- CRUD ----
  const updateNote = (id: string, patch: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n))
    );
  };
  const togglePin = (id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
  };
  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (editingId === id) closeEditor();
  };
  const duplicateNote = (id: string) => {
    const src = notes.find((n) => n.id === id);
    if (!src) return;
    const copy: Note = {
      ...src,
      id: `${src.id}-copy-${Date.now()}`,
      title: (src.title || '無題') + ' (コピー)',
      updatedAt: Date.now(),
      createdAt: Date.now(),
      pinned: false,
    };
    setNotes((prev) => [copy, ...prev]);
  };

  // ---- FAB ----
  // Notes: 常に新規作成 / Daily: 今日分が既存なら開く
  const handleFab = () => {
    if (kind === 'notes') {
      const newNote: Note = {
        id: `n${Date.now()}`,
        kind: 'notes',
        title: '',
        excerpt: '',
        body: '',
        notebookId: 'proj',
        tagIds: [],
        updatedAt: Date.now(),
        createdAt: Date.now(),
        pinned: false,
      };
      setNotes((prev) => [newNote, ...prev]);
      openEditor(newNote.id);
    } else {
      // モックなので「今日」は 2026-07-19 固定
      const today = '2026-07-19';
      const exists = notes.find((n) => n.kind === 'daily' && n.date === today);
      if (exists) {
        openEditor(exists.id);
        return;
      }
      const newDaily: Note = {
        id: `d${Date.now()}`,
        kind: 'daily',
        title: '',
        excerpt: '',
        body: DAILY_TEMPLATE,
        notebookId: 'journal',
        tagIds: [],
        updatedAt: Date.now(),
        createdAt: Date.now(),
        pinned: false,
        date: today,
        weekday: '火',
        mood: 'green',
        sessions: 0,
      };
      setNotes((prev) => [newDaily, ...prev]);
      openEditor(newDaily.id);
    }
  };

  // ---- 一覧フィルタ / ソート ----
  const matchesQuery = (n: Note, q: string) => {
    const lq = q.toLowerCase();
    return (
      n.title.toLowerCase().includes(lq) ||
      n.excerpt.toLowerCase().includes(lq) ||
      n.tagIds.some((tid) =>
        TAGS.find((t) => t.id === tid)?.name.toLowerCase().includes(lq)
      )
    );
  };
  const sortFn = (a: Note, b: Note) => {
    if (sortKey === 'title') return a.title.localeCompare(b.title, 'ja');
    if (sortKey === 'created') return b.createdAt - a.createdAt;
    return b.updatedAt - a.updatedAt;
  };

  const visible = notes
    .filter((n) => n.kind === kind)
    .filter((n) => (filterNotebookId ? n.notebookId === filterNotebookId : true))
    .filter((n) =>
      filterTagIds.length === 0
        ? true
        : filterTagIds.some((t) => n.tagIds.includes(t))
    )
    .filter((n) => (!query ? true : matchesQuery(n, query)));

  const pinned = visible.filter((n) => n.pinned).sort(sortFn);
  const normal = visible.filter((n) => !n.pinned).sort(sortFn);

  const clearAllFilters = () => {
    setFilterNotebookId(null);
    setFilterTagIds([]);
  };

  const hasFilter = filterNotebookId !== null || filterTagIds.length > 0;
  const sheetTarget = notes.find((n) => n.id === sheetTargetId) || null;

  return (
    <div
      className="mx-auto max-w-md flex flex-col relative overflow-hidden"
      style={{ background: C.base, color: C.text, minHeight: '100vh' }}
    >
      {/* ====== List View (常に下にレンダリング、Editor が上に被さる) ====== */}
      <main className="flex-1 overflow-y-auto pb-20">
        <ListView
          kind={kind}
          setKind={setKind}
          layout={layout}
          setLayout={setLayout}
          query={query}
          setQuery={setQuery}
          pinned={pinned}
          normal={normal}
          filterNotebookId={filterNotebookId}
          filterTagIds={filterTagIds}
          hasFilter={hasFilter}
          onClearAllFilters={clearAllFilters}
          onRemoveNotebookFilter={() => setFilterNotebookId(null)}
          onRemoveTagFilter={(tid) =>
            setFilterTagIds((prev) => prev.filter((t) => t !== tid))
          }
          onOpenItem={openEditor}
          onLongPressItem={(id) => {
            setSheetTargetId(id);
            setActiveSheet('item-menu');
          }}
          onOpenSort={() => setActiveSheet('sort')}
          onOpenFilter={() => setActiveSheet('filter')}
        />
      </main>

      {/* ====== Bottom Tab (個別デモ用の飾り、Materials のみアクティブ) ====== */}
      <BottomTabCosmetic />

      {/* ====== FAB ====== */}
      {view === 'list' && (
        <button
          onClick={handleFab}
          className="absolute right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 z-20"
          style={{ bottom: 80, background: C.mauve, color: C.base }}
          aria-label="新規作成"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      {/* ====== Editor View (translateX で右からスライドイン) ====== */}
      <div
        className="absolute inset-0 z-40 transition-transform duration-300 ease-out flex flex-col"
        style={{
          background: C.base,
          transform: view === 'editor' ? 'translateX(0)' : 'translateX(100%)',
          pointerEvents: view === 'editor' ? 'auto' : 'none',
        }}
      >
        {editing && (
          <EditorView
            note={editing}
            onBack={closeEditor}
            onUpdate={(patch) => updateNote(editing.id, patch)}
            onOpenMore={() => setActiveSheet('editor-menu')}
            onOpenMood={() => setActiveSheet('mood')}
            onOpenTags={() => setActiveSheet('tag')}
          />
        )}
      </div>

      {/* ====== Sheets (z-50、Editor 上にもオーバーレイ) ====== */}
      <SortSheet
        open={activeSheet === 'sort'}
        sortKey={sortKey}
        onChange={(k) => {
          setSortKey(k);
          setActiveSheet(null);
        }}
        onClose={() => setActiveSheet(null)}
      />
      <ItemMenuSheet
        open={activeSheet === 'item-menu'}
        note={sheetTarget}
        onClose={() => setActiveSheet(null)}
        onPin={() => {
          if (sheetTargetId) togglePin(sheetTargetId);
          setActiveSheet(null);
        }}
        onDuplicate={() => {
          if (sheetTargetId) duplicateNote(sheetTargetId);
          setActiveSheet(null);
        }}
        onDelete={() => {
          if (sheetTargetId) deleteNote(sheetTargetId);
          setActiveSheet(null);
        }}
      />
      <EditorMenuSheet
        open={activeSheet === 'editor-menu'}
        onClose={() => setActiveSheet(null)}
        onDuplicate={() => {
          if (editing) duplicateNote(editing.id);
          setActiveSheet(null);
        }}
        onDelete={() => {
          if (editing) deleteNote(editing.id);
          setActiveSheet(null);
        }}
      />
      <FilterSheet
        open={activeSheet === 'filter'}
        notebookId={filterNotebookId}
        tagIds={filterTagIds}
        onChangeNotebook={setFilterNotebookId}
        onToggleTag={(tid) =>
          setFilterTagIds((prev) =>
            prev.includes(tid) ? prev.filter((t) => t !== tid) : [...prev, tid]
          )
        }
        onClose={() => setActiveSheet(null)}
        onClear={clearAllFilters}
      />
      <MoodSheet
        open={activeSheet === 'mood'}
        current={editing?.mood}
        onSelect={(m) => {
          if (editing) updateNote(editing.id, { mood: m });
          setActiveSheet(null);
        }}
        onClose={() => setActiveSheet(null)}
      />
      <TagSheet
        open={activeSheet === 'tag'}
        selected={editing?.tagIds || []}
        onToggle={(tid) => {
          if (!editing) return;
          const next = editing.tagIds.includes(tid)
            ? editing.tagIds.filter((t) => t !== tid)
            : [...editing.tagIds, tid];
          updateNote(editing.id, { tagIds: next });
        }}
        onClose={() => setActiveSheet(null)}
      />
    </div>
  );
}

// =============================================
// Bottom tab (cosmetic, no real switch for individual demo)
// =============================================
function BottomTabCosmetic() {
  const items = [
    { label: 'Schedule', icon: <Calendar size={20} />, active: false },
    { label: 'Work', icon: <Clock size={20} />, active: false },
    { label: 'Materials', icon: <FileText size={20} />, active: true },
    { label: 'Settings', icon: <SettingsIcon size={20} />, active: false },
  ];
  return (
    <nav
      className="absolute bottom-0 left-0 right-0 border-t z-30"
      style={{ background: C.mantle, borderColor: C.surface0 }}
    >
      <div className="grid grid-cols-4">
        {items.map((it) => (
          <button
            key={it.label}
            className="flex flex-col items-center py-2.5 gap-0.5"
            style={{ color: it.active ? C.mauve : C.overlay0 }}
          >
            <div style={{ transform: it.active ? 'translateY(-2px)' : 'none' }}>
              {it.icon}
            </div>
            <span className="text-[10px] font-medium tracking-wide">{it.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// =============================================
// List View
// =============================================
function ListView({
  kind,
  setKind,
  layout,
  setLayout,
  query,
  setQuery,
  pinned,
  normal,
  filterNotebookId,
  filterTagIds,
  hasFilter,
  onClearAllFilters,
  onRemoveNotebookFilter,
  onRemoveTagFilter,
  onOpenItem,
  onLongPressItem,
  onOpenSort,
  onOpenFilter,
}: {
  kind: MaterialKind;
  setKind: (k: MaterialKind) => void;
  layout: Layout;
  setLayout: (l: Layout) => void;
  query: string;
  setQuery: (q: string) => void;
  pinned: Note[];
  normal: Note[];
  filterNotebookId: string | null;
  filterTagIds: string[];
  hasFilter: boolean;
  onClearAllFilters: () => void;
  onRemoveNotebookFilter: () => void;
  onRemoveTagFilter: (tid: string) => void;
  onOpenItem: (id: string) => void;
  onLongPressItem: (id: string) => void;
  onOpenSort: () => void;
  onOpenFilter: () => void;
}) {
  const activeNotebook = NOTEBOOKS.find((nb) => nb.id === filterNotebookId);
  const filterCount = (filterNotebookId ? 1 : 0) + filterTagIds.length;

  return (
    <div className="flex flex-col">
      {/* ヘッダー */}
      <header className="px-3 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 rounded-lg transition-colors active:bg-white/5"
            style={{ color: C.subtext1 }}
            aria-label="メニュー"
          >
            <Menu size={20} />
          </button>
          <div>
            <h1
              className="text-[10px] uppercase tracking-widest"
              style={{ color: C.overlay0 }}
            >
              Materials
            </h1>
            <h2
              className="text-xl font-semibold leading-tight"
              style={{ color: C.text }}
            >
              {kind === 'notes' ? 'ノート' : 'ジャーナル'}
            </h2>
          </div>
        </div>
        <div className="flex p-0.5 rounded-lg" style={{ background: C.surface0 }}>
          <button
            onClick={() => setLayout('card')}
            className="p-1.5 rounded-md transition-all"
            style={{
              background: layout === 'card' ? C.surface1 : 'transparent',
              color: layout === 'card' ? C.text : C.overlay0,
            }}
            aria-label="カード表示"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setLayout('list')}
            className="p-1.5 rounded-md transition-all"
            style={{
              background: layout === 'list' ? C.surface1 : 'transparent',
              color: layout === 'list' ? C.text : C.overlay0,
            }}
            aria-label="リスト表示"
          >
            <ListIcon size={16} />
          </button>
        </div>
      </header>

      {/* kind タブ */}
      <div className="px-3 pb-3">
        <div className="flex p-1 rounded-xl" style={{ background: C.surface0 }}>
          {[
            { key: 'notes' as const, label: 'Notes', icon: <FileText size={14} /> },
            { key: 'daily' as const, label: 'Daily', icon: <BookOpen size={14} /> },
          ].map((k) => {
            const isActive = kind === k.key;
            return (
              <button
                key={k.key}
                onClick={() => setKind(k.key)}
                className="flex-1 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5"
                style={{
                  background: isActive ? C.mauve : 'transparent',
                  color: isActive ? C.base : C.subtext1,
                }}
              >
                {k.icon}
                {k.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 検索 + ソート + フィルタ */}
      <div className="px-4 mb-3 flex items-center gap-2">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-0"
          style={{ background: C.surface0 }}
        >
          <Search size={16} style={{ color: C.overlay0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={kind === 'notes' ? 'ノートを検索...' : '日記を検索...'}
            className="bg-transparent flex-1 text-sm outline-none placeholder:opacity-60 min-w-0"
            style={{ color: C.text }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ color: C.overlay0 }}
              aria-label="検索クリア"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={onOpenSort}
          className="p-2 rounded-xl transition-colors"
          style={{ background: C.surface0, color: C.subtext1 }}
          aria-label="ソート"
        >
          <ArrowUpDown size={16} />
        </button>
        <button
          onClick={onOpenFilter}
          className="p-2 rounded-xl relative transition-colors"
          style={{
            background: hasFilter ? C.mauve : C.surface0,
            color: hasFilter ? C.base : C.subtext1,
          }}
          aria-label="フィルタ"
        >
          <Filter size={16} />
          {hasFilter && (
            <span
              className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] flex items-center justify-center font-semibold"
              style={{ background: C.peach, color: C.base }}
            >
              {filterCount}
            </span>
          )}
        </button>
      </div>

      {/* アクティブフィルタチップ */}
      {hasFilter && (
        <div className="px-4 mb-3 flex items-center gap-1.5 flex-wrap">
          {activeNotebook && (
            <button
              onClick={onRemoveNotebookFilter}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px]"
              style={{ background: C.surface1, color: C.text }}
            >
              <Folder size={11} />
              {activeNotebook.name}
              <X size={11} style={{ color: C.subtext0 }} />
            </button>
          )}
          {filterTagIds.map((tid) => {
            const tag = TAGS.find((t) => t.id === tid);
            if (!tag) return null;
            return (
              <button
                key={tid}
                onClick={() => onRemoveTagFilter(tid)}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px]"
                style={{ background: `${tag.color}22`, color: tag.color }}
              >
                <Hash size={11} />
                {tag.name}
                <X size={11} />
              </button>
            );
          })}
          <button
            onClick={onClearAllFilters}
            className="ml-auto text-[11px] underline"
            style={{ color: C.overlay0 }}
          >
            すべてクリア
          </button>
        </div>
      )}

      {/* ピン留め + 通常 セクション */}
      <div className="px-4">
        {pinned.length > 0 && (
          <>
            <SectionHeader
              icon={<Pin size={11} fill={C.peach} />}
              label="ピン留め"
              count={pinned.length}
              accent={C.peach}
            />
            <NotesGroup
              kind={kind}
              layout={layout}
              notes={pinned}
              onOpen={onOpenItem}
              onLongPress={onLongPressItem}
            />
            {normal.length > 0 && (
              <>
                <div className="h-4" />
                <SectionHeader
                  label={kind === 'notes' ? 'すべてのノート' : 'すべての日記'}
                  count={normal.length}
                />
              </>
            )}
          </>
        )}
        {normal.length > 0 && (
          <NotesGroup
            kind={kind}
            layout={layout}
            notes={normal}
            onOpen={onOpenItem}
            onLongPress={onLongPressItem}
          />
        )}
        {pinned.length === 0 && normal.length === 0 && (
          <EmptyState query={query} hasFilter={hasFilter} kind={kind} />
        )}
      </div>

      {/* 下タブと FAB の隙間を確保 */}
      <div className="h-4" />
    </div>
  );
}

// =============================================
// Section header
// =============================================
function SectionHeader({
  icon,
  label,
  count,
  accent,
}: {
  icon?: React.ReactNode;
  label: string;
  count: number;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-2 px-1">
      {icon && <span style={{ color: accent || C.overlay0 }}>{icon}</span>}
      <span
        className="text-[10px] uppercase tracking-widest font-semibold"
        style={{ color: accent || C.overlay0 }}
      >
        {label}
      </span>
      <span className="text-[10px]" style={{ color: C.overlay0 }}>
        ({count})
      </span>
    </div>
  );
}

// =============================================
// Empty state
// =============================================
function EmptyState({
  query,
  hasFilter,
  kind,
}: {
  query: string;
  hasFilter: boolean;
  kind: MaterialKind;
}) {
  let msg = '';
  if (query)
    msg = `「${query}」に一致する${kind === 'notes' ? 'ノート' : '日記'}は見つかりませんでした`;
  else if (hasFilter) msg = '選択中のフィルタに一致する項目がありません';
  else msg = kind === 'notes' ? 'まだノートがありません' : 'まだ日記がありません';
  return (
    <div className="text-center py-10">
      <div
        className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-2"
        style={{ background: C.surface0 }}
      >
        {kind === 'notes' ? (
          <FileText size={20} style={{ color: C.overlay0 }} />
        ) : (
          <BookOpen size={20} style={{ color: C.overlay0 }} />
        )}
      </div>
      <div className="text-xs" style={{ color: C.subtext0 }}>
        {msg}
      </div>
    </div>
  );
}

// =============================================
// NotesGroup ディスパッチャ
// =============================================
function NotesGroup({
  kind,
  layout,
  notes,
  onOpen,
  onLongPress,
}: {
  kind: MaterialKind;
  layout: Layout;
  notes: Note[];
  onOpen: (id: string) => void;
  onLongPress: (id: string) => void;
}) {
  if (kind === 'notes') {
    return layout === 'card' ? (
      <NotesCardList notes={notes} onOpen={onOpen} onLongPress={onLongPress} />
    ) : (
      <NotesRowList notes={notes} onOpen={onOpen} onLongPress={onLongPress} />
    );
  }
  return layout === 'card' ? (
    <DailyCardList notes={notes} onOpen={onOpen} onLongPress={onLongPress} />
  ) : (
    <DailyRowList notes={notes} onOpen={onOpen} onLongPress={onLongPress} />
  );
}

// =============================================
// 長押し対応ボタン
// 長押し検知後はクリックを無視。移動するとタイマーキャンセル
// =============================================
function LongPressable({
  children,
  onTap,
  onLongPress,
  className,
  style,
}: {
  children: React.ReactNode;
  onTap: () => void;
  onLongPress: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const timerRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const start = () => {
    firedRef.current = false;
    timerRef.current = window.setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, 500);
  };
  const cancel = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => cancel(), []);

  return (
    <button
      onPointerDown={start}
      onPointerMove={cancel}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onClick={() => {
        if (firedRef.current) {
          firedRef.current = false;
          return;
        }
        onTap();
      }}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}

// =============================================
// Notes - Card list
// =============================================
function NotesCardList({
  notes,
  onOpen,
  onLongPress,
}: {
  notes: Note[];
  onOpen: (id: string) => void;
  onLongPress: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {notes.map((n) => (
        <LongPressable
          key={n.id}
          onTap={() => onOpen(n.id)}
          onLongPress={() => onLongPress(n.id)}
          className="w-full text-left p-3 rounded-xl"
          style={{ background: C.surface0 }}
        >
          <div className="flex items-center gap-1.5">
            {n.pinned && (
              <Pin size={11} fill={C.peach} style={{ color: C.peach }} />
            )}
            <div
              className="font-medium text-sm flex-1 truncate"
              style={{ color: C.text }}
            >
              {n.title || '無題のノート'}
            </div>
          </div>
          <div
            className="text-xs mt-1 line-clamp-2"
            style={{ color: C.subtext0 }}
          >
            {n.excerpt || '本文がありません'}
          </div>
          <div className="flex items-center justify-between mt-2 gap-2">
            <div className="flex gap-1 flex-wrap min-w-0">
              {n.tagIds.map((tid) => {
                const t = TAGS.find((x) => x.id === tid);
                if (!t) return null;
                return (
                  <span
                    key={tid}
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: `${t.color}22`, color: t.color }}
                  >
                    #{t.name}
                  </span>
                );
              })}
            </div>
            <div
              className="text-[10px] flex-shrink-0"
              style={{ color: C.overlay0 }}
            >
              {timeAgo(n.updatedAt)}
            </div>
          </div>
        </LongPressable>
      ))}
    </div>
  );
}

// =============================================
// Notes - Row list
// =============================================
function NotesRowList({
  notes,
  onOpen,
  onLongPress,
}: {
  notes: Note[];
  onOpen: (id: string) => void;
  onLongPress: (id: string) => void;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden divide-y"
      style={{ background: C.surface0 }}
    >
      {notes.map((n) => (
        <LongPressable
          key={n.id}
          onTap={() => onOpen(n.id)}
          onLongPress={() => onLongPress(n.id)}
          className="w-full text-left p-3 flex items-center gap-3"
          style={{ background: 'transparent' }}
        >
          <div
            className="w-1 self-stretch rounded-full flex-shrink-0"
            style={{
              background: n.pinned ? C.peach : C.mauve,
              minHeight: 32,
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {n.pinned && (
                <Pin size={10} fill={C.peach} style={{ color: C.peach }} />
              )}
              <div
                className="font-medium text-sm truncate"
                style={{ color: C.text }}
              >
                {n.title || '無題のノート'}
              </div>
            </div>
            <div
              className="text-[11px] truncate"
              style={{ color: C.subtext0 }}
            >
              {n.excerpt || '本文がありません'}
            </div>
          </div>
          <div
            className="text-[10px] flex-shrink-0"
            style={{ color: C.overlay0 }}
          >
            {timeAgo(n.updatedAt)}
          </div>
        </LongPressable>
      ))}
    </div>
  );
}

// =============================================
// Daily - Card list
// =============================================
function DailyCardList({
  notes,
  onOpen,
  onLongPress,
}: {
  notes: Note[];
  onOpen: (id: string) => void;
  onLongPress: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {notes.map((d) => (
        <LongPressable
          key={d.id}
          onTap={() => onOpen(d.id)}
          onLongPress={() => onLongPress(d.id)}
          className="w-full text-left p-3 rounded-xl flex gap-3"
          style={{ background: C.surface0 }}
        >
          <div
            className="flex flex-col items-center justify-center px-2 py-1 rounded-lg flex-shrink-0"
            style={{ background: C.mantle, minWidth: 52 }}
          >
            <span className="text-[9px]" style={{ color: C.overlay0 }}>
              {d.date?.slice(5, 7)}月
            </span>
            <span
              className="text-xl font-light leading-none"
              style={{ color: C.text }}
            >
              {d.date ? parseInt(d.date.slice(8, 10), 10) : ''}
            </span>
            <span
              className="text-[9px] mt-0.5"
              style={{ color: C.subtext0 }}
            >
              {d.weekday}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {d.pinned && (
                <Pin size={10} fill={C.peach} style={{ color: C.peach }} />
              )}
              {d.mood && (
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: MOOD_COLOR[d.mood] }}
                />
              )}
              <div
                className="font-medium text-sm truncate"
                style={{ color: C.text }}
              >
                {d.title || '無題'}
              </div>
            </div>
            <div
              className="text-xs mt-1 line-clamp-2"
              style={{ color: C.subtext0 }}
            >
              {d.excerpt || '本文がありません'}
            </div>
            <div
              className="text-[10px] mt-1.5"
              style={{ color: C.overlay0 }}
            >
              セッション {d.sessions || 0} 回
            </div>
          </div>
        </LongPressable>
      ))}
    </div>
  );
}

// =============================================
// Daily - Row list
// =============================================
function DailyRowList({
  notes,
  onOpen,
  onLongPress,
}: {
  notes: Note[];
  onOpen: (id: string) => void;
  onLongPress: (id: string) => void;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden divide-y"
      style={{ background: C.surface0 }}
    >
      {notes.map((d) => (
        <LongPressable
          key={d.id}
          onTap={() => onOpen(d.id)}
          onLongPress={() => onLongPress(d.id)}
          className="w-full text-left p-3 flex items-center gap-3"
          style={{ background: 'transparent' }}
        >
          <div
            className="w-1 self-stretch rounded-full flex-shrink-0"
            style={{
              background: d.mood ? MOOD_COLOR[d.mood] : C.overlay0,
              minHeight: 32,
            }}
          />
          <div
            className="text-[10px] tabular-nums w-12 flex-shrink-0"
            style={{ color: C.subtext0 }}
          >
            {d.date?.slice(5)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              {d.pinned && (
                <Pin size={10} fill={C.peach} style={{ color: C.peach }} />
              )}
              <div className="text-sm truncate" style={{ color: C.text }}>
                {d.title || '無題'}
              </div>
            </div>
          </div>
          <div
            className="text-[10px] flex-shrink-0"
            style={{ color: C.overlay0 }}
          >
            {d.sessions || 0}回
          </div>
        </LongPressable>
      ))}
    </div>
  );
}

// =============================================
// Editor View
// =============================================
function EditorView({
  note,
  onBack,
  onUpdate,
  onOpenMore,
  onOpenMood,
  onOpenTags,
}: {
  note: Note;
  onBack: () => void;
  onUpdate: (patch: Partial<Note>) => void;
  onOpenMore: () => void;
  onOpenMood: () => void;
  onOpenTags: () => void;
}) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  // ツールバーの active 状態 (見た目だけ、実機能は次回実装)
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const editTimer = useRef<number | null>(null);
  const saveTimer = useRef<number | null>(null);

  // 別のノートを開いた時に状態をリセット
  useEffect(() => {
    setStatus('saved');
    setActiveFormats(new Set());
    return () => {
      if (editTimer.current) clearTimeout(editTimer.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [note.id]);

  // 入力 → editing → 1s後 saving → 0.4s後 saved の遷移
  const triggerEdit = () => {
    setStatus('editing');
    if (editTimer.current) clearTimeout(editTimer.current);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    editTimer.current = window.setTimeout(() => {
      setStatus('saving');
      saveTimer.current = window.setTimeout(() => setStatus('saved'), 400);
    }, 1000);
  };

  const toggleFormat = (fmt: string) => {
    setActiveFormats((prev) => {
      const next = new Set(prev);
      if (next.has(fmt)) next.delete(fmt);
      else next.add(fmt);
      return next;
    });
  };

  const statusMeta: Record<SaveStatus, { label: string; color: string }> = {
    saved: { label: '保存済み', color: C.subtext0 },
    editing: { label: '編集中...', color: C.yellow },
    saving: { label: '保存中...', color: C.sky },
  };

  const selectedTags = note.tagIds
    .map((tid) => TAGS.find((t) => t.id === tid))
    .filter((t): t is Tag => Boolean(t));

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <header
        className="px-3 pt-5 pb-3 flex items-center justify-between border-b"
        style={{ borderColor: C.surface0 }}
      >
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg transition-colors active:bg-white/5"
          style={{ color: C.subtext1 }}
          aria-label="戻る"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full transition-colors duration-200"
            style={{ background: statusMeta[status].color }}
          />
          <span
            className="text-xs transition-colors duration-200"
            style={{ color: statusMeta[status].color }}
          >
            {statusMeta[status].label}
          </span>
        </div>
        <button
          onClick={onOpenMore}
          className="p-1.5 rounded-lg transition-colors active:bg-white/5"
          style={{ color: C.subtext1 }}
          aria-label="メニュー"
        >
          <MoreVertical size={20} />
        </button>
      </header>

      {/* タイトル入力 */}
      <div className="px-4 pt-4">
        <input
          value={note.title}
          onChange={(e) => {
            onUpdate({ title: e.target.value });
            triggerEdit();
          }}
          placeholder={
            note.kind === 'notes' ? 'ノートのタイトル' : '今日のタイトル'
          }
          className="w-full bg-transparent text-xl font-semibold outline-none placeholder:opacity-40"
          style={{ color: C.text }}
        />
      </div>

      {/* メタ行 */}
      <div className="px-4 pt-3 pb-3 space-y-2">
        {note.kind === 'daily' && (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 text-xs"
              style={{ color: C.subtext0 }}
            >
              <Calendar size={12} />
              {note.date} ({note.weekday})
            </div>
            <button
              onClick={onOpenMood}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg ml-auto"
              style={{ background: C.surface0 }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: note.mood ? MOOD_COLOR[note.mood] : C.overlay0,
                }}
              />
              <span className="text-xs" style={{ color: C.text }}>
                {note.mood ? MOOD_LABEL[note.mood] : 'ムード未設定'}
              </span>
              <ChevronRight size={12} style={{ color: C.overlay0 }} />
            </button>
          </div>
        )}
        {/* タグチップ + 追加 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {selectedTags.map((t) => (
            <span
              key={t.id}
              className="text-[11px] px-2 py-1 rounded-full flex items-center gap-1"
              style={{ background: `${t.color}22`, color: t.color }}
            >
              <Hash size={10} />
              {t.name}
            </span>
          ))}
          <button
            onClick={onOpenTags}
            className="text-[11px] px-2 py-1 rounded-full flex items-center gap-1 border border-dashed"
            style={{ borderColor: C.surface2, color: C.subtext0 }}
          >
            <Plus size={10} />
            タグ
          </button>
        </div>
      </div>

      {/* ツールバー (見た目のみ、active 切替) */}
      <div
        className="border-y px-2 py-1.5 flex items-center gap-0.5 overflow-x-auto"
        style={{ borderColor: C.surface0 }}
      >
        {[
          { key: 'bold', icon: <Bold size={15} />, label: '太字' },
          { key: 'italic', icon: <Italic size={15} />, label: '斜体' },
          { key: 'h', icon: <Heading1 size={15} />, label: '見出し' },
          { key: 'list', icon: <ListIcon size={15} />, label: 'リスト' },
          { key: 'quote', icon: <Quote size={15} />, label: '引用' },
          { key: 'code', icon: <Code size={15} />, label: 'コード' },
          { key: 'link', icon: <Link2 size={15} />, label: 'リンク' },
        ].map((b) => {
          const isActive = activeFormats.has(b.key);
          return (
            <button
              key={b.key}
              onClick={() => toggleFormat(b.key)}
              className="p-1.5 rounded-md transition-colors flex-shrink-0"
              style={{
                background: isActive ? C.surface1 : 'transparent',
                color: isActive ? C.mauve : C.subtext1,
              }}
              aria-label={b.label}
            >
              {b.icon}
            </button>
          );
        })}
      </div>

      {/* 本文プレースホルダ (次回 TipTap に置換) */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <textarea
          value={note.body}
          onChange={(e) => {
            onUpdate({ body: e.target.value });
            triggerEdit();
          }}
          placeholder={
            note.kind === 'notes'
              ? 'ここに本文を書く...'
              : 'テンプレートに沿って書く...'
          }
          className="w-full bg-transparent text-sm outline-none resize-none placeholder:opacity-40 leading-relaxed"
          style={{ color: C.text, minHeight: 320, fontFamily: 'ui-monospace, monospace' }}
          rows={16}
        />
      </div>
    </div>
  );
}

// =============================================
// Bottom Sheet 共通
// =============================================
function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        onClick={onClose}
        className="absolute inset-0 z-50 transition-opacity duration-200"
        style={{
          background: 'rgba(0,0,0,0.55)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />
      <div
        className="absolute left-0 right-0 bottom-0 z-50 rounded-t-2xl transition-transform duration-300 ease-out"
        style={{
          background: C.mantle,
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          pointerEvents: open ? 'auto' : 'none',
          paddingBottom: 20,
          maxHeight: '85%',
          overflowY: 'auto',
        }}
      >
        <div className="flex justify-center pt-2 pb-3">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: C.surface2 }}
          />
        </div>
        {title && (
          <div
            className="px-4 pb-2 text-[11px] uppercase tracking-widest font-semibold"
            style={{ color: C.overlay0 }}
          >
            {title}
          </div>
        )}
        <div className="px-2 pb-2">{children}</div>
      </div>
    </>
  );
}

// =============================================
// Sheet row 共通
// =============================================
function SheetRow({
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
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors active:bg-white/5"
    >
      <span style={{ color: danger ? C.red : C.subtext1 }}>{icon}</span>
      <span
        className="text-sm flex-1 text-left"
        style={{ color: danger ? C.red : C.text }}
      >
        {label}
      </span>
    </button>
  );
}

// =============================================
// Sort Sheet
// =============================================
function SortSheet({
  open,
  sortKey,
  onChange,
  onClose,
}: {
  open: boolean;
  sortKey: SortKey;
  onChange: (k: SortKey) => void;
  onClose: () => void;
}) {
  const opts: { key: SortKey; label: string }[] = [
    { key: 'updated', label: '更新日 (新しい順)' },
    { key: 'created', label: '作成日 (新しい順)' },
    { key: 'title', label: 'タイトル (あいうえお順)' },
  ];
  return (
    <BottomSheet open={open} onClose={onClose} title="並び替え">
      <div className="space-y-0.5">
        {opts.map((o) => {
          const sel = sortKey === o.key;
          return (
            <button
              key={o.key}
              onClick={() => onChange(o.key)}
              className="w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors"
              style={{ background: sel ? C.surface0 : 'transparent' }}
            >
              <span className="text-sm" style={{ color: C.text }}>
                {o.label}
              </span>
              {sel && <Check size={16} style={{ color: C.mauve }} />}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

// =============================================
// Item Menu Sheet (長押し)
// =============================================
function ItemMenuSheet({
  open,
  note,
  onClose,
  onPin,
  onDuplicate,
  onDelete,
}: {
  open: boolean;
  note: Note | null;
  onClose: () => void;
  onPin: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={note?.title || '操作'}
    >
      <div className="space-y-0.5">
        <SheetRow
          icon={<Pin size={16} />}
          label={note?.pinned ? 'ピン留めを解除' : 'ピン留め'}
          onClick={onPin}
        />
        <SheetRow icon={<Copy size={16} />} label="複製" onClick={onDuplicate} />
        <SheetRow
          icon={<Trash2 size={16} />}
          label="削除"
          onClick={onDelete}
          danger
        />
      </div>
    </BottomSheet>
  );
}

// =============================================
// Editor Menu Sheet (⋯)
// =============================================
function EditorMenuSheet({
  open,
  onClose,
  onDuplicate,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="ノート操作">
      <div className="space-y-0.5">
        <SheetRow icon={<Copy size={16} />} label="複製" onClick={onDuplicate} />
        <SheetRow
          icon={<Trash2 size={16} />}
          label="削除"
          onClick={onDelete}
          danger
        />
      </div>
    </BottomSheet>
  );
}

// =============================================
// Filter Sheet (ノートブック単一 + タグ複数 OR)
// =============================================
function FilterSheet({
  open,
  notebookId,
  tagIds,
  onChangeNotebook,
  onToggleTag,
  onClose,
  onClear,
}: {
  open: boolean;
  notebookId: string | null;
  tagIds: string[];
  onChangeNotebook: (id: string | null) => void;
  onToggleTag: (id: string) => void;
  onClose: () => void;
  onClear: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="フィルタ">
      {/* ノートブック */}
      <div className="mb-4">
        <div
          className="px-2 mb-1.5 text-[10px] uppercase tracking-widest"
          style={{ color: C.overlay0 }}
        >
          ノートブック (単一選択)
        </div>
        <div className="grid grid-cols-2 gap-1.5 px-1">
          {NOTEBOOKS.map((nb) => {
            const sel = notebookId === nb.id;
            return (
              <button
                key={nb.id}
                onClick={() => onChangeNotebook(sel ? null : nb.id)}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors"
                style={{
                  background: sel ? C.mauve : C.surface0,
                  color: sel ? C.base : C.text,
                }}
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <Folder size={12} />
                  {nb.name}
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: sel ? C.base : C.overlay0 }}
                >
                  {nb.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* タグ */}
      <div className="mb-4">
        <div
          className="px-2 mb-1.5 text-[10px] uppercase tracking-widest"
          style={{ color: C.overlay0 }}
        >
          タグ (複数選択可、OR)
        </div>
        <div className="flex flex-wrap gap-1.5 px-1">
          {TAGS.map((t) => {
            const sel = tagIds.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => onToggleTag(t.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs transition-colors"
                style={{
                  background: sel ? t.color : `${t.color}22`,
                  color: sel ? C.base : t.color,
                  fontWeight: sel ? 600 : 400,
                }}
              >
                <Hash size={11} />
                {t.name}
                <span
                  className="text-[10px] opacity-70"
                  style={{ color: sel ? C.base : t.color }}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-1 mt-4 flex gap-2">
        <button
          onClick={onClear}
          className="flex-1 py-2.5 rounded-lg text-sm border transition-colors"
          style={{ borderColor: C.surface1, color: C.subtext1 }}
        >
          すべてクリア
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: C.mauve, color: C.base }}
        >
          適用
        </button>
      </div>
    </BottomSheet>
  );
}

// =============================================
// Mood Sheet
// =============================================
function MoodSheet({
  open,
  current,
  onSelect,
  onClose,
}: {
  open: boolean;
  current?: Mood;
  onSelect: (m: Mood) => void;
  onClose: () => void;
}) {
  const moods: Mood[] = ['green', 'sky', 'yellow', 'peach', 'red'];
  return (
    <BottomSheet open={open} onClose={onClose} title="ムードを選択">
      <div className="space-y-0.5">
        {moods.map((m) => {
          const sel = current === m;
          return (
            <button
              key={m}
              onClick={() => onSelect(m)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors"
              style={{ background: sel ? C.surface0 : 'transparent' }}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: MOOD_COLOR[m] }}
              />
              <span
                className="text-sm flex-1 text-left"
                style={{ color: C.text }}
              >
                {MOOD_LABEL[m]}
              </span>
              {sel && <Check size={16} style={{ color: C.mauve }} />}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

// =============================================
// Tag Sheet
// =============================================
function TagSheet({
  open,
  selected,
  onToggle,
  onClose,
}: {
  open: boolean;
  selected: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="タグを選択 (複数可)">
      <div className="flex flex-wrap gap-1.5 px-1 pb-2">
        {TAGS.map((t) => {
          const sel = selected.includes(t.id);
          return (
            <button
              key={t.id}
              onClick={() => onToggle(t.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs transition-colors"
              style={{
                background: sel ? t.color : `${t.color}22`,
                color: sel ? C.base : t.color,
                fontWeight: sel ? 600 : 400,
              }}
            >
              <Hash size={11} />
              {t.name}
              {sel && <Check size={11} />}
            </button>
          );
        })}
      </div>
      <button
        onClick={onClose}
        className="w-full mt-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        style={{ background: C.mauve, color: C.base }}
      >
        完了
      </button>
    </BottomSheet>
  );
}
