# HISTORY (chat-main)

### 2026-08-31 - ユーザー実機フィードバック 11 項目を Issue 14 本（#1362〜#1375）へ起票

#### 概要

ユーザーから実機で気づいた UI/UX の要望 11 項目をまとめて受け、起票前に 5 点を確認したうえで #1362〜#1375 の 14 本として起票した。要件のうち 2 項目は 1 Issue に収まらないため分割し、追加でもらった「アプリから Claude を起動する入口」は #1211 で実装済みと実測したため起票しなかった。

#### 変更点

- **起票 14 本**: #1362（週 / 日ビューの now-line から時刻ラベルを外す）/ #1363（テンプレート編集パネルを通常 Note と同等の広さへ・#1180 follow-up）/ #1364（Note rightSidebar フィルタの選択繰り上げ廃止）/ #1365（Note アイテム上部のタグ表示整理 + アイコン反映）/ #1366（タグアイコン +30）/ #1367（今日の流れの Todo 行をチェックボックス式へ）/ #1368（チェックボックス全面統一 + 朝刊の桁ズレ）/ #1369（朝刊の Todo 行に時間帯）/ #1370（追加パネルを 2 タブへ）/ #1371（Todo 追加ボタンの二重プラス）/ #1372（Notes 初期画面中央の追加ボタン削除）/ #1373（Event の完了概念を廃止）/ #1374（予定リマインダー）/ #1375（Work 実績のタグ別記録）
- **1:1 にしなかった 2 項目**: 要件 3 は「フィルタの挙動」と「タグ表示 + アイコン」で触る場所が違うので #1364 / #1365 に分割。要件 11 は「Event の完了概念を消す」だけでは予定の状態が分からなくなるため、ユーザー回答に沿って #1374（リマインダー = **OS 通知あり**）と #1375（Work 実績を予定側に残し、タグ別稼働時間 / 使用回数を Schedule・Todo と紐づける）を対で起票
- **起票前のユーザー裁定 5 点**: (1) Event は完了概念ごと廃止（ピルのクリックが完了トグルを兼ねていたため、消すと完了操作も消える点を提示したうえで）(2)「Materials の Todo リスト」= Note 本文のチェックリスト（Todos は #1153 で Schedule 側へ移設済みのため実体を確認）(3) タグアイコンは +30（合計 55〜60）(4) タグ表示の具体形は実装一任 (5) 追加パネルの Note タブは畳むが、ノート紐付けは予定・Todo タブの中へ残す
- **重複チェックの収穫**: #1365 は #1291「タグアイコンを全 UI に反映」の取りこぼし、#1363 は #1180「中央パネルで編集」の詰め残りと判明したので、それぞれ本文に旧番号を参照として書いた。#1366 の本文には **`import { icons }` へ戻さない**制約（#1114 / PR #1112 の実測 = eager チャンク −28.0%）を制約節として明記
- **起票しなかった 1 件**: 追加要望「アプリから Claude を起動する入口（ターミナルを開いて `claude` を撃つ）」は #1211 で実装済み。`desktop/src/main/claudeLauncher.ts` + `claude:launch` IPC + `SidebarNav.tsx:197-202` のフッター常設行 + Settings の AI 連携カードを実測し、今朝 `07a1da97` で main に着地していることを確認した（D-20260831-settings-1 の裁定どおり素の `claude` を Settings のパス欄で起動する形）。**ただし docs が追随していない** — 計画書 `2026-08-29-claude-launcher-desktop.md` の Status が IN PROGRESS のまま、CLAUDE.md §5 も「#1211 で再設計中」のまま

### 2026-08-31 - `[main]` 宛 4 件のレーン移譲 + #1345 起票 + 5 レーンへの /goal 配布（45m 巡回 1〜2 回目）

#### 概要

45m 巡回の 1 回目で #1300（Windows 配布パッケージ化）の自前実装に着手しかけたところ、ユーザー指示で「chat-main が抱えず配る」へ方針転換した。`[main]` 宛 4 件の宛先を振り直し、未起票だった 1 件を起票し、5 レーンへ `/goal` を組み立てて渡した。2 回目の巡回で実装 PR が 3 本 open になっていることを確認した。

#### 変更点

- **巡回の実測（1 回目 → 2 回目）**: open PR 0 → 4（#1346 / #1347 / #1348 + tracker #1349）・新規 merge 0・main は origin と同期・outbox の起票依頼は 8/30 以降追加なし・未回答の判断キューは D-20260830-main-1 の 1 件のみ（**ユーザーが「とりあえず放置」と裁定** → 計画書どおり両アーキをビルドし、受け入れは arm64 のみに留める）
- **方針転換の後始末**: #1300 用の worktree は `git worktree add` がブランチ名重複で失敗して実体が未作成だったため後始末不要（`claude/main-desktop-packaging-1300` は 8/30 の計画書 PR #1302 で使った既存ブランチ）
- **宛先の振り直し 4 件**: #1300 / #1301 → `[refactor-core]`（`.github/workflows` と `desktop/` を触った実績が #894 の IPC contract 整備しか無いことを `git log -- <path>` で実測）/ #1211 → `[settings]`（段階 1 の #1210 が PR #1307 で CLOSED = BLOCKED 解除を確認）/ #1337 → `[tags-docs]`。#1300 / #1301 / #1337 には **`shared-fix` ラベルを追加** — section ラベルを持たない横断タスクは、これが無いとどのレーンのクエリにも乗らない
- **起票 1 件**: **#1345**（`section:materials` / `type:task` / `sev:minor`）= ノート削除だけ確認ダイアログが無い。同じ `web/src/notes/NotesView.tsx` の中でテンプレート削除（`:457`）は `askConfirm` を通るのに、ノート削除（`:543` の `onDeleteNote` / `:605` の `onDelete`）は素通りする。方針はユーザー裁定で「確認を挟む側へ揃える」。重複チェック済み（#1248 はテンプレート削除の件で CLOSED・別物）
- **`/goal` 配布 5 レーン**: refactor-core（#1300 / #1301 / #1336）/ tags-docs（#1342 / #1337）/ schedule-refine（#1343）/ materials-refine（#1345）/ settings-refine（#1211）。#1301 は Mac 実機受け入れが残るので PR までで止める旨、#1300 は「`workflow_dispatch` は default branch に載るまで起動できない」制約を PR 本文へ書く旨を条件に入れた
- **chat-main 手番の残り**: **#1335 のみ**（夜間ルーチンの Task Scheduler 登録 = このマシンの OS 操作なのでレーンから実行できない。ただし 2026-08-30 に「今はやらず Issue 化して可視化」とユーザー裁定済みで、着手はその裁定を覆す判断が要る）

#### 巡回 3〜8 回目（同日夕）

- **merge が 7 回連続ゼロ**で open PR 13 本が滞留（全部 CLEAN・CI 赤 0・コンフリクト 0）。レーン側は配布分 8 件を全部 PR に到達させ、#1357（#1211）で打ち止め
- **merge 順の注意を 2 つ実測**: ⚠️ #1350 は base が `claude/desktop-packaging-win-1300` の **stacked PR** で、#1348 と近接 merge すると「MERGED 表示のまま main に届かない」型（memory の既知の罠）を踏む → #1348 → base の自動 retarget を待つ → #1350 の順。⚠️ #1357 は `shared/src/index.ts` / `shared/src/i18n/locales/{en,ja}.json` / `.claude/CLAUDE.md` で #1346 / #1347 / #1352 と重なる 25 ファイルの大物 → **最後に回すと衝突解決が 1 本で済む**（先に入れると小さい 3 本がやり直しになる）
- **Epic #716 の DoD 突き合わせ → PR #1358**: 表の**挙動記述と実装の食い違いはゼロ**で、腐っていたのは file:line 参照。`CalendarTab.tsx` の分割で #4 行の引用 4 本（`:2022` / `:2262` / `:2244` / `:2220`）が**ファイル長 1271 行を超えて死んでいた**。行き先 = 分岐は `:1182`、詳細シートは `ScheduleOverlayHost.tsx:175-190`（#889 で Desktop overlay と統合）、FAB は `ScheduleOverlays.tsx:278`、完了トグルは `AgendaList.tsx:257`。ほか `sections.ts` / `AppShell.tsx` / `SettingsScreen.tsx` / `useShellNavigation.ts` の行ズレを修正し、#14 に「AI 連携カード（#1210）は `isWide` ガードを持たないので narrow でも出る」を追記
- **Epic #1121 の DoD 実測**: i18n = `tour` 配下 33 キーが en / ja 完全一致（欠落 0）/ 守りのテスト 8 本 + CI 緑 / やり直し（Settings の導線は常に概要モーダルから）と全体通しの中断（Escape で `stepId` が保存される）は動く。**「つながり / 集中 / 分析」が disabled + 準備中バッジなのは Epic 本文が初回スコープ外と明記した設計どおりで、判断は不要だった**（memory の「許容するか決める」は Epic を読み直せば決着済み）
- **#1359 起票**: セクション単位で始めたツアー（`startSection` 経路）だけ、Escape で吹き出しが閉じても `life-editor-tour-progress` が書き換わらない。全体通しでは保存される。2 回再現。`stopAt`（`TourContext.tsx:376-388`）は partial でも persist するので `stopAt` 自体に到達していない疑い。**#1342 / PR #1346 が `useDialogA11y.ts` を触るので merge 後に再実測してから直す** gate 付き
- **測定ミスの訂正**: 途中で Escape の検証に `[role="tooltip"], [data-tour-popover]` を使い「全経路で保存されない」と読み違えた。ツアーの吹き出しは `role="dialog"` + `aria-modal="true"` で描画されるため、正しいセレクタで測り直して上の結論に至った。検証で触った localStorage は元の値（`skipped: true`）へ復元済み・console error 0

#### 一斉 merge と 2 件の取り残し（同日夜）

- **13 本が 11:49:51〜11:52:10 の約 2 分で全部 merge された**。11 本は正常着地。main は `8e2d5546` まで進めた
- **① #1350（macOS レーン）が MERGED 表示のまま main に届かなかった** — base が `claude/desktop-packaging-win-1300` の stacked PR で、**#1348 の 19 秒後**に merge したため GitHub の base 自動 retarget が間に合わず、#1348 のブランチにマージされただけで終わった。main の `release-desktop.yml` に `macos` が **0 件**。**stacked PR base retarget race の 2 例目**（1 例目 = 2026-08-14 の #861 / #865）→ 唯一のコミット `3919f71f` を main から切った枝へ cherry-pick（衝突なし・3 ファイル 73 行）して **PR #1360** で復旧
- **② #1351（chat-main tracker）の追記が取り残された** — 巡回 3〜8 回目の記録 `bb13ba52` を push した直後に、旧 head `d70e07ee` のまま merge された。`Push after merge strands commits` の型 → 同コミットを cherry-pick して `chore/tracker-main-20260831c` で復旧（本エントリを含む PR）
- **検知方法**: `gh pr list` の MERGED 表示だけではどちらも見抜けない。`gh api repos/.../pulls/<n> --jq '.merged, .base.ref, .head.sha'` で **base が main かどうか**と **head.sha がローカルの最新と一致するか**を照合し、さらに main 側で実物を grep する（今回は `grep -c macos .github/workflows/release-desktop.yml` = 0 が決定打）
- **予防として言えたこと**: merge 順の警告（#1348 → retarget 待ち → #1350、#1357 は最後）は巡回 3 回目から 3 度出していたが、**待ち時間の具体値を書いていなかった**。19 秒では足りない。次に stacked PR を出すときは base を最初から main にして依存を PR 本文で伝えるか、base PR の merge 後に **子 PR の base が main に変わったことを目視してから** merge する

### 2026-08-31 - 8/30 着地分の実ブラウザ検証 13 項目 + #1342 / #1343 起票 + 3 レーンへの /goal 組み立て

#### 概要

セッション開始時の現状把握（open PR 0 / 未回答の判断キュー 0 / outbox 未処理 0 / open Issue 10）を起点に、2026-08-30 に着地した UI 変更群を実ブラウザで検証した。12 項目 PASS・1 項目は runtime 再現不能。検証で見つけた 2 件を起票し、issue-prompter で 3 レーン分の `/goal` を組み立てた。memory の「やること③④⑤」は実測でいずれも済んでいた。

#### 変更点

- **検証環境**: `git pull --ff-only` で main を `c259a5bb` へ（5 コミット）。dev server は 5173 が先客のため 5174 で起動。当初 playwright-ui-verifier に委譲したが API のセッション上限で落ちたため、以降はメインが playwright MCP を直接操作した（「ログイン画面が出た」というエージェント報告は先客 5173 のタブ由来で、5174 は `fstprog@gmail.com` でサインイン済みだった）
- **PASS 12 件**: #1317（左 nav から Trash セクションが消え、設定カテゴリの「ゴミ箱」から開ける）/ #1323（行チェックボックス + グループ一括選択 + 「1 件を選択中」バー。一括復元で Todo 7→6 を実測、一括削除は「この操作は取り消せません」の確認ダイアログでキャンセル）/ #1322（タグ 2 つを同時 pressed にでき「タグの絞り込みを解除」が出る）/ #1307（AI 連携カード・ツール 35 個・一覧を開くボタン）/ #1332（`RepeatListPanel` の armed 行が消え「〜と、その予定をすべて削除しますか？」の ConfirmDialog になった。復元 → 削除で往復も確認）/ #1313（ノートを開く → 予定へ → 素材へ戻ると同じノートが開いたまま）/ #1316（サイドバーに trash リストなし）/ #1319（ノート行の先頭に `img "Pinned"`）/ #1314（アイコンピッカーが 6 列で潰れず表示）/ #1305（ツアー吹き出しの「1 / 5」「スキップ」が折り返さない）/ #1315（en で「1 item」「0 items」= i18next の plural 解決が動作。対象 5 キーのうち `usageCount` で実測）/ #1306（削除済みリンク先が `note-0954bb2e…` ではなく「PWVERIFY-1306-target（削除済み）」と名前で表示）
- **runtime 再現不能 1 件**: #1325 — `DeleteAccountDialog.tsx:115` / `NotePasswordDialog.tsx:178` / `LinkPanel.tsx:597` の 3 箇所とも `variant="text"` の NoticePanel を通っているのはコードで確認したが、エラーの発火条件が API 失敗・ロック設定で通常操作から出せず、画面での確認は見送り
- **起票 2 件**: **#1342**（`section:tags` / type:bug）= アイコンピッカーを開いた状態の Escape 1 回で popover とタグ編集モーダルの両方が閉じる（2 回実測して再現・保存前の入力が失われる）/ **#1343**（`section:schedule` / type:bug）= 予定の詳細パネルで「今日の流れ」「本日の Todo」だけが 2 行折り返し、「繰り返し」だけ 1 行で不揃い
- **issue-prompter**: 配布可能な 3 レーンへ `/goal` を組み立てた（schedule-refine = #1343 / tags-docs = #1342 / refactor-core = #1336）。chat-main 采配 = #1300 / #1301 / #1211（gate だった #1210 は PR #1307 で merge 済み → BLOCKED 解除）/ #1337 / #1335。Epic #1121 は子 6 件が全 CLOSED、#716 は狭幅の実機目視待ち。凍結 = #898 / #677
- **やること③④⑤の実測**: ③ r4 計画書は PR #1299 で archive 済み / ④ `C:/Users/user/dev/Claude/hooks-lib/regen-index.sh` に RETIRED 分岐あり（このマシン分は完了・Mac 未確認）/ ⑤ #1135 の方向 (b) は PR #1312 で裁定を記録済み
- **未起票の気づき**: ノート削除（「その他の操作」→ ノートを削除）だけ確認ダイアログが無く即ゴミ箱行き。Todo 削除・繰り返し削除は確認を挟むので作法が割れている。ゴミ箱から戻せる前提の意図的な差かもしれず、揃えるかはユーザー判断待ち
- **後片付け**: 検証で復元したノート / ルーチンは再削除して元の状態へ戻し、スクリーンショット 3 枚を削除。作業ツリーは clean

### 2026-08-30 - fan-out r4 全着地の回収 + /loop 巡回 1 回目（決定昇格 PR #1297・#1296 検証 PASS）

#### 概要

（朝セッション分の追い付き込み）r4 の Wave 1 / Wave 2 全 PR と chat-main 手番 3 件（#1202 / #1137 / #1135 機構分）が merge 着地し、ユーザー実機フィードバック起点の新ラウンド #1275〜#1294 を起票済み。夕方から /loop 巡回（cron 毎時 7 分）を開始し、1 回目で回答済み決定 4 件の台帳昇格と #1296 の実ブラウザ検証を消化した。

#### 変更点

- **決定昇格（PR #1297 open・一時 worktree `decisions-promotion` 経由）**: D-20260829-web-1（A = Confirm email ON・ダッシュボード切替は 2026-08-30 ユーザー実施済み）/ web-2（A = リージョン実名明記・「いずれも日本国外」の事実誤り訂正 = PR #1296）/ web-3（A = 運営者 sunbreak-pro / 連絡先 GitHub Issues で確定）/ connect-1（B = backlink 部品 3 つを P-002 適用で削除 = #1239 / PR #1258）を `.claude/decisions/` へ昇格。キュー 2 ファイル（chat-web-public / chat-connect-refine）から消化済みエントリを削除（前例に合わせ chat-main が代行・records.mjs check 緑）
- **#1296 実ブラウザ検証 PASS**: `?legal=privacy` で ja / en とも「AWS ap-northeast-1（東京 / Tokyo）」が本文 + 箇条書きに出ることを確認（`web/src/legal/legalContent.ts:74` / `:214`）。旧文面（いずれも日本国外 / transferred abroad）の DOM 全文検索 0 件・生 i18n キー露出 0・390px 横溢れなし・dark / light 崩れなし・8 セクション回帰で新規 console error 0
- **巡回の実測**: open PR 0（CI 赤 / コンフリクト対象なし）・HEAD = origin/main で取り込み不要・outbox の起票依頼は全処理済み（#1184 残置換 3 グループ → #1275 / #1278 / #1279 起票済み）・未回答の判断キュー 0（settings の G-20260829-settings-1 は判断ではなく 🛑 ユーザー実行待ち 2 手 = `0025_delete_my_account.sql` の db:push → `delete-account` Edge Function deploy の順）
- **副産物（起票せず記録のみ）**: 細幅で Settings ドロワーを開いたまま legal reader を開くと、同じ z-50 の後勝ちでドロワーが reader を覆う（`web/src/legal/LegalReaderHost.tsx:42`）。実際の操作順（ドロワーを閉じてから開く）では再現しない人工条件のみで #1251 / #1270 由来・#1296 とは無関係のため見送り

### 2026-08-29 - AI 連携の可視化 + Claude 起動導線の計画書 2 本作成と起票（#1210 / #1211・PR #1212）

#### 概要

「アプリ UI に Claude / AI 連携の要素がゼロ」というユーザー課題を受け、$0 制約（アプリから Claude API を呼ばない = Non-Goal 準拠）での組み込み範囲を 2 段階に分解。実装計画書 2 本を新規作成し、計画書パスを本文に記した Issue を 2 件起票、計画書は docs PR として open した。

#### 変更点

- **計画書**: `.claude/docs/vision/plans/2026-08-29-ai-integration-visibility.md`（段階 1: Settings AI 連携カード + ビルド時生成の MCP ツールカタログ JSON + Briefing 帰属バッジ。DDL なし・既存データ導出のみ）/ `2026-08-29-claude-launcher-desktop.md`（段階 2: IPC `claude:launch` 追加 + OS ターミナルで `claude` spawn + `isDesktopShell()`。段階 1 merge が前提・Step 0 に UI 置き場のユーザー確認ゲート）
- **起票**: #1210（[settings] 段階 1・shared-fix）/ #1211（[main] 段階 2・shared-fix・Blocked by #1210）。重複チェック済み（隣接 #1201 はスコープ別と明記）
- **PR**: #1212（docs のみ・計画書 2 本。一時 worktree `plans-ai-integration` 経由で `docs/ai-integration-plans` ブランチから提出・merge はユーザー手番）
- **実測根拠**: MCP ツールレジストリ = `mcp-server/src/tools.ts:39-60`（heartbeat 機構なし）/ Briefing 書き込みに author メタなし（`briefingHandlers.ts:430-559`）/ desktop IPC は 10 上限中 7（`ipcContract.ts:93`）— Explore 報告を spot check で全数確認してから計画書へ反映

### 2026-08-29 - Open Issue 一斉消化 fan-out r4 計画書（PR #1208）

#### 概要

open Issue 28 件・open PR 0 本の実測スナップショットから、凍結 2 件（#898 / #677）を除く全 Issue を PR に到達させる fan-out r4 計画書を作成し PR #1208 として open した。宛先振り直し 4 件も同日実施。実装は本計画書の `/goal` を各レーンへ貼ってから（このセッションでは着手しない）。

#### 変更点

- **計画書**: `.claude/docs/vision/plans/2026-08-29-open-issue-fanout-r4.md` 新規。Wave 1 = 6 レーン 19 件（schedule 2 / materials 6 / settings 3 / connect 1 / shared-fix 4 / web-public 3）、Wave 2 = #1194（gate: #1174 merge）+ #1184（gate: Wave 1 UI 系 merge）、chat-main 手番 = #1202 / #1137 / #1135 + r3 計画書の COMPLETED 化。貼り付け用 `/goal` 8 本・`/loop`・`/schedule`（任意）と停止条件を同梱
- **宛先振り直し**: #1197 / #1198 / #1199 → `[web-public]`、#1184 → `[refactor-core]` にタイトル prefix 変更（ラベルは維持。shared-fix 9 件集中の是正）
- **縄張り**: `MainScreen.tsx` の 2 レーン交差は #1199 先行 + #1171 側 rebase で緩和 / Backlinks 部品は #1171・#1172 とも読み取り専用 / tour は Wave 1 中 shared-fix 専有 / パネル統一の先回り禁止（#1184 = Wave 2）を明記
- **main 同期**: ローカル未コミットだった tracker 2 ファイルは merge 済み PR #1203 と同一内容と実測（`git diff origin/main` 空）→ restore で二重 PR を回避し、`git pull --ff-only` で 9 コミット取り込み（`b95561cf`）

> 古いエントリは [`archive/2026-08/chat-main.md`](./archive/2026-08/chat-main.md)・[`archive/2026-07/chat-main.md`](./archive/2026-07/chat-main.md)・[`archive/2026-06/chat-main.md`](./archive/2026-06/chat-main.md)・[`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照
