# MEMORY (chat-main)

## 進行中

### 🔧 Loop Engineering 親計画 Phase 1 + 2（夜間レーン 2 本 + 毎朝 digest）（着手日: 2026-08-04）

**対象**: `.claude/automation/`・`.claude/settings.json`・`.claude/docs/vision/plans/`
**計画書**: `.claude/docs/vision/plans/2026-07-28-loop-engineering-harness.md`

- 前回: **Phase 1 インフラ配置 PR #594 merged**（`3ef1f752`。routine-digest + routine-night-safe + run-routine.ps1 + 台帳 / permissions.ask 二層）。実測補正: CronCreate は**セッション限定 + 7 日期限** → 推奨基盤 = Task Scheduler + `claude -p`（**D-20260804-main-1** 起票済み）
- 現在: **Phase 2 の文書整備 = PR #597 merged**（`5161a9a1`）。Step 9 ゲート（カタログ定着後に裁定）は**ユーザー指示で前倒し・試験運用 0 件のまま着手**し、その事実を Worklog 先頭に記録。① `goals.md` を役割ごと差し替え（Goal 一覧 + 状態機械 → 「今夜どれを選ぶか」の選定基準。一覧は GitHub が正本なので持たない）② `routine-night.md` を `/loop-implement` の薄い殻へ（無人固有の事情のみ・**commit 止まり**）③ 追随 3 か所（`run-routine.ps1` の ValidateSet に `night` / README 状態列 / `routine-morning.md` 退役）。**§7 の「draft PR 止まり」は permissions 実測と食い違っていたので commit 止まりへ訂正**
- 次: **発火の裁定は 2026-08-11 に決着（D-20260804-main-1 = A = Windows タスクスケジューラ + `claude -p`・06:03 / 22:33）** → `run-routine.ps1 -Routine night` を手動 1 回で動作確認 → `schtasks` 登録（手順 = `automation/routine-ids.md`）。**有効化の前提が 1 つ増えた**（PR #619・#618）= repo の `permissions.ask` から `git push*` / `gh pr create*` を外したので、**無人レーンの push 抑止は runner 側 settings で渡す**（`claude -p --settings <無人用>` / `--disallowedTools`）。**後継のいない機能が 1 つ残る** = merge 済みブランチの worktree 掃除（旧・朝ルーチンのみが持っていた。digest に報告として足すかは未決）

### ⏸️ ループカタログ試験運用 + 自律運転の到達点（着手日: 2026-08-06）

**対象**: `.claude/skills/loop-*/`・`.claude/docs/vision/plans/`
**計画書**: `.claude/docs/vision/plans/2026-08-04-loop-catalog-implementation.md`

- 前回: 初期 4 本（triage / implement / verify / postmortem）を配置し **PR #595 merged**（`18da6b5f`）。子計画 Step 1〜5 完了
- 現在: **Step 8 完了** = 到達点の計画書 `2026-08-06-autonomous-operation-endpoint.md` を配置（**PR #596 merged** `1e33b4c2`）。P-001 は**案 B = 据え置きで確定**（D-20260806-main-1・第 2 段の自動 merge は開けない）→ `permissions.ask` に `Bash(gh pr merge*)` 追加 + CLAUDE.md §7.2 に `git-workflow` §0.1.1 非適用を明記。**試験運用（Step 6）は依然 0 件** — 親 Phase 2 はこれを待たずに前倒しした
- 次: 2026-08-06 23:33 JST のクラウド夜間レビュー（`trig_018fECsiaVRLNSCFcoVMDF4q` → Notion「Life Editor Night Review」）を回収し、残る未検証 = `gh auth status` を確定 → 第 1 段（`claude/*` への push + draft PR 作成）の設計を書き直す

### 🔧 worktree 総入れ替え + 次期 fan-out（着手日: 2026-07-29）

**対象**: GitHub Issues（Epic #290 / #321）・`.claude/comm/outbox/`

- 前回: 2026-08-01 の旧 fan-out 巡回完了（open PR 0・判断キュー空）
- 現在: **2026-08-10 /goal バッチ完了** — open Issue 20 件を 8 レーンへ `/goal` プロンプトで分配（briefing-refine worktree 新設）し、同日中に 17 PR が merge。main 取り込み後の一括検証 = 静的ゲート全緑 + 実ブラウザ 9 PASS / FAIL 0（詳細 = history 2026-08-10）。**DDL 0023 適用済み**（#372 の残タスクだった push をユーザーが実行・タグ機能復旧を実測）
- 現在（2026-08-11）: **backlog 一斉棚卸し完了** — #587 / #290 / #512 / #530 / #321 にコメント、#627 本文を実測表（5 → 19 面）へ差し替え、実ブラウザ 5 PASS / 3 BLOCKED / FAIL 0（詳細 = history 2026-08-11）。#707 / #708 を schedule レーンへ起票
- 現在（2026-08-13）: **11 レーンへ /goal を配布済み**（open Issue 20 件をレーン別に分配 — 割り当て表は history 2026-08-13）。#530 は実機検証を完了して **CLOSED**。新規起票 = **#831**（Task → Todo の全面改名・DB は据え置き）/ **#837**（userData フォルダ名）
- 現在（2026-08-13 夕）: **再配布はほぼ不要だった** — レーンは前回の /goal でまだ自走しており、こちらが配る直前に **#838 / #830 / #826 / #827 / #672 / #793 が merge 済み**（06:31〜06:33 に集中）。新規に渡す必要があったのは **#795（briefing）と #708（schedule）の 2 本だけ**で、残りは二重指示になるため取り下げた。`shared-fix` ラベルの 6 件には担当レーンを Issue コメントで明示（#473 = 40 分の二重実装の再発防止）。**#837 は chat-main が自分で実装 → PR #857 open**
- 次: **#831 の着手は「open PR が 0 件」の谷間まで待つ**（3,470 箇所に触るため並行レーンと必ず衝突する。着手条件は Issue にコメント済み）。未着手の実装 Issue はこれで **#795 / #708 の 2 本だけ**になり、残りは Epic 2 件（#716 / #627）と凍結 1 件（#677）。判断キュー 2 件の回答待ちは継続 = `D-20260811-main-1`（#627 の子 Issue 起票）/ `D-20260811-main-2`（#321 の close 可否）

## 直近の完了

- [chat-main] **#837 userData を productName 配下へ（PR #857 open）** ✅（2026-08-13）— `app.getPath("userData")` は `app.getName()` 由来で、`app.getName()` は asar 内 `package.json` の `name`（= `desktop`）を返すため `productName: Life Editor` が効いていなかった。`app.setName` + `app.setPath("userData", <appData>/Life Editor)` を **Store 生成より前**に置く（解決済みパスは初回読み取りでキャッシュされるので、順序そのものが修正の一部）。旧 `%APPDATA%\desktop\config.json` は新側に config が無いときだけ 1 回 copy（move ではない）。実測 = dev 起動で Electron **4 プロセス** + `%APPDATA%\Life Editor\config.json` に旧値そのまま（`theme=system` / `closeToTray=true` / `bounds 2560x1392`）。ゲート = desktop typecheck / electron-vite build / docs-lint すべて exit 0（desktop に lint・test スクリプトは無い）。**known-issue 033 に「worktree ごとに再発する」を追記** — `node_modules` を共有しないためメイン clone を直しても worktree は壊れたままで、今回 win-verify で再発して実機確認が一度空振りした。復旧の近道 = 修復済み clone の `dist/` をコピーして `printf` で `path.txt` を書く
- [chat-main] **#530 Windows 実機 golden path 通過 → CLOSED（docs = PR #836 open）** ✅（2026-08-13）— 08-02 から止まっていた前提 2 つが両方解けた。`desktop/.env` は `web/.env.local` をコピーして配線（値を読まずに済み・`.gitignore:83` で除外）→ renderer に実値が埋まったことを実測（`supabase.co` 39 ヒット / 未置換リテラル 0。08-11 は逆で `undefined` だった）。`build:win` exit 0 → NSIS サイレントインストール → **インストール先から起動してログイン → Todo 追加・編集・削除**（目視 PASS）。Menu / Tray / ウィンドウサイズ復元も目視 PASS（`%APPDATA%\desktop\config.json` への `windowBounds` 書き込みを実測）。**起動判定はプロセス本数（4 本）で行う** — #545 は 1 本だけ立って落ちた。`npm run dev` は**この機械で壊れていた**（`build:win` は緑のまま）ので手動復旧し known-issues 033 に記録。副産物 = userData が `%APPDATA%\desktop` で `productName` と一致しない件を **#837** に起票
- [chat-main] **#700 Step 2 = MCP 検証ツール 3 本（PR #821 open）** ✅（2026-08-13）— 撒き先は `D-20260812-shared-fix-3`（案 A = 検証専用アカウント + RLS 分離）に従う。`seed_verification_state`（日付を指定して task / event / note を作る・`preset: "busy_day"` = 重なった予定 2 本 + 終日 + 完了済み Todo + 未着手 + 日付なし）/ `read_verification_state`（`items_meta` + `<role>_payload` を 1 塊で返す・soft delete も隠さない）/ `cleanup_verification_state`（撒いた行だけ hard delete）。**「何を撒いたかツール側が覚える」= `mcp-server/.verification-ledger.json`**（git 非追跡）に記録し、cleanup は台帳の id しか消さない・失敗した行は台帳に残って再実行で片付く・**アカウント削除は行の削除より後**（`user_id` に `auth.users` への FK が無い）。実運用に混ざらない担保は二重 = RLS（`auth.uid() = user_id`・MCP は anon key + `signInWithPassword` の一般ユーザーで service_role を使わない）+ `LIFE_EDITOR_VERIFICATION_MODE=1` が無いと 3 ツールとも**書く前に throw**。daily は id が日付由来で実データと区別できないため撒けない仕様。規約は `db-conventions.md` §14 に記載。ローカル実測 = mcp-server 12 files/196 tests・shared 217/1980・web 32/269・docs-lint すべて exit 0

## 予定

### 🆕 2026-08-10 /goal バッチの残件（分配済み — chat-main は巡回と判断回収）

- ~~#631 / #633~~ **merged + 実ブラウザ実測 PASS**（2026-08-10。iPhone 目視のみ 👀 節に残す）。~~#592 / #593 / #626 / #573 / #572 / #590 / #591 / #589 / #587 / #588~~ も同日 merge・検証済み
- **#632（FAB 統一）は mobile-refine 担当で着手可能** — #631 着地済み・実測差分（Notes `NotesMobileList.tsx:254` absolute vs Schedule fixed）を Issue コメント済み
- ~~**#628 → #627** の順~~ **#628（= PR #681）は着地済み**。**#627 の子 Issue 起票は `D-20260811-main-1` の裁定待ちで保留**（実測で 5 → 19 面に増え、Settings / Briefing / 作成フォームを含めるかがユーザー判断の域）。棚卸し表は #627 本文が正
- **#707 / #708（2026-08-11 起票・`section:schedule`）**: 変換ダイアログの in-app 化 / 繰り返し削除の Undo で種イベントが戻らない件。#708 は方式 A/B/C の裁定が着手の前提
- **briefing-refine（新設レーン）**: #585 / #623 / #609 を消化中。PR が出たら回収
- **#586 の残り**: PR #649（TimerContext + 2 hooks）が open。**#680**（i18n 取りこぼし 3 点・2026-08-10 起票）は materials レーン宛

### 🧪 #700 検証ハーネス（PR #821 open — 実際に使えるようにするのはユーザー手番）

- **🛑 env 投入 + `.mcp.json` の検証用エントリ追加**: 検証アカウントの値を `LIFE_EDITOR_VERIFY_SUPABASE_EMAIL` / `_PASSWORD` に入れ、`.mcp.json` へ `life-editor-verify` を `${VAR}` 参照のまま追加して `LIFE_EDITOR_VERIFICATION_MODE=1` を渡す（スニペット = `db-conventions.md` §14）。**これが済むまで 3 ツールは常に throw する**（実装レーンは値を知らない前提で書いた）
- 撒いたあとの後片付けは `cleanup_verification_state` が台帳から消すので手作業不要。**アカウントを畳むのは台帳が空になってから**
- 補完関係の Issue = **#701**（UI のボタンを画面操作なしで叩く側 — MCP からは届かないので別建て）

### 📋 Loop Engineering 続き（セッション 3 — 貼り付け用プロンプトは history の各セッションエントリ参照）

- ~~セッション 2: ループカタログ実装~~ **完了**（PR #595 merged `18da6b5f`・2026-08-06）
- ~~親計画 Phase 2 はカタログ試験運用後に判定~~ **前倒しで実施済み**（PR #597・2026-08-06。試験運用 0 件のままユーザー指示で着手）
- セッション 3: **コンテキストコスト削減ハーネス**（`2026-08-04-context-cost-reduction-harness.md`）。**貼り付け用プロンプトは history の 2026-08-06「Loop Engineering Phase 2」エントリが最新**（同日の旧プロンプトは差し替え済み）。到達点 = **Phase 1 計測 + Phase 2 枠づくり + Phase 4 `/loop-prune`**。Phase 3 移送は移行完了まで開けないので、Status は COMPLETED にせず「残は Phase 3 だけ」と分かる形にする。**申し送り = グローバル側（`~/.claude/CLAUDE.md` + `claude-dotfiles/claude/rules/` 11 本 28.8KB・うち 8 本が毎回無条件ロード）が計画書 §4 の調査表に入っていない**。プロジェクト側は CLAUDE.md 18.5KB + rules 3 本 12.6KB
- 自律運転の到達点・第 1 段の設計（`2026-08-06-autonomous-operation-endpoint.md` Step 4）— プロンプトは history の同日エントリ

### 🔧 ハーネス統合の残件（PR #616 merged 2026-08-10・計画書は archive 済み）

- dotfiles **PR sunbreak-pro/claude-dotfiles#14**（Lane G: tone 一本化ほか）の merge — ユーザー手番（P-001）。中身は `~/.claude` にローカル実効済み
- role-engineer の引き継ぎをゲート別 PASS/FAIL の Verdict 形式へ揃える（dotfiles 次 PR — G7/G14 の対の残件）
- Phase D: Scope vs git diff 照合 hook（#173 系・別 PR — 分析 = `docs/reports/2026-08-09-harness-loop-redesign.md`）
- symlink 10 本の実体化 = **Mac セッションの手番**（known-issues 031。skill-lib / agents-lib に git remote があれば Windows へ clone してこちらで実体化する道もある — remote の有無は Mac で確認）

### 📝 #524（2026-08-01 巡回のレビュー検出 → 起票済み・実ブラウザ確認が DoD 先頭）

- **#524 Connect グラフ: 選択中ノードを再クリックしても選択解除できない**（`shared/src/components/Connect/graph/useGraphInteraction.ts:197` — PR #523 merge 済み `8e624422`）。effect の deps が `[size.w, size.h]` だけになり、**リスナーを貼り直す機会がサイズ変更時しかない**。`GraphCanvas.tsx:178` の `onSelect: (id) => onSelectedIdChange(id === selectedId ? null : id)` は毎レンダー作り直される inline クロージャなので、effect が掴んだ古い `selectedId`（初回サイズ確定時 = 通常 `null`）と比較し続ける → トグル判定が常に false。`onActivate` / `onZoom` も同じく凍結する。**#523 が原因というより、`simRef.current` の dep が偶然果たしていた貼り直しが消えて確定的になった**（従来はグラフ再構築のたびに更新されて「たまに効く」状態）。直しは #523 と同じ発想で、コールバックも ref 経由で発火時に読む形。`section:connect` / `type:bug` / `sev:minor` 相当。**未実測**（jsdom にレイアウトが無く canvas 経路はテスト不能・実ブラウザ確認は chat-main）

### 👀 ユーザー実機目視待ち（merge 済み機能・未確認のもの）

> **2026-08-10 に判明: ユーザーは iPhone（Chrome）を実機として使える**。以下の「iOS 実機で」系はこれで測れる。iOS のブラウザは全て WebKit なので、Chrome で見れば描画エンジンとしては Safari と同じ経路

- **#631 の実機分**（PR #635 merged・エミュレーションでは白黒つかない 2 点）: iPhone Chrome で URL バーの出入りを挟んでも本文がボトムタブバーの下へ潜らないこと / 引っ張って更新（pull-to-refresh）が誤爆しないこと
- **#633 の実機分**（PR #637 merged）: Schedule の編集シートの上端がブラウザ UI に隠れず、シート内部がスクロールすること（エミュレーション実測は PASS 済み — max-height 776px / top 68）
- **#512 コマンドパレットの上余白**（`sev:minor` / open）: iPhone でコマンドパレットを開き、**キーボード表示中に上端が safe-area（ノッチ / ステータスバー）へ潜らないか**。Android 実測は上端 inset ≈ 0 で反証にならず宙に浮いていた。踏まないなら NOT_PLANNED close してよい
- **背の高いシート + ソフトキーボード**（#470 / PR #494 merged・mobile-refine から引き取り 2026-07-31）: iOS / Android 実機で、タスク詳細シート（`web/src/tasks/MobileTaskList.tsx` の `max-h-[92vh] / min-h-[70vh]`）のタイトル欄・本文を編集したときにカーソルがキーボードの裏に回らないか。`vh` はレイアウトビューポート基準でキーボード表示に追随しない。**iOS では `dvh` も縮まないので、憶測で差し替えず実測してから**（#471 の mobile notes フル編集も同型・直すなら両方まとめて）
- **code-reduction 実測**（PR #341〜#351 merged・2026-07-25）: #348 = 主要画面に生 i18n キーが出ないこと（実ブラウザ）/ #351 = Analytics チャート・Kanban・Mobile タスクリスト・セグメントコントロールの見た目
- **宣言 AC6**（PR #287 merged・記録 Issue #374）: 朝刊で宣言入力 → Daily「宣言」セクション保存 → 夕刊「今朝の宣言」表示・朝夕セクション非破壊。あわせて write_briefing プロンプトに「昨日の宣言・夕刊への講評」を含める 1 往復の運用実測
- **Notes/Daily エディタ復旧確認**（PR #294 merge 後）: main を pull → Notes アイテムクリックで本文表示 / Daily エディタ表示 / 同一エディタで "/" メニューと "[[" 補完の併用動作（Issue #293 DoD・Console に RangeError なし）
- **W8 カレンダーコア**（#96/#97 merged）: [広幅] 週グリッド時刻配置 / 曜日ヘッダ・今日強調 / 終日レーン / イベントクリック→右ペイン編集→即反映 / 重なり横並び / 週ナビ。[狭幅] 日アジェンダ / 日ナビ / タップ→BottomSheet 編集。**env あり実機**で
- **W4**（#78 merged）: テーマ追従 / 4タブのチャート描画 / Connect グラフ表示・ノードクリック遷移 / backlink。**最重要 = Connect グラフが実データで空でない**こと（env あり実機で・過去 treeshake 誤報前例）
- **Phase 3 Electron**（#79 merged）: `npm run dev` 起動→ログイン→Tasks CRUD / `build:mac` で DMG（実機ゲート）
- **Phase 4 Capacitor**（#88 merged）: iOS Simulator / Android AVD / 実機署名で起動→ログイン→Tasks golden path（Mac ハンドオフ）
- **W3-B**（merged）: Pomodoro 計測→timer_sessions 保存 / phase 遷移 / preset CRUD / TaskSelector
- **W3-C**（#75 merged）: 環境音ミックス再生(Storage URL) / 完了音(onSessionComplete) / AudioContext resume()
- **W1/W2**（merged）: dark/light・font-size・en/ja・リロード復元・shortcut rebind→conflict→reset / Cmd+K・Trash 5カテゴリ restore/permanentDelete
- **W3-0**（merged）: ⌘K パレット / ⌘1-5 section / ⌘, settings / rebind 即反映 / input 中 "n" 非発火
- DU-F Step 7-11 golden path（4 role Tag/Link/backlink + wiki_tag_groups CRUD）/ DU-C-6（Routine 作成/削除/復元 + 月またぎ）

### 🧹 クリーンアップ（ユーザー実行 — `git branch -D` は deny ルール）

- **ローカル merged branch 削除（2026-07-26 棚卸し済み — 16 本全てに MERGED PR を機械確認）**: chore/outbox-shell-refine-reply / chore/tracker-sync-notes-editor-fix / claude/asakan-yukan-theme / claude/briefing-section / claude/docs-orders-retire / claude/docs-workspace / claude/materials-refine / claude/notes-daily-editor-ux / claude/schedule-refine / claude/shell-refine-provider-docs / claude/worktree-policy-327 / docs/root-cleanup-and-stale-record / fix/db-push-workdir / fix/db-url-session-pooler / fix/tiptap-suggestion-plugin-key / fix/walk-ancestors-cycle-guard。`git branch -D <名>` でユーザー実行。**`claude/briefing-evening-patch-fix` のみ PR 無し — 中身確認まで削除しない**（旧記載の feat/w* 系 6 worktree ブランチ群は既に現存せず解消済み）
- **worktree 空フォルダ残骸の削除**（プロセスのロック解放後・再起動後などに）: `rmdir .claude\worktrees\editor-ux .claude\worktrees\materials-refine`（2026-07-25 撤去時に中身ゼロ・git 未登録まで確認済み・入れ物のみ残存）
- **remote merged branch 削除**（任意）: `git push origin --delete <名>`。特に多数の `claude/*` 自動生成ブランチ
- ~~main の未 push tracker commit~~ **解消済み**（2026-08-01 実測）: chat-main から `git push` がそのまま通り、`git status -sb` に ahead 表示なし。pre-push hook の誤ブロックは再現しなかったので、一時 worktree 経由の回避策は不要

### 任意・将来タスク

- loop-engine follow-up（#106 merged 後続）: 実ループ本走（トークン課金ゲート・node_modules 要）/ check.sh の検証対象を frontend(FROZEN)→shared+web に切替（別 PR 候補）/ `stash@{0}`（Orca バックアップ）は不要→drop 可
- デザインシステム follow-up: badge/tabs/tooltip 等を ClaudeDesign へ incremental 追加 / 旧「Design System」project 殻削除は claude.ai UI 操作 / Functional色の notion トークン統一
- **既存テーブルの initplan WARN**（2026-06-11 advisor）: calendars/items_meta/payload 系等に auth_rls_initplan 警告残存 — 原因調査 + 一括 initplan 化 migration
- W4 由来: Analytics ScheduleTab の per-range fetch 化 / データ系列ハードコード色の notion トークン化 / Connect リンク作成・削除 UI
- W3-B 申し送り: undo/redo 結線意図確認 / Skip cadence 非対称裁定 / new-task の create-and-focus lift
- W1 残 Low: `text-white` の accent オン文字トークン化 / `FONT_SIZE_PX` 重複の constants 一元化
- web Phase 2 残: S8 Supabase Realtime（実装済）/ S9 モバイルレスポンシブ
- Perf: M4（useScheduleItemsRoutineSync 一括化）/ M1（note 一覧 content_json 除外）
- **Link UX 強化（Obsidian 風）**: cross-role link / 遅延実体化 stub / クリック遷移（`2026-05-26-link-ux-obsidian-style.md`）
- DU-E Calendar 2 ビュー再実装
- 🔒 **Notes password bcrypt 化** — N>1 化の前ゲート必須（known-issue `027-notes-password-plaintext-debt.md`）
- **Known Issue 025 Fixed 化**（任意）: `prototype/mobile-ui` worktree 状況再確認の上判断
- **Mobile 基準統一 frontend Phase 2/4 は FROZEN**（frontend は Phase 5 破棄予定）
