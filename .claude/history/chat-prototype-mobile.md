# HISTORY (chat-prototype-mobile)

### 2026-06-06 - Esc 重複リスナー修正 + origin/main ベースへブランチ移行 (PR #48)

#### 概要

並行チャットからの「frontend を触る予定はあるか／PR を作って競合回避したい」という確認に答える過程で、PR #45・#46 の squash マージにより prototype 実装（Pomodoro/Materials/5-role）は**既に main へ全取込済み**と判明（新規 PR 不要）。ローカルブランチ prototype/pomodoro-multitimer は squash 前の重複コミットを抱え main と履歴乖離していたため、origin/main 最新ベースの新ブランチへ移行。その過程で main 側 ScheduleScreen に紛れ込んでいた Esc クローズ useEffect の二重登録を発見・修正し PR #48 として提出。frontend は不触で並行 Mobile 統一作業と競合しない。

#### 変更点

- **[調査] マージ状態の確定**: `git cherry` / `git diff 2820ffd origin/main` / コミット時刻比較（65d4172 17:36 → PR #46 merge 17:47）で、prototype 実装が PR #46 squash に全て含まれることを確認。`origin/main` に `ROLE_OPTIONS` 存在も確認。残差分は main 先行の9行（= 重複 Esc useEffect）と web-first 移行（shared/supabase/web、別チャット分）のみ
- **[fix] Esc 重複リスナー削除 (`ScheduleScreen.tsx::AddEventModal`)**: 完全同一の「Escape で onClose」keydown useEffect が2つ登録されていた（リスナー二重登録 → Esc 1回で onClose 2回）。2つ目を削除（−9行）
- **[chore] ブランチ移行**: 陳腐化した prototype/pomodoro-multitimer から `prototype/fix-schedule-esc-duplicate`（origin/main 最新ベース）へ。worktree の `.claude/comm/.session-branch` も更新（worktree policy proactive 宣言）。push 時は upstream を新ブランチへ貼り直し（main 直 push 防止）
- **検証**: `npx tsc -b --force` exit 0 / `npx vite build` exit 0（≈432 kB / gzip ≈125 kB）。リスナーが1つになったことを grep で確認

### 2026-06-06 - C-3: add item を 5 role 選択化（セレクタのみ）

#### 概要

Schedule の add-item ダイアログの「タイプ」3択（task/event/birthday）を、items_meta の 5 role（task/event/routine/note/daily、CLAUDE.md §4.3）の選択 UI へ拡張。今回はユーザー判断で「セレクタのみ 5 role 化」にスコープを限定（作成後の一覧描画は対象外＝選択 UI の体験確認が目的）。role に応じてダイアログ内フォームを出し分け、Schedule に描画導線を持たない routine/note/daily は保存時にモック確定（トースト通知）で扱う。現ブランチ prototype/pomodoro-multitimer で実装。tsc -b + vite build green、session-verifier PASS。実機目視待ち。

#### 変更点

- **[feat] ItemRole 型追加 (`lib/types.ts`)**: `ItemRole = "task" | "event" | "routine" | "note" | "daily"` を新設（CLAUDE.md §4.3 の items_meta 5 role に対応）
- **[feat] 5 role セレクタ (`ScheduleScreen.tsx::AddEventModal`)**: 「タイプ」3択を「種類」5択（`ROLE_OPTIONS` 駆動の 5 列グリッド、`role=radiogroup`/`radio`、`min-h-[44px]` の a11y タップ領域）に置換。`EditDraft` に `role` / `recurrence` を追加、`emptyDraft`/`draftFromItem` に既定値を設定（編集時は `roleFromType` で type→role 逆引き）
- **[feat] role 別フォーム出し分け**: routine=「繰り返し」(毎日/毎週/毎月) + 開始日 + 時刻、note=日付/時刻を隠し「本文」中心、daily=日付(必須)+「本文」・時刻なし、task/event=従来。ヘッダタイトルも `${role}の追加` に追従。role 切替時に時刻を持たない role では time/endTime をクリア
- **[feat] モック確定トースト (`ScheduleScreen` 本体)**: 新規 routine/note/daily の保存は schedule item を作らず `roleToast`（`role=status`/`aria-live`、2.2s 自動消滅）で「（モック）◯◯を作成しました」を通知。task/event は従来通り `addScheduleItem`
- **[fix] birthday 編集の保存可否**: 編集時 birthday は `roleFromType` で role=event に逆引きされるが、`eventTimeMissing` に `!isBirthday` を加え時刻必須の誤発火を予防。birthday は creation セレクタから除外し event+tag の既存仕様へ一本化（既存 birthday の編集は従来通り）
- **検証**: `npx tsc -b --force` exit 0 / `npx vite build` exit 0 (≈432 kB / gzip ≈125 kB)。`prettier --write` 準拠。session-verifier 全ゲート PASS（lint/test はプロトタイプに機構なしで skip）

### 2026-06-06 - Materials エディタ刷新: 白紙キャンバス化 + 左端 + ハンドルのフォーマットツール

#### 概要

Materials の Note/Daily エディタ本体を Notion/Obsidian 風に再設計。(1) 本文の枠線・暗色背景・等幅フォント・タイトル下線を撤去し地のページに溶け込む「白紙キャンバス」化 (サンセリフ・最低1画面分を占める全面自動拡張・余白タップで末尾にカーソル)。(2) フォーマットツールの方式を 3 段階で試行: 当初のキーボード追従 bottom バー → カーソル行追従ポップアップ (可視性が悪く失敗) → 最終的に「左端の + ハンドル」方式に確定。普段は現在のカーソル行の左端に小さな + のみ表示し、タップで初めてツールバーが開く。改行・別行タップ・フォーカス喪失で自動クローズ。tsc -b + vite build green、session-verifier PASS、実機で + の判定 OK 済み。

#### 変更点

- **[refactor] 本文白紙キャンバス化 (`EditorView`)**: textarea から border/`C.crust` 背景/`font-mono`/固定 rows/resize を撤去、サンセリフ化、タイトル下線も撤去。エディタを「メタヘッダ(タイトル/気分/タグ) / 本文キャンバス / フッタ(リンク/バックリンク)」の3段に再構成。本文ラッパに `flex: 1 0 auto` を与え最低1画面分を占有、余白 onClick で末尾にカーソル
- **[feat] textarea 自動拡張**: `useLayoutEffect([bodyDraft])` で `height=auto→scrollHeight` 追従、内部スクロールを殺し外側のみスクロール。本文左に gutter (`pl-8`) 確保
- **[feat] 左端 + ハンドル (`EditorFormatPopup`、旧 `KeyboardAccessoryBar` を改名)**: フォーカス中のみ現在カーソル行の左端に小さな + を表示し行へ縦追従 (`top: handleTop - 3` で視覚中心補正)。タップで `toolbarOpen` をトグルしツールバーを開閉
- **[feat] カーソル位置の実測 (`measureCaretLine` / `caretLineIndex`)**: textarea に座標 API が無いため、同 font/padding/width の不可視ミラー div に本文を流し込みマーカー span の offsetTop でカーソル行 Y を実測。行番号も算出
- **[feat] 自動クローズ条件**: 開いた行と異なる行へ移動 (改行/別箇所タップ) / blur で toolbar・command menu を畳む。再フォーカス時に勝手に開かないよう状態リセット。`/` ショートカットは toolbar+menu を開く形へ変更
- **[refactor] ツールバー配置をスクロールコンテナ内 absolute へ**: 旧 visualViewport bottom 追従ロジックを撤去し本文と同じ器に置いて自然スクロール追従。`pos` はポップアップ高さ実測で above/below フリップ
- **検証**: `npx tsc -b --force` exit 0 / `npm run build` exit 0 (≈430 kB / gzip ≈124 kB)。`prettier --check` 準拠。session-verifier 全ゲート PASS (lint/test はプロトタイプに機構なしで skip)

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
