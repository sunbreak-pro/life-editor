# HISTORY (chat-main)

### 2026-09-01 - main の CI 赤（TagUsageCard の存在しない import）を PR #1430 で修正

#### 概要

cb445180 以降の main で `shared — build (tsc -b)` が TS2307 で落ちていた。`shared/src/components/Analytics/TagUsageCard.tsx:13` が `./EmptyState` を import していたが、Analytics サブバレルの空状態は `AnalyticsEmptyState` という名前で、`./EmptyState` は存在しない。import 名と JSX タグ名を揃える 2 行の rename で解消し、PR #1430 を open。

#### 変更点

- **原因**: `components/index.ts` が Analytics サブバレルを `export *` で再エクスポートするため、`components/EmptyState` との衝突を避けて意図的に `AnalyticsEmptyState` へ改名してある（`AnalyticsEmptyState.tsx:14-17` のコメントが根拠）。TagUsageCard だけが旧名で import していた（同じフォルダの `MobileAnalyticsView` / `ScheduleTab` / `TimeTab` は全て新名）
- **修正**: `TagUsageCard.tsx` の import 1 行 + JSX タグ 1 箇所を `AnalyticsEmptyState` へ。props（`icon` / `title` / `description`）は両者で完全一致のため振る舞いの変更なし
- **検証**: `shared` の build / typecheck:tests / lint、`tests/analyticsTagUsageCard.test.tsx`（3 passed）、`web` の build — すべて緑
- **経路**: main 直下では feature ブランチを切れないため、一時 worktree `hotfix-emptystate` から `claude/shared-fix-tagusage-emptystate-import` を切って push → PR #1430（open）→ worktree は即削除
- **衝突リスク**: 同じ修正の branch を `materials-refine`（`claude/shared-fix-main-red-20260901`）と `refactor-core`（`claude/shared-fix-analytics-emptystate-import`）が先に切っていた。いずれも未 commit / 未 push だが、両レーンへ「#1430 で着地するので降りてよい」と伝えないと三重作業になる

### 2026-09-01 - アプリ内 Note「Issue報告」を回収して Issue 9 本起票（#1399〜#1407）→ Note 削除

#### 概要

MCP 経由でアプリ内 Note「Issue報告」（Desktop 1 / Mobile 4 / 共通 4 の 9 項目）を回収し、重複チェックと実装箇所のあたり付けをしたうえで #1399〜#1407 として起票した。文が途切れていた 1 項目は起票前にユーザーへ確認して内容を確定。全 9 項目の起票完了後、指示どおり Note をソフトデリートした（「Issue報告のテンプレート」Note は対象外として温存）。

#### 変更点

- **起票 9 本**: #1399（Desktop leftSidebar ブランドヘッダーの縦ずれ・`[layout-standard]`）/ #1400（Mobile サイドバー幅をフォントサイズ非連動へ・`[mobile-refine]`）/ #1401（Mobile 月カレンダー刷新 — 横余白ゼロ・丸点→タイトルの縦リスト・省略記号なし。#1148 の後続）/ #1402（サイドバー swipe 判定を外側にも・#1050 の後続）/ #1403（Event 編集の終日トグルと日付フィールドの重なり・#940 の後続）/ #1404（materials スラッシュコマンドに画像・ファイル添付 — Supabase Storage 前提・🛑 バケット作成はユーザー手番と明記）/ #1405（Event→Todo の逆変換を編集パネルへ・#997 / #1043 参照・Materials 側は触らない）/ #1406（「本日のTodo」タブを「本日分 / その他」の 2 分類へ再編 + ホバー移動 + 移動時は日付のみ変更で時刻保持 — 途切れ項目を AskUser で確定）/ #1407（Materials 切替時のノート表示ロード）
- **Note 削除**: `note-b26afda4-…`（Issue報告）を `delete_note` でソフトデリート（Trash から復元可）
- **ルーティング**: schedule 4 本 = `section:schedule` / materials 2 本 = `section:materials` / shell 3 本 = `shared-fix`（`[layout-standard]` 1 + `[mobile-refine]` 2）。mobile 系 4 本は Epic #716 を参照に付けた

### 2026-09-01 - コード整理監査（Tauri 残骸 / 未使用コード / docs 整合）→ Issue 7 本起票（#1385〜#1391）

#### 概要

ユーザー依頼でコードベースと docs を 3 並列サブエージェント（Tauri 残骸 / 未使用コード / docs 整合）で監査し、file:line の spot check を通った findings を 7 本の Issue として起票した。ファイル・依存としての Tauri は完全に消えており、実装済み計画書の plans/ 残置も #1377 で既知の 1 本（claude-launcher）だけだった。

#### 変更点

- **起票 7 本**: #1385（未使用 `version` カラムのバンプ廃止 — PostgREST が `version = version + 1` を書けないため**全 mutation で version 取得専用 SELECT が 1 本余計に飛んでいる**。LWW cursor は `updated_at` で version は無関係・mcp-server は準拠済みで shared だけが残置）/ #1386（`migrateTodosToBackend` 削除 — 呼び出し元 0 を実測・4 箇所のみ）/ #1387（削除済み `frontend/` FROZEN 前提・撤去済み Provider の陳腐化コメント一掃 — `PRINCIPLES.md:190` は存在しない 3 Provider の Optional バリアントを指示する規範のまま）/ #1388（dead i18n 33 キー + dead CSS — kanban 名前空間は CalendarTab / TagColorControls が 6 キー借用中なので移設してから名前空間ごと削除）/ #1389（参照ゼロ export 5 型 + 使われないテストシーム + `EmptyState` 同名 2 実装の rename）/ #1390（#1293 Trash 移設の design docs 追随 — IA.md が registry に無い Trash をユーティリティ枠として列挙・_COMMON-CONTEXT は Version 3 のまま）/ #1391（add-ipc-channel スキルの「7 関数」が実装 9 と乖離ほか dead path・数値 drift の束）
- **起票しなかったもの**: claude-launcher 計画書の残置（#1377 で既知）/ `fetchAllPages` の shared↔mcp 重複（#677 の承認済み負債・コードコメントに明記あり）/ mapper の過剰 export 30+（公開 API サーフェス方針の判断が要るため #1389 の備考に留めた）/ REFERENCE 計画書の置き場不統一（A/B 裁定として #1391 内に記載）
- **監査の白判定**: Tauri ファイル・依存・IPC = 0 / ScreenLock・FileExplorer・Terminal 残骸 = 0 / import グラフ上の orphan ファイル = 0（src 400+ ファイル）/ plans 14 本の Status enum 逸脱 = 0 / d3・Connect グラフ残骸 = 0
- **運用メモ**: 未使用コード調査のサブエージェントが 600 秒ストール → SendMessage で再開させて完走（SSE バグの既知型）

### 2026-08-31 - ユーザー実機フィードバック 11 項目を Issue 14 本（#1362〜#1375）へ起票

#### 概要

ユーザーから実機で気づいた UI/UX の要望 11 項目をまとめて受け、起票前に 5 点を確認したうえで #1362〜#1375 の 14 本として起票した。要件のうち 2 項目は 1 Issue に収まらないため分割し、追加でもらった「アプリから Claude を起動する入口」は #1211 で実装済みと実測したため起票しなかった。

#### 変更点

- **起票 14 本**: #1362（週 / 日ビューの now-line から時刻ラベルを外す）/ #1363（テンプレート編集パネルを通常 Note と同等の広さへ・#1180 follow-up）/ #1364（Note rightSidebar フィルタの選択繰り上げ廃止）/ #1365（Note アイテム上部のタグ表示整理 + アイコン反映）/ #1366（タグアイコン +30）/ #1367（今日の流れの Todo 行をチェックボックス式へ）/ #1368（チェックボックス全面統一 + 朝刊の桁ズレ）/ #1369（朝刊の Todo 行に時間帯）/ #1370（追加パネルを 2 タブへ）/ #1371（Todo 追加ボタンの二重プラス）/ #1372（Notes 初期画面中央の追加ボタン削除）/ #1373（Event の完了概念を廃止）/ #1374（予定リマインダー）/ #1375（Work 実績のタグ別記録）
- **1:1 にしなかった 2 項目**: 要件 3 は「フィルタの挙動」と「タグ表示 + アイコン」で触る場所が違うので #1364 / #1365 に分割。要件 11 は「Event の完了概念を消す」だけでは予定の状態が分からなくなるため、ユーザー回答に沿って #1374（リマインダー = **OS 通知あり**）と #1375（Work 実績を予定側に残し、タグ別稼働時間 / 使用回数を Schedule・Todo と紐づける）を対で起票
- **起票前のユーザー裁定 5 点**: (1) Event は完了概念ごと廃止（ピルのクリックが完了トグルを兼ねていたため、消すと完了操作も消える点を提示したうえで）(2)「Materials の Todo リスト」= Note 本文のチェックリスト（Todos は #1153 で Schedule 側へ移設済みのため実体を確認）(3) タグアイコンは +30（合計 55〜60）(4) タグ表示の具体形は実装一任 (5) 追加パネルの Note タブは畳むが、ノート紐付けは予定・Todo タブの中へ残す
- **重複チェックの収穫**: #1365 は #1291「タグアイコンを全 UI に反映」の取りこぼし、#1363 は #1180「中央パネルで編集」の詰め残りと判明したので、それぞれ本文に旧番号を参照として書いた。#1366 の本文には **`import { icons }` へ戻さない**制約（#1114 / PR #1112 の実測 = eager チャンク −28.0%）を制約節として明記
- **起票しなかった 1 件**: 追加要望「アプリから Claude を起動する入口（ターミナルを開いて `claude` を撃つ）」は #1211 で実装済み。`desktop/src/main/claudeLauncher.ts` + `claude:launch` IPC + `SidebarNav.tsx:197-202` のフッター常設行 + Settings の AI 連携カードを実測し、今朝 `07a1da97` で main に着地していることを確認した（D-20260831-settings-1 の裁定どおり素の `claude` を Settings のパス欄で起動する形）。**ただし docs が 3 箇所とも追随していなかった** — 計画書 `2026-08-29-claude-launcher-desktop.md` の Status が IN PROGRESS のまま（archive 未移動）/ CLAUDE.md §5 も「#1211 で再設計中」のまま / `D-20260831-settings-1` の `implemented-by` が空。ユーザー指示で **#1377（`[settings]` / `type:docs` / `shared-fix`）として起票**した。常時ロード面（CLAUDE.md）が古いままだと次のセッションが「まだ無い機能」と誤認するのが実害

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

> 古いエントリは [`archive/2026-08/chat-main.md`](./archive/2026-08/chat-main.md)・[`archive/2026-07/chat-main.md`](./archive/2026-07/chat-main.md)・[`archive/2026-06/chat-main.md`](./archive/2026-06/chat-main.md)・[`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照
