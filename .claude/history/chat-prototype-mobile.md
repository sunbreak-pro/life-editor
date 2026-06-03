# HISTORY (chat-prototype-mobile)

### 2026-06-03 - Pomodoro 強化: タイマー実時刻化＋セクション間継続 / Settings 再設計＋横断 a11y / HISTORY 改善 / マルチタイマー

#### 概要

prototype モバイル UI の Work(Pomodoro) を中心に4波の機能追加。(1) Settings をデスクトップ風のサイドバー8カテゴリ切替へ再設計し、全画面横断の a11y を底上げ。(2) タイマーを `setInterval` デクリメントから `endTime` 絶対時刻ベースへ作り替え、状態をモジュール singleton (`timerEngine`) に持ち上げてセクション間移動でも継続・バックグラウンド復帰追従。(3) HISTORY を共有コンポーネント化しスワイプ削除・セッション別メモ閲覧/編集を追加、Schedule にも History ビューを追加。(4) タスク別の並行ポモドーロ(最大3)を実装。tsc --noEmit + vite build いずれも green。session-verifier PASS。

#### 変更点

- **Settings 再設計 (`SettingsScreen.tsx` 全面書換)**: 左ドロワーの8カテゴリ (一般/アカウント/表示/アクセシビリティ★新設/通知/同期とバックアップ/プライバシー/アプリについて) 切替。新規設定は「見た目だけ動く」ローカル state (リロードでリセット)。プリミティブ群に a11y 内蔵 (`role=switch`/`radiogroup`/`aria-valuetext`/`aria-live`/`dialog`+Esc/`aria-current`)
- **横断 a11y (新規 `useDismissOnEscape` フック)**: Drawer/BottomSheet/SearchOverlay に Esc クローズ + `role=dialog`/`aria-modal`。AppHeader のボタンを 44px タップ領域へ。Materials/Schedule/Work/Trash のタブ・チップ・スライダー・各モーダルに role/aria。AddEventModal は IME ガード付き Esc
- **タイマー実時刻化 (`WorkScreen.tsx` TimerTab → 新規 `lib/timerEngine.ts` + `hooks/useTimer.ts`)**: 残り時間を常に `endTime - now` で算出。`setInterval` 間引き/端末ロックに耐え、`visibilitychange` で即追従。状態をモジュール singleton 化しセクション間移動で停止しない問題を解消。`useSyncExternalStore` 購読で remainingSec を読む TimerTab だけ毎秒再描画。pause が実質リセットされるバグ・skip 経過秒の不正確さも修正。プリセット/セッション種別切替を稼働中は確認ダイアログ化
- **HISTORY 改善 (新規 `components/SessionHistoryList.tsx`)**: 日付グループ + 左スワイプ削除 (ソフトデリート・Trash 復元可) + セッション別メモ。`TimerSession.comment` 追加、`mockStore.updateTimerSession` 新設。Timer 画面に常時メモ欄 (WORK 時、`draftComment`) を置き完了時にセッションへ保存、HISTORY 行のメモアイコンから閲覧/編集 (BottomSheet)。Schedule の表示切替に History を追加 (grid-cols-4) し同コンポーネントを共有
- **マルチタイマー (`timerEngine.ts` 拡張)**: WORK タイマーをタスク別に最大3並行保持 (`heldTimers[]`、アクティブ含め計3)。tick がアクティブ＋全 held を進め、held 完了は自動ログ。タスク切替時にアクティブが進行中(稼働 or PAUSE)なら保持/破棄/キャンセルの3択ダイアログ (`TaskSwitchModal`)、3つ超は拒否。サイドバーに「進行中タイマー (n/3)」セクション (現在＋held、タップで切替)。`hasStarted` を state へ昇格しプリセット確認も PAUSE 中に表示。セッション種別 (WORK/BREAK/LONG) 切替は現状維持
- **検証**: `npx tsc --noEmit` exit 0 / `npm run build` exit 0 (≈428 kB / gzip ≈123.6 kB)。session-verifier 全ゲート PASS (lint/test はプロトタイプに機構なしで skip)。`canHoldActive` の不要 export 除去

### 2026-05-31 - モバイル共通 Shell 化 + 横断検索強化 + ドラッグ BottomSheet + main マージ

#### 概要

モバイルプロトタイプ全 6 セクションに「不変の共通 Header + セクション別 Sidebar」を導入し、横断検索を Header に集約。さらに横断検索のモーダル化・フィルタ拡張・全ボトムシートのドラッグ可能化と表示バグ修正を実施。最後に origin/main を取り込みマージ衝突を解決。PR #40 (MERGEABLE/CLEAN)。

#### 変更点

- **共通 Shell (新規)**: `AppShell`(Router 外側 Layout で Header 不変) / `AppHeader` / `BottomTabBar` / `Drawer`(セクション別 Sidebar) / `SearchOverlay` + `CrossSearchBody`(横断検索) / `BottomSheet`(ドラッグ) / `ShellContext` / `lib/theme`(配色一元化、旧 `const C` x7 を撤去)
- **6 画面リファクタ**: App.tsx をレイアウトルート化。各画面から独自 Header/BottomTabBar/`const C` を撤去、固有操作は sub-toolbar へ、全画面に Drawer Sidebar
- **横断検索**: 空入力時は候補非表示 / フィルタを Tasks・Events・Notes・Daily＋Tags に拡張 (誕生日・祝日は Events 内包) / モーダル化 (背景透け) / Schedule・Materials のローカル検索撤去 (ピッカー内検索は維持)
- **ドラッグ BottomSheet**: 全セクションの 13 シートを共通化 (ハンドルドラッグ・半分↔全画面スナップ・下スワイプで閉じる)。旧 `BottomSheetShell` 廃止
- **表示バグ修正**: Schedule/Work でシート変換時に残った stray `)` 除去 / Calendar 月グリッドを `gridTemplateRows` でページ高さ均等割り (trailing 余白・最終週の潰れ解消)
- **QA**: 独立コンテキストで 2 回監査、条件付き PASS。検出 Major (Trash ConfirmModal z-index / Materials menu sheet 閉アニメ) は修正済
- **マージ**: origin/main 取り込み。ScheduleScreen + memory/history INDEX.md の衝突を shell 構造維持しつつ意味的に解決し、du-g の Notes/Daily 統合・automation 等を取り込み。commit `566a648`(feature) + `fbb35ef`(merge)
- **計画書**: `2026-05-30-mobile-ia-v3-shell-implementation.md` (追補節含む) → archive へ

### 2026-05-30 - fix-pack: M-1 card layout 見た目調整 (SwipeRow rounded + transparent)

#### 概要

session-verifier (PASS) 後の小さな見た目修正。M-1 で導入した `SwipeRow` が layout=card のとき外側矩形に `C.crust` 暗色が見えて gap-3 隙間に違和感が出ていた問題を解消。SwipeRow に `layout` prop を追加し、card 時のみ `rounded-2xl` + `background: transparent` に切替 (row 時は従来通り `C.crust` 矩形)。NoteCard 自身の rounded-2xl と二重になるが、外側 overflow-hidden で内側ボタン群を角丸にクリッピング。

#### 変更点

- **[fix] SwipeRow に `layout: Layout` prop 追加** (`prototype/src/screens/MaterialsScreen.tsx`)
- **[fix] layout=card 時の見た目切替**: 外側 div に `rounded-2xl` クラス + `background: transparent`
- **[fix] NoteList の wrap 関数で layout を SwipeRow に伝播**
- **検証**: `npx tsc --noEmit` exit 0 / `npm run build` 396.60 kB / gzip 114.55 kB (M-1 比 ~0 kB)

### 2026-05-30 - C-2: Calendar フィルタ (タイプ) + 並び順切替 (iOS additions)

#### 概要

iOS additions 要件 C-2 を prototype 環境で実装。Schedule 画面の左 Sidebar (G-3 Drawer 相当) Filter パネルに「タイプ」「並び順 (DayFlow)」セクションを追加。タイプは ScheduleItem の 4 type (event/task/birthday/holiday) を多選択でフィルタ。並び順は DayFlow 側 (listGroups) で `time/updatedAt/title` の 3 種を radio 選択。Calendar (itemsByDay) は時刻順固定 (AC2 準拠)。

#### 変更点

- **[feat] filterTypes state**: `ScheduleItemType[]`。空配列 = 全 ON (デフォルト)
- **[feat] sortKey state**: `"time" | "updatedAt" | "title"`、デフォルト `"time"`
- **[feat] filtered ロジック拡張**: filterTypes 絞り込みを追加
- **[feat] buildListGroups の sortKey 対応**: `pickSortFn` helper でソート関数を切替、noDue グループは time のとき updatedAt fallback
- **[feat] Sidebar 拡張**:
  - 「タイプ」セクション: 4 type の多選択チェックリスト (sky/green/peach/red のカラードット + 日本語ラベル + aria-pressed)
  - 「並び順 (DayFlow)」セクション: 3 sortKey の radio (mauve dot + aria-checked)
- **[ux] AC3 対応**: タグセクションは `wikiTags.length > 0` のときのみ表示 (Optional Provider 相当の null ガード)
- **[note] role 範囲**: 要件本文は 5 role (Event/Task/Routine/Note/Daily) 想定だが prototype ScheduleItem は 4 type (Routine/Note/Daily 統合は本番 items_meta 後の話) のため 4 type で代替実装。本番側で 5 role に拡張する想定
- **検証**: `npx tsc --noEmit` exit 0 / `npm run build` 396.54 kB / gzip 114.51 kB (+1.8 kB / +0.7 kB)

#### Acceptance Criteria 達成

- [x] AC1: 多選択タイプフィルタで Calendar (itemsByDay) と DayFlow (listGroups) が追従 (prototype 4 type 範囲)
- [x] AC2: 並び順切替で DayFlow の並びが変わる、Calendar は compareTime 固定
- [x] AC3: WikiTag フィルタは wikiTags 空時に UI 非表示 (Mobile Optional Provider 相当)

### 2026-05-30 - M-3: 空行ヒント + `/` キーバインド + IME ガード (iOS additions)

#### 概要

M-2 と同じ KeyboardAccessoryBar 基盤に、現在行が空でフォーカス + 非 IME のときだけ「/ コマンドを挿入」ヒントチップをバー上にフロート表示。チップタップ or textarea で `/` 入力するとスラッシュコマンドメニュー (M-2) が起動する。IME 変換中はヒントも `/` 起動も抑止 (CLAUDE.md §6.6 IME 規約準拠)。

#### 変更点

- **[feat] 現在行空判定** (`lineEmpty` state): selectionchange + bodyDraft の変化で再計算。`textarea.selectionStart === selectionEnd` かつ現在行 `trim() === ""` のときのみ true。document.activeElement で focus を二重確認
- **[feat] IME 状態管理** (`composing` state): textareaRef に `compositionstart` / `compositionend` listener を取り付け
- **[feat] `/` キーバインド**: textarea keydown を listen し、`e.key === "/"` かつ `!e.isComposing` かつ空行 + 単一カーソル時に `e.preventDefault()` + `setCommandOpen(true)`。/ 入力自体は消費される
- **[feat] hint chip**: バーの上 (`commandOpen` ポップオーバーと同じ位置) に半透明 + mauve border の「/ コマンドを挿入」ピル。`focused && !composing && lineEmpty && !commandOpen` のときのみ可視。タップで setCommandOpen(true)
- **[a11y] `aria-label="スラッシュコマンドを開く"`**
- **検証**: `npx tsc --noEmit` exit 0 / `npm run build` 394.73 kB / gzip 113.80 kB (+2 kB / +0.5 kB)

#### Acceptance Criteria 達成

- [x] AC1: 空行にフォーカスがあるときのみヒント表示
- [x] AC2: ヒントタップ または `/` 入力でメニュー起動
- [x] AC3: IME 変換中はヒント非表示 + `/` 起動抑止 (composing state + `e.isComposing` 二重ガード)
