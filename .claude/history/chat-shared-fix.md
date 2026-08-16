# HISTORY (chat-shared-fix)

### 2026-08-16 - #919 パスワードの変更 / 再設定の導線

#### 概要

パスワードを忘れると、アプリ側から二度と復旧できなかった（2026-08-15 に実際に詰まり、SQL エディタから `auth.users.encrypted_password` を直接書き換えて復旧している）。原因は 2 つで、リカバリーリンクを踏んでもアプリが URL のトークンを一切読まないことと、パスワード変更を呼ぶ実装がどこにも無いこと。両方を塞いで PR #930（open・Closes #919）。全ゲート緑 + `web` の `typecheck:tests` も実行。merge はユーザー手番（P-001）。

#### 変更点

- **`detectSessionInUrl: false` → `true`**（`D-20260816-shared-fix-1` = A）。切り替え前に測ったのは 3 点: アプリ側に URL を解釈する経路が 1 件も無い（React Router なし・`location.hash` / `location.search` / `URLSearchParams` の参照がゼロ）/ Electron は `file://`・Capacitor は `capacitor://localhost` でパラメータが載らない / supabase-js は callback パラメータが載っているときだけ URL を読む（`GoTrueClient._initialize` の `callbackUrlType` ガード）。**実効の影響範囲は公開 Web URL に閉じる**
- **却下した B**（recovery 限定の判定関数）が危ないのは、期限切れリンクが `type` を持たない `#error=…` で来るため。判定関数が偽を返すとそれごと無視され、#919 と同じ「踏んでも無反応」を再生産する
- **忘れた側の導線**: `AuthCard` に「パスワードを忘れた場合」（サインインモードのみ）→ `PasswordResetRequestCard` → メール → `PasswordRecoveryCard`。**リカバリーリンクはユーザーをサインインさせてしまう**ので、セッションの有無だけで判定すると MainScreen に着地して再設定手段が消える。`web/src/App.tsx` が `PASSWORD_RECOVERY` を拾って振り分ける
- **覚えている側の導線**: Settings に `SettingsAccount` カード（ユーザー確定・同 D ファイル末尾）。この画面の他カードと違い即時反映にせず明示的な送信ボタン。アドレスは `getSession()` から 1 回読む（`sectionDescriptors` が props 無しで描くため、1 文字列のために contract を広げない判断）
- **共通化**: `AuthCard` から下地クラス（`authSurface.ts`）・ブランドヘッダ・アラート帯を切り出して 3 枚のカードで共有。確認帯用に `success-subtle` を `danger-subtle` と同じレシピ（不透明・bg-secondary に事前合成）で追加
- **リンク要求の返答はアドレスの有無で変えない**。Supabase 自身が開示しないので、画面が「登録済みアドレス判定機」にならないようにする。テストで文言ごと固定
- **security-reviewer 通過後の追加修正 3 件**（Blocking 0・以下はすべてこのブランチが新しく作った穴）: (1) `PASSWORD_RECOVERY` は 1 度しか飛ばないのにセッションはリロードを生き延びるため、再設定カードで F5 を押すと忘れたままのパスワードでアプリに入れた → 「まだ設定していない」印を sessionStorage に置き、セッションが無いときは印を捨てる (2) supabase-js は成功時に `location.hash` を空代入するだけ・期限切れでは例外を投げるので何も消さない → 読み終わったあと `history.replaceState` で落とす。**空代入が 1 つ新しい履歴エントリを作るので、生トークンを持つ 1 つ前のエントリはページ内から消せない**（消すには PKCE） (3) 連打ガードが `busy`（そのレンダー時点の値）を見ていた → ref へ
- **実装せずキューへ**（`D-20260816-shared-fix-2`〜`-5`）: implicit フローのセッション固定面（PKCE 切替は殻からの要求導線を壊すので設計判断）/ 変更時の再認証（Secure password change は**リカバリー経路も同じ `updatePassword()` を通る**ので、ON にする前に実測しないと「忘れた人が再設定できない」最悪形に戻る）/ 最小長 6→10-12 / 未再設定で離脱したときのサインアウト
- **outbox へ 1 件**: 公開 Web に CSP と `Referrer-Policy` が未設定（#919 の diff 外の既存の穴。URL に一瞬載るトークンが増えたぶん持ち出し先が 1 つ増えた）
- **テスト**: `authScreenRecovery`（忘れた側 2 経路 + 確認欄のタイプミスが Supabase に届かないこと）/ `settingsAccountCard`（`updateUser({ password })` は無条件に成功するのでクライアント側で止まることを固定）/ `appRecoveryGate`（再設定を終える前にアプリ本体へ抜けられないこと 6 件）
- **未確認**: メールを受け取ってリンクを踏む一連の流れ。Supabase ダッシュボード（Redirect URLs 登録 / テンプレート確認 / 実送信）が 🛑 ユーザー手番のため、そこが済むまで通し確認できない

### 2026-08-15 - #880 Save ボタンの白い帯と #874 Mobile パネルの全画面化

#### 概要

Mobile の見た目バグ 2 連。どちらも報告された症状と原因が別の場所にあった。#880 = 「Save ボタンの中に白い線」の正体はボタン自身ではなく**フォーカス枠の色がボタンの地色と同じ**だったこと（PR #909 open）。#874 = 「ボトムパネルの背後が持ち上がる」の正体はパネルではなく**シェルがキーボード検知でタブバーを unmount していた**こと（PR #917 open）。両方 Closes 付き・main から個別分岐・全ゲート緑。merge はユーザー手番（P-001）。

#### 変更点

- **#880 の原因（2 段重ね）**: `FOCUS_RING`（`styleTokens.ts:9`）は ring 色が `lumen-accent` で、accent 地のボタンに当てると**リングがボタンと同化して一回り大きく見える**。その内側に挟まる `ring-offset` の帯が「ボタンの中の線」に見えていた。さらに offset 色は `lumen-bg`（ページ背景）固定なのに、これらのボタンが載る面は `lumen-bg-secondary` / `lumen-bg-subsidebar` — **固定色の隙間は 1 つの面にしか合わせられない**
- **#880 の修正**: `FOCUS_RING_ON_ACCENT` を新設し `outline` + `outline-offset` へ。outline の隙間は**透明**なので実際に背後にある面が出る。色も `lumen-text` にして地色と分離。accent 地の 8 箇所に適用（PomodoroSettings / AudioMixer の重複した Save 2 つ / TodoDetailPanel / EventEditorPane / ItemCreatePanel / ScheduleToolbar / MobileFab / NotePasswordDialog）。`FOCUS_RING` 本体は非 accent の約 40 箇所に波及するため据え置き
- **#880 の silent-fail 検査**: outline 系 3 クラスはリポジトリ初使用のため、known-issues 015（無効な Tailwind クラスは無言で効かない）を踏まないよう**生成 CSS を実測**。`web/dist` に `outline-2` / `outline-offset-2` / `outline-lumen-text` が出力され、`@property --tw-outline-style` の `initial-value: solid` も存在することを確認
- **#874 の原因**: `AppShell.tsx:233` の `{!keyboardOpen && <BottomTabBar/>}`。バーが消えるとその高さが `<main>` に返り、上のものが詰め直される。**パネルは `fixed` で浮いているので何も押していない**
- **#874 の修正（2 つ）**: (1) シェルはバーを unmount せず `invisible` に。箱が残るので何も詰まらず、`visibility:hidden` はタブ順とアクセシビリティツリーから外れるので #608 の意図は保持。`interactive-widget` 既定でレイアウトビューポートが縮まないため場所の無駄もない。**これだけで DoD は全シートについて満たされる**。(2) `BottomSheet` に `fullScreen` を追加し、詳細・編集系 5 箇所に適用（Notes 詳細 / Todos 詳細 / Schedule の todo 詳細・イベント編集 / Schedule 作成）
- **#874 の方針はユーザー確定**（2026-08-15）: 手段 = 「全画面化 + 原因も直す」、対象 = 「詳細・編集系のみ」。短いシート（クイック追加 / Trash 確認 / グラフ設定 / More / ポモドーロ Todo 選択）はシートのまま
- **月シートを外した判断**: #916 が月シートを機能ごと削除する PR のため、`fullScreen` を足せば確実にコンフリクトし、しかも消える予定のブロックへの作業になる。(1) で月シートの持ち上がりは解消するので未修正部分は残らない。#916 見送り時のみ別途起票 = `D-20260815-shared-fix-1`
- **role-qa の指摘反映**: 必須クラス `overflow-hidden` が 6 箇所の `className` に漏れていた → `fullScreen` 側へ移動。スクローラが呼び出し側と部品側で二重 → 呼び出し側 4 つを削除。ヘッダ帯に `shrink-0`（唯一の出口を載せた帯）。`closeOnBackdrop` が全画面では死ぬ旨を型に明記
- **テストの置き所**: `bottomSheetFullScreen.test.tsx` 新規（ジオメトリ / 出口 / スワイプ無効 / 内側スクローラ）、`mobileTodoList.test.tsx` に**配線の固定**を 1 本（`fullScreen` は 1 語なので、外しても部品テストは全部緑のまま通る）、`appShellSoftKeyboard.test.tsx` を「バーが消える」→「箱を残して見えなくなる」に更新。jsdom はスタイルシートを読まないため全部クラス名 assertion で、見た目は実機ゲート
- **未確認**: 両 Issue とも実機目視は未実施（worktree では実ブラウザ検証をしない規約）。#874 は全画面に**しなかった**シートでキーボードの上に残る不可視の帯が新しく生じるため、そこが merge 後の主な確認対象

### 2026-08-14 - #831 機能名 Tasks → Todos の全 docs 展開と、stacked merge 取りこぼしの復旧

#### 概要

前日の 3 PR で「プロダクト語彙なので別判断」として見送った機能名「Tasks」を、ユーザー指示で live docs 全域に展開。その最中に **#862 / #863 が MERGED 表示のまま main に届いていない**ことを検出し、復旧 PR #865（open・Closes #831）にまとめた。

#### 変更点

- **機能名**: `Feature: Tasks (TaskTree)` → `Todos (TodoTree)`。CLAUDE.md §8 Tier 1 一覧も同時（tier-1-core へのリンク元で、片方だけ直すと即矛盾するため）。Status 行に「旧称 Tasks / TaskTree（#831 …）」を残して grep 可能性を維持（docs-consistency §2）
- **全 docs sweep（32 ファイル）**: requirements / design briefs / IA / vision + plans / known-issues / reports / 移行 SSOT / agent 1 / skill 1。docs が名指しするコード記号も現行ツリーに実在するものだけ追随（TodoTree / TodoNode / TodoDetailPanel / PomodoroTodoSelector / MobileTodoList / setTodoStatus / permanentDeleteTodo / todoChip\*）。置換は保護リスト付きスクリプトで実行し、diff を全件目視
- **据え置き**: 退役 Tauri ツリーのパスと `getDescendantTasks` / `countDescendantTasks`（known-issues 016 は削除済みコードの file:line を固定する記録）・`tasks_payload` 系 DB 名と行型・`task` role リテラル（prose の role 列挙含む）・TipTap の `taskList` / **Windows Task Scheduler** / Claude Code の `Task` ツール / plan frontmatter の `Task:` / 日本語の「タスク」
- **stacked merge の取りこぼし（本セッション最大の発見）**: 3 本を数十秒差で連続 merge したため base 張り替えが間に合わず、#862 は PR-A のブランチへ、#863 は PR-B のブランチへ merge された。**MERGED 表示は嘘ではないが main には無い**。実測 = `gh pr view <n> --json baseRefName,mergeCommit` と `git cat-file -e origin/main:<path>`（`web/src/todos/` と `mcp-server/src/handlers/todoHandlers.ts` が不在・`tools.ts` は `list_tasks` のまま）。#831 も既定ブランチ以外への merge のため close していない
- **復旧 PR #865**: PR-C ブランチ先端（A+B+C+docs 2 本）に最新 main を merge。conflict 65 件はすべて「同じ改名が両側に入った」形（merge-base は c257e27a・main の増分は PR-A squash と tracker の 2 commit のみと実測 → 取りこぼしゼロを保証）。全ゲート緑（mcp 19/282・shared 232/2121・web 44/394・desktop typecheck・docs-lint OK）
- **訂正**: 前エントリと旧 PR 本文で domain 語彙の変更元を `search_items` と書いていたが、実在するツール名は `search_all`

### 2026-08-13 - #831 コード上の Task → Todo 統一を stacked 3 PR で実装

#### 概要

画面は既に Todo なのにコードが task のままだった語彙のねじれ（実測 約 3,470 箇所）を、機械置換 3 本で解消。着手条件（Issue コメント「open PR が 0 件になってから」）を `gh pr list --state open` = 0 件で実測してから開始した。PR #861 骨格 / #862 画面 + i18n キー / #863 MCP + docs（#863 に Closes #831）。3 本とも stacked（base は前段のブランチ）で、各 PR 単独で shared / web / mcp / desktop / docs-lint 全ゲート緑。merge はユーザー手番（P-001）。

#### 変更点

- **PR-A #861 骨格**: `types/taskTree.ts` → `todoTree.ts`、`TaskNode` / `NodeType` / `TaskStatus` → `TodoNode` / `TodoNodeType` / `TodoStatus`、context 2 本・`useTaskTree*` 6 本・`SupabaseTasksService` / `taskMapper` / `getDescendantTasks`、`TasksDataService` のメソッド名、SyncDomain `"tasks"` → `"todos"`。参照更新は 145 ファイル（1168 +/-）
- **PR-B #862 画面**: 36 ファイル改名（`web/src/tasks/` ディレクトリごと `todos/` へ）+ i18n キー名。252 ファイル（3035 +/-）
- **PR-C #863 MCP + docs**: 6 ツールを破壊的改名（`list_tasks` → `list_todos` ほか）+ `search_items` の domain 語彙と戻り値キー。docs は CLAUDE.md §3.2 / §4・rules/frontend.md・db-conventions.md、加えて tier-1-core の MCP Coverage 行（放置すると存在しないツール名が残るため）
- **据え置きの実測**: `generateId("task")` / `role: "task"` / DB 名（`tasks_payload` / `task_type` / `task_id` とその TS 名）は不変。各 PR 本文に grep 出力を貼付。加えて lumen デザイントークン・TipTap の `taskList` / `taskItem` / `toggleTaskList()`・localStorage に保存されるショートカット id（`nav:tasks` / `global:new-task`）も据え置き
- **表示文字列の不変を機械証明**: i18n の葉の値を改名前後で集合比較 → 差分は各 catalog 1 件のみで、それも補間変数名（`{{task}}` → `{{todo}}`、コード側と同時改名）。レンダリング結果は不変
- **型で捕まらない罠 2 種**: `Record<ItemRole, …>` 系のキーは `items_meta.role` そのものなので `task` 据え置き（`itemRole.task` の i18n キーも同様）。うち `itemLinkSuggestion` / `useShellNavigation` / mcp の `ROLE_PAYLOAD_TABLE` は `Record<string, …>` で **改名しても build が通ってしまう** — 手検査で発見（mcp 側の 1 件は verification suite が実行時に検出）
- **見送り**: CLAUDE.md §8 Tier マップと tier-1-core 本文の機能名「Tasks」（プロダクト語彙のため別判断）。archive / history / memory / decisions / comm は `rules/records.md` に従い書き換えない

### 2026-08-13 - #838 セッション永続の storage 差し替え + #827 ダークスクロールバー

#### 概要

shared-fix 2 連。#838 = 同じ端末で毎回ログインし直しになる問題を、Supabase auth の保存先をプラットフォーム別に差し替えて解消（PR #847・書いた時点で open）。#827 = ダークテーマでスクロールバーだけ白い問題を `color-scheme` + `scrollbar-color` で解消（PR #850・同 open）。どちらも Closes 付き・main から個別分岐・全ゲート緑（shared / web 各 lint+test+build、#838 は desktop typecheck+build も。desktop は本 worktree 初 install）。merge はユーザー手番（P-001）。

#### 変更点

- **#838 shared**: `services/supabaseAuthStorage.ts` 新設 = プラットフォーム判定の一元点（DoD）。Electron → preload の `window.desktop.authStorage` ブリッジ / native mobile → `window.Capacitor.Plugins.Preferences`（runtime global 経由 — shared に `@capacitor/*` import を入れない不変式を維持）/ web → localStorage 既定。ブリッジ不在時は従来挙動へフォールバック。resolver テスト 5 件
- **#838 desktop**: `authStorage:*` IPC 3 本 + electron-store 保存。`safeStorage` で OS キーチェーン暗号化（refresh token を平文 localStorage に置かない — file:// 起因の消失と保管場所の両方を解決。app:// 配信案との比較理由は `setupAuthStorageIpc` のコメントに記録 = DoD）。暗号化不可環境は `plain:` マーカーで劣化動作
- **#838 mobile**: `@capacitor/preferences@^8` を依存追加（lock 再生成は `--package-lock-only`）
- **#827**: `tokens.css` に `color-scheme: light/dark`（テーマ属性スコープ・ThemePreviewCard の入れ子 light も考慮）+ `:root` の `scrollbar-color: var(--color-border-strong) transparent`（継承でアプリ全域・トークン経由でハードコード無し）。jsdom はスクロールバーを描けないため宣言のピン留めテストで回帰を防止
- **申し送り**: 実測系 DoD（パッケージ版 Electron 再起動 / モバイル殻再起動 / ダークテーマ目視）は merge 後 chat-main 実測 — 両 PR 本文に記載済み

