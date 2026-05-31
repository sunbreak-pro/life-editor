# HISTORY (chat-prototype-mobile)

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
