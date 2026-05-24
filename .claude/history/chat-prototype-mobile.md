# HISTORY (chat-prototype-mobile)

### 2026-05-24 - Phase 3.A〜F: prototype mock CRUD + 6 screens

#### 概要

計画書 03-11 (要件定義 / UIUX / CRUD モック) に従い、prototype/mobile-ui の mock CRUD 基盤と 6 画面 (Schedule / Work / Materials / Settings / Trash / CrossSearch) を一気通貫で実装。React infinite loop 修正と Toast useMemo 誤用バグ修正を含む。

#### 変更点

- **Phase 3.A 基盤層**: `lib/types.ts` (全エンティティ型) / `lib/id.ts` (genId / weekdayOf / DAILY_TEMPLATE) / `lib/storage.ts` (`lifemobile-mock:` namespace の localStorage wrapper) / `lib/mockStore.ts` (singleton state + 全 CRUD action) / `lib/wikiLink.ts` (resolveLink / suggestLinks / findBacklinks) / `hooks/useMockStore.ts` (useSyncExternalStore selector) / `data/holidays.ts` (2026 年祝日 5 件) / `data/seed.ts` (8 tags / 10 tasks / 8 events / 2 birthdays / 5 holidays / 8 notes / 8 dailies / 3 presets / 13 sessions / settings)
- **Phase 3.B Schedule リライト**: 旧 2118 行を破棄し 03/07 準拠で 1965 行に。ScheduleItem 統合型 (task/event/birthday/holiday)、CalendarTag 廃止、Sidebar は WikiTag + Status フィルタのみ、祝日 read-only バナー、StatusCheckbox 循環 (birthday/holiday 無効)、TagSheet IME 安全 (`isComposing` チェック)、WikiTag chip → `/cross-search?tag=<id>` 遷移、CRUD wire-up
- **Phase 3.B fix (DayDetailSheet + ThreeDayView)**: DayDetailSheet ヘッダーに `+` ボタン追加 + 空状態 CTA + footer 維持で 3 系統発見性向上。ThreeDayView 空時間帯タップで AddEventModal を選択日 + クリック位置時刻プリセット (`type='event'`, 09:00-10:00 等) で起動
- **Phase 3.C Work リライト**: 旧 2029 行を破棄し 04/08 準拠で 1544 行に。Pomodoro Timer (Countdown / SessionTypeTabs / Controls / Session Dots / Pulse) / TaskPickerModal (ScheduleItem(type=task) を WikiTag グルーピング + IME 安全検索) / HistoryTab (日付グルーピング + long press 削除) / SettingsTab (Preset chip 切替 + SliderRow / AutoStartBreaks toggle / 最後の 1 つ削除防御) / WORK 完了で task.status: todo→doing 自動進行 / autoStartBreaks 時 5 秒カウントダウン → BREAK 自動開始
- **Phase 3.D Materials リライト**: 旧 2046 行を破棄し 05/09 準拠で 1897 行に。Notes/Daily 切替、Card/Row layout 切替、Pin セクション、LongPress (600ms + 10px 移動キャンセル) → ItemMenuSheet、7 BottomSheet (Sort/Filter/ItemMenu/EditorMenu/Mood/Tag)、EditorView スライドイン、`[[title]]` 候補ポップアップ (IME 安全)、検出リンク chip 列、Backlink パネル、debounce 500ms 保存、SaveStatus チップ
- **Phase 3.E Settings/Trash/CrossSearch 新規**: SettingsScreen (923 行) — iOS 風 List Section 4 つ (表示 / 通知 / データ / About)、Theme/Language は RadioSheet、FontSize は Slider + 「本番で適用」バッジ、Notifications toggle、Mock 初期化 (1 秒 coolDown 付き ConfirmModal)、Repo URL Copy、簡易 i18n (ja/en)。TrashScreen (466 行) — 6 種フィルタ tab、TrashItemRow に復元/完全削除、全削除、空状態、Daily 復元時の ID 衝突ガード。CrossSearchScreen (470 行) — 検索 input (IME 安全) + 選択タグ chip 列 + 全エンティティ横断 (updatedAt 降順)、結果クリックで該当画面へ遷移
- **Phase 3.F 統合**: App.tsx に `/settings` `/trash` `/cross-search` 追加、IndexPage を 6 画面 + Phase 3 サブタイトルに更新、監査全通過 (forbidden deps / tailwind v4 / sessionStorage / localStorage 集中化 / namespace)
- **fix(react)**: useSyncExternalStore の selector で `.filter()` を呼ぶと毎回新配列で Object.is 失敗 → 無限ループ。raw state を選んで `useMemo` で派生する形に修正 (ScheduleScreen / WorkScreen / MaterialsScreen / CrossSearchScreen の 4 ファイル、計 6 selector)
- **fix(react)**: TrashScreen Toast の `useMemo` 誤用 (cleanup が破棄されリーク) を `useEffect` + `useRef(onDone)` に修正
- **infra**: sibling worktree (prototype/mobile-ui branch) に per-chat memory/history 機構を初期化 (memory/ + history/ + comm/.session-name=prototype-mobile + INDEX.md x2)
- **検証**: `npm run build` exit 0 / 型エラー 0 / 377KB (gzip 108KB) / Acceptance Criteria §10 すべて通過 / 残作業は 👀 目視確認と 🛑 PR 作成 (人手 Gate)
