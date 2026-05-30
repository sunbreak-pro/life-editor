# HISTORY (chat-prototype-mobile)

### 2026-05-30 - M-2: スラッシュコマンドメニュー (iOS additions)

#### 概要

iOS additions 要件 M-2 を prototype 環境で実装。アクセサリーバーに `+` ボタンを追加し、タップで 10 種のブロック変換コマンド (見出し 1-3 / 箇条書き / 番号付き / タスク / 引用 / コードブロック / 区切り線 / 画像リンク) をポップオーバーで表示。本番要件は TipTap BubbleMenu 前提だが、prototype は textarea + Markdown 記法方針 (Phase 3.I 判断) のため、既存の `wrapSelection` / `toggleLinePrefix` + 新規 `insertBlock` helper を流用。

#### 変更点

- **[feat] `+` ボタン + ポップオーバー** (`prototype/src/screens/MaterialsScreen.tsx::KeyboardAccessoryBar`)
  - 左端に Plus アイコンの「ブロックを挿入」ボタン (`aria-haspopup="menu"` / `aria-expanded`)
  - 上方向に幅 280px のメニューがフロート (`maxHeight: 60vh` でスクロール)
  - 各項目: 28×28 アイコンチップ + 日本語ラベル + Markdown ヒント (`# 大見出し` 等)
- **[feat] `insertBlock` helper**: 空行ならその場置換、非空行なら次行に挿入。コードブロック (` ```\n\n``` `) と区切り線 (`---\n`) に使用
- **[feat] `toggleLinePrefix` の strip 正規表現拡張**: `- [ ] ` / `1. ` も剥がし対象に追加 (リスト系コマンドの相互上書きを可能に)
- **[a11y] `role="menu"` / `role="menuitem"` / `aria-label`**: スクリーンリーダー対応
- **検証**: `npx tsc --noEmit` exit 0 / `npm run build` 392.84 kB / gzip 113.30 kB (+3 kB / +0.85 kB)

#### Acceptance Criteria 達成

- [x] AC1: `+` ボタンがバーに表示される
- [x] AC2: タップで 10 種のブロック変換コマンドがメニュー表示、選択でカーソル位置のノード/挿入が反映
- [ ] AC3: i18n (ja/en) — **prototype に i18n 機構なし、ja 固定**。本番側 (frontend/) で別途対応
- [x] AC4: Desktop でも同一バー + メニューが動作 (KeyboardAccessoryBar は focus 連動で両プラットフォーム共通)

#### 残課題 (M-3 後続候補)

- 空行ヒント (M-3): 現在行が空のときヒントチップ表示 + `/` 入力でメニュー起動 + IME ガード — 別タスク

### 2026-05-30 - M-1: Materials 行スワイプで edit/pin/delete (iOS additions)

#### 概要

iOS additions 要件 M-1 (`docs/requirements/ios-additions.md`) を prototype 環境で実装。Notes / Daily 一覧の行を右→左にスワイプすると、edit / pin / delete の 3 ボタンが背面から表示される (Apple 標準メモ風)。同時に開ける行は 1 つだけで、他行スワイプ・他行タップで前の行は自動的に閉じる。要件監査 (a) で発覚した「ほぼ完了済とは言えない」状態のうち、未着手 5 件の最初を消化。

#### 変更点

- **[feat] `SwipeRow` ヘルパー追加** (`prototype/src/screens/MaterialsScreen.tsx` 約 +140 行)
  - PointerEvent ベース、横方向 8px ロック → 50px 超で open commit、最大 1.2 倍まで rubber-band 風に追従
  - 開いた幅は 192px (3 ボタン × 64px)。`touchAction: pan-y` で縦スクロール優先
  - controlled state は MaterialsScreen の `swipeOpenId: string | null` (1 行のみ open 制約 = AC2)
- **[feat] 3 アクション**:
  - 編集 (FileText / `C.surface2`) → 既存 `handleOpenNote` で editor 起動
  - ピン (Pin / PinOff / `C.peach`) → 既存 `togglePinNote`
  - 削除 (Trash2 / `C.red`) → 既存 `confirmDelete` ダイアログ経由 → `deleteNote` (soft delete)
- **[ux] 開状態のタップで閉じる**: `onClickCapture` で open 中の行・他行 open 中の任意行タップを消費して `setSwipeOpenId(null)`
- **[非衝突] useLongPress との両立**: 既存 useLongPress は `dx>10` でキャンセル機構を持つので、SwipeRow が horizontal lock を取ると useLongPress は自動 cancel される (AC5)
- **検証**: `npx tsc --noEmit` exit 0 / `npm run build` 389.72 kB / gzip 112.45 kB / 2.83s

#### 既知の見た目課題 (次 fix-pack 候補)

- layout=card のとき SwipeRow の `background: C.crust` が NoteCard 周りの `gap-3` 隙間に出る (角丸処理が NoteCard 側のみのため)。機能 AC は全て満たすが、ユーザー目視確認 (B) で違和感あれば次回調整

#### Acceptance Criteria 達成

- [x] AC1: 右→左スワイプで 3 ボタン表示
- [x] AC2: 他行 swipe/タップで前行が閉じる (`swipeOpenId` 単一 state)
- [x] AC3: 削除はソフトデリート (既存 `deleteNote`)、Trash から復元可
- [x] AC4: pin はトグル
- [x] AC5: Long Press → ActionSheet と非衝突

### 2026-05-25 - Phase 3.J fix: swipe transition 条件再修正 + アクセサリーバー iOS 風リスタイル

#### 概要

Phase 3.I 検証で「右スワイプすると依然として左に戻る」「アクセサリーバーは出るが iOS 標準の半透明角丸バーとは違う」の 2 件。前者は CSS `transition` の条件抜けが原因 (`mode === "idle"` でも transition が効いていて、commit 後の `setDragX(0)` が 220ms かけて逆方向にアニメしていた) → transition を `mode === "animating"` のときのみオンに。後者は iOS Form Assistant Bar (左 ↑↓ / 右 ✓) が OS 領域で置換不可なので、その**真上**にトーンを揃えた半透明角丸フローティングバーとして再デザイン。

#### 変更点

- **[fix] swipe rebound (真因)**: `prototype/src/screens/ScheduleScreen.tsx` の `SwipePane` の transition 計算を `mode === "drag" ? "none" : "transform 220ms ..."` から `mode === "animating" ? "transform 220ms ..." : "none"` に逆転。これまで `idle` でも transition がオンだったため、commit setTimeout 内で `setMode("idle") + setDragX(0)` を呼んでも `dragX = width → 0` の 220ms アニメが走り、視覚的に「逆方向スワイプ」してから着地していた。`animating` の間だけ transition を効かせ、`idle` では transition: none で瞬時切替に。
- **[style] アクセサリーバー iOS Form Assistant Bar 風**: `prototype/src/screens/MaterialsScreen.tsx` の `KeyboardAccessoryBar` を、横幅いっぱい border-top のベタっとした帯から、左右マージン付きの角丸 (rounded-2xl) フローティングバーに変更。背景を `rgba(48, 48, 70, 0.78)` + `saturate(180%) blur(24px)` + 薄いシャドウ + 細い 1px border に。ボタンサイズも 36×36 に統一して間に細い区切り線 (× ボタン手前) を追加。
- **[note] iOS Form Assistant Bar (= 左 ↑↓ / 右 ✓) は OS 領域**: Web から内容を上書きする API は存在しない。Capacitor / WKWebView の `inputAccessoryView` をネイティブで上書きする以外に手はないと判明。本プロトタイプは Web のみの範囲で表現できる範囲 (ネイティブバーの真上に同トーンで配置) に留める。
- **検証**: `npx tsc -b` exit 0 / `npm run build` 386 KB / gzip 111 KB / 2.22s。HMR で iPhone Safari に自動反映。

### 2026-05-24 - Phase 3.I fix: swipe rebound 解消 + Materials アクセサリーバー追加

#### 概要

Phase 3.H 検証で「右スワイプすると左に瞬時に戻る (前々月にチラ見せ → 前月に戻る)」リバウンドと、「Materials のキーボード上書式ツールバーが iPhone 表示で見えない」の 2 件。前者は commit フローを 1 batch に統合して 1 frame 切替に、後者は textarea のまま focus 連動の半透明アクセサリーバーを追加し、Markdown 記法 (見出し / 太字 / 斜体 / リスト / 引用 / コード / [[link]] / #tag) を選択範囲もしくは現在行に挿入できるようにした。`npx tsc -b` exit 0、`npm run build` 386 KB / gzip 111 KB。

#### 変更点

- **[fix] Schedule swipe rebound**: SwipePane の commit フェーズで `onPrev/onNext` 呼び出し後に `requestAnimationFrame` を挟んで `setDragX(0) + setMode("idle")` を遅延していたのを、setTimeout コールバック内に統合。React 18 自動 batching により「新 anchorDate (= 新 3 ペーン)」「dragX = 0」「transition: none」が同 render に乗り、新中央 (= 旧前月) がそのまま中央に固定される。これまでは rAF 間に「anchorDate だけ更新 + dragX = width のまま」の中間 paint が 1 frame 入り、新「前々月」が中央に瞬時表示 → 次フレームで「前月」へジャンプ、というリバウンドが発生していた。
- **[feature] Materials KeyboardAccessoryBar**: `MaterialsScreen.tsx` の `EditorView` に半透明 blur のキーボード追従バーを追加。textarea の onFocus/onBlur で focus 状態管理、`visualViewport.height/offsetTop` で iPhone Safari のキーボード上に追従、PC では画面下沿いに常時可視。ボタン群: H1 / H2 / Bold / Italic / List / Quote / Code / Link `[[ ]]` / Hash (= タグシート起動) + 閉じる。
- **[design 判断] TipTap は導入せず textarea + Markdown 記法のまま**: 別 worktree (`prototype+mobile-ui`) では TipTap で全面置換したが、こちらの worktree は `[[link]]` 補完 / IME 補完 / suggestion 等 textarea ベースの固有機能が組み込まれており、TipTap 置換は副作用が大きい。代わりにアクセサリーバーから `wrapSelection("**","**")` / `toggleLinePrefix("# ")` 等で Markdown 文字列を挿入する設計に統一。既存の `handleBodyChange` を通すので [[link]] 補完も保たれる。
- **[ux] textarea paddingBottom**: アクセサリーバーが下端に重なるので textarea の paddingBottom を 72px に増やし最終行が隠れないように。
- **検証**: `npx tsc -b` exit 0、`npm run build` 386 KB / gzip 111 KB / 2.13s。dev server (PID 93066) HMR 経由で iPhone Safari に自動反映。

### 2026-05-24 - Phase 3.H fix: Schedule swipe を peeking 構造へ + DayDetailSheet タップ復活

#### 概要

ユーザー実機テストで「日付をタップしても DayDetailSheet が出ない」「スワイプの動作が iOS Calendar の流れる感じになっていない」の 2 件が判明。両方とも `SwipePane` 起因のため、ペーン構造そのものを 3 ペーン (前/当/次) 横並びの peeking 型に書き換え、タップ吸収の根本原因も合わせて修正。`prototype/src/screens/ScheduleScreen.tsx` のみの変更で、`npx tsc -b` exit 0 / `npm run build` 380 KB / gzip 109 KB。

#### 変更点

- **[fix] DayDetailSheet が出ないバグ**: 旧実装の `handlePointerUp` が「閾値未達 = スナップバック」を距離 0 のタップでも常に実行し、200ms 間 `mode === "snap-back"` を維持。その間 `handleClickCapture` が `e.stopPropagation()` で子要素 (MonthView の日付セル onClick) を殺していた。`axisRef.current !== "horizontal"` (= 純粋なタップ) なら何もせず idle に戻すように修正。clickCapture も「axisRef = horizontal または animating」のみ吸収するよう厳格化。
- **[feature] peeking 型 SwipePane**: 3 ペーン (前/当/次) を `width: 300%` の横並びで描画し `translateX(calc(-33.3333% + dragX))` で当ページを常時中央表示。ドラッグ中は隣ページがちらっと見えるので連続感が出る。コミット時は隣ペーンが中央へ来る位置までスライド (220ms ease-out) → 親の `anchorDate` 更新 → `requestAnimationFrame` で `dragX = 0` + transition オフで瞬時切替し新しい 3 ペーンを中央に固定。Month / ThreeDay 両 view で適用。
- **[API 変更] SwipePane**: `children` を渡す形から `renderPage(offset: -1|0|1)` 関数を受ける形に変更。`onSwipeLeft / onSwipeRight` も `onPrev / onNext` に改名 (意味の明確化)。呼び出し側 (Month / ThreeDay) は `offset` ごとに `buildMonthCells` / `addDays` で別ページを計算。offset !== 0 のページでは `selectedDay = null`, `onCellClick` / `onEventClick` / `onSlotClick` を no-op に。
- **[整理] useMemo 削除**: `monthCells` / `threeDays` の事前計算 useMemo を廃止 (3 ペーン分必要なため renderPage 内で都度算出に変更、軽量なので問題なし)。
- **[整理] main の overflow**: SwipePane が 3 倍幅なので `overflow-auto` → `overflow-y-auto overflow-x-hidden` に明示変更し、横スクロールが漏れるリスクを潰す。
- **検証**: `npx tsc -b` exit 0 / `npm run build` 1.99s で成功 / dev server (PID 93066, 5173 LISTEN) が HMR 経由で iPhone Safari に自動反映。

### 2026-05-24 - Phase 3.G fix-pack 完了 + Schedule swipe (animated drag + slide-in)

#### 概要

ユーザーテストで発見された 3 件 (リンク遷移ずれ / sticky header z-index 衝突 / iOS auto-zoom) を一括修正し、追加で Calendar (月) / ThreeDay (3日) ビューの左右スワイプによる表示範囲切替を **drag 追従 + commit 時スライドアニメーション付き** で実装。`npm run build` exit 0 / session-verifier PASS。本タスクは clean ブランチ `prototype/phase-3g-fixpack` から main へ PR 経由で merge。

#### 変更点

- **[fix #1] リンク遷移先ハンドラ実装**: `ScheduleScreen` が `useSearchParams` で `?focus=<id>` を受信。対象 ScheduleItem を find → `anchorDate` を `due` に合わせて three view に切替 + `AddEventModal` を draft state でオープン (= ハイライト)。`focusHandledRef` で同 id 二重起動を guard。`MaterialsScreen` も `?open=<note-id>` を受信、`setKind` で notes/daily 自動切替 + editor をスライドイン。EditorView 内 `[[link]]` から note/daily へジャンプ時も `setKind` で list 側を整合
- **[fix #2] modal stacking 整理**: `AddEventModal` に `z-50`、`ConfirmModal` (削除確認) に `z-[60]`、`DayDetailSheet` に `z-30`、`Sidebar` に `z-40` を明示。`ThreeDayView` の sticky 日付ヘッダー (`z-10`) より上に積層されることを保証。main 自身が positioned でないため子要素の z-index が親 stacking context に逃げる問題を、modal 側で正規化
- **[fix #3] iOS Safari ズーム抑止**: `index.html` viewport meta に `maximum-scale=1.0, user-scalable=no, viewport-fit=cover` を追加。input/textarea フォーカス時の auto-zoom と pinch-zoom を同時に抑止。プロトタイプは「想定外ズームなし」体験優先で OK の方針 (fix-pack notes 通り)
- **[feature] Schedule swipe ナビゲーション (animated)**: `ScheduleScreen` 内の `SwipePane` が pointermove で translateX を追従、pointerup で commit (>1/4 幅 OR fast flick <250ms+30px) 時に旧コンテンツを指方向へスライド (220ms ease-out)、新コンテンツを反対側からスライドイン (iOS Calendar 風)。snap-back (閾値未達) も同 transition で 0 へ戻す。axis lock 8px で縦スクロール (ThreeDayView の 14 時間タイムライン) と切り分け、`touch-action: pan-y` で native scroll を保持。click-capture でドラッグ中の誤タップ抑止
- **検証**: 変更ファイル 4 件 (index.html / ScheduleScreen.tsx / MaterialsScreen.tsx / hooks/useSwipe.ts 新規)、`npm run build` 2 度実行で exit 0、379KB (gzip 109KB)。session-verifier 6 Gate PASS (Lint/Tests/Coverage はインフラ不在で skip)
- **次フェーズ**: Phase 3.F PR (🛑 人手 Gate)。Stop hook によるバックグラウンド build 結果は `.claude/comm/outbox/<chat>/stop-report.md` に追記される設計

### 2026-05-24 - ユーザーテストで 3 件の発見事項を記録 (次セッション fix-pack 予定)

#### 概要

Phase 3.A〜F 完了後、スマホ実機での目視確認中に 3 件の挙動問題を発見。修正範囲が広く絡む層も異なるため次セッションで Phase 3.G fix-pack として一括対応する方針を確定し、memory の予定セクションに詳細を記録。

#### 変更点

- **[bug] リンク遷移先ずれ**: Materials Editor の `[[link]]` や CrossSearch 結果行をクリックすると意図したアイテムではなく 5 月の Calendar ビューに着地する。原因は ScheduleScreen が URL query `?focus=<id>` を未実装で、month/day を id から逆引きしていないため。修正方針: ScheduleScreen / MaterialsScreen 双方で `useSearchParams` で受信 → 対象アイテム find → anchorDate を due に合わせて DayDetailSheet 起動 (or note なら Editor 直開き)
- **[bug] ThreeDayView sticky header overlap**: ThreeDayView 上部の sticky 日付ヘッダーが AddEventModal のタイトル領域にオーバーレイし編集しにくい。原因は ThreeDayView の `sticky top-0 z-10` と modal の絶対配置の stacking context 競合。修正方針: AddEventModal を `fixed inset-0 z-50` で独立 stacking context にする
- **[bug] iOS auto-zoom on input focus**: title input / body textarea フォーカスで自動拡大ズーム発生 (font-size < 16px が iOS Safari の trigger)。ユーザー方針「現在のスクリーンは拡大・縮小共にしない」。修正方針: `index.html` viewport meta に `maximum-scale=1, user-scalable=no` + 全 input/textarea font-size >= 16px に統一 (両方併用が安全)
- **[plan] Phase 3.G fix-pack を次セッションスコープに確定**: 上記 3 件 + 残 visual check で見つかる追加項目を一括対応。完了後に Phase 3.F PR (`prototype/mobile-ui` → `refactor/web-first-v2`) 作成 (🛑 人手 Gate) の順序

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
