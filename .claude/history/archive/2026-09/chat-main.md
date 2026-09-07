# HISTORY archive 2026-09 (chat-main)

### 2026-09-02 - Issue 棚卸し + 5 レーンへ /goal 組み立て + #1408 計画書（PR #1441）+ #1335 作業分（PR #1443）+ 判断 4 件の回収

#### 概要

ユーザー依頼「Issue を整理し、issue-prompter で各 worktree へ渡すプロンプトを作り、画面ごとにエージェントを起動して検証する Issue（#1408）にも手を付ける」。open Issue 20 件を仕分けて 5 レーン 11 件の `/goal` を組み立て、#1408 は Issue 本文の 2 セッション分割に従い**計画セッション**として計画書を書いた（ブラウザ未起動）。あわせて outbox の起票依頼 3 件を処理し、退役レーン宛 3 件の宛先を振り直し、判断 4 件を AskUserQuestion で回収して台帳へ昇格した。

#### 変更点

- **main の分岐解消**: ローカル main に tracker コミット 1 つ（前セッションの直 commit・未 push）だけが取り残され `git pull --ff-only` が失敗。origin 側はその 2 ファイルも `.claude/automation/` も触っていないことを `git diff --stat main...origin/main -- <paths>` で確認してから `git rebase --autostash origin/main`。そのコミットは本日の tracker PR に cherry-pick で載せ替え、main は `git reset --hard origin/main` で origin と一致させた（**chat-main の tracker も PR 経由に統一** — 直 commit は次の pull を割る）
- **Issue 棚卸し（open 20 + 本日 4）**: 配布 = schedule-refine 5（#1371 / #1406 / #1405 / #1403 / #1401）/ shared-fix 1（#1399）/ tags-docs 2（#1390 / #1391）/ materials-refine 2（#1438 / #1439）/ refactor-core 1（#1388）。除外 = #1374（PR #1433 open）。采配 = #1408 / #1409 / #1335 / #1300 / #1301 / #1375 / Epic #1121 / #716 / 凍結 #898 / #677。**宛先振り直し 3 件** = #1399 `[layout-standard]`→`[shared-fix]`・#1390 / #1391 `[docs-workspace]`→`[tags-docs]`（両レーンとも退役済みで worktree が無く、issue-prompter の宛先解決に乗らなかった。Issue コメントで理由を残した）
- **起票 4 件**: #1438（添付の孤児回収 / materials outbox）/ #1439（添付アップロード進捗の方針 — 方針決めの Issue / 同）/ #1440（#1373 で凍った進捗の数字 2 つ / schedule outbox）/ #1442（朝刊「今日のスケジュール」Todo 行のチェックボックスを共有部品へ / D-20260901-shared-fix-2 の裁定から）
- **PR #1433 の migration 版番号衝突を検出**: #1425（2026-09-02 merge）が `0027_attachments_bucket.sql` を先に入れたため、#1433 の `0027_events_payload_reminder_offset.sql` と `0027` が 2 本並ぶ。ファイル名が違うので git は MERGEABLE と言うが `supabase db push` は版番号で並べるので通らない。`0028` への改名を PR コメントで依頼。**ユーザーの db push 順 = 0027 attachments → 0028 reminder → #1433 merge**
- **#1408 計画書 = PR #1441**（`plans/2026-09-02-desktop-screen-audit.md`・一時 worktree `plan-1408` 経由・docs-lint 緑）: 画面別チェックリスト 7 本（タブ / パネルの一覧は型 `BriefingTab` / `ScheduleSidebarTabId` / `MaterialsTab` / `AnalyticsTab` / `TrashCategory` / `SECTION_TAB_IDS` を指して個数を書かない）/ 結合 S1〜S10 / 1 画面 1 エージェント直列 + メイン直接操作のフォールバック（2026-08-31 に playwright-ui-verifier が API のセッション上限で落ちた前例を手順に組み込んだ）/ 停止条件 / `PWV1408-` 台帳 / 後始末（`search_all` = 0 と `list_wiki_tags` 残無しを AC に）。**書いてはいけないもの**を明示 = Daily / 目標ノート / フォーカスノート / `timer_sessions`（削除 API が無い = grep で `deleteSession` 0 件）/ 添付（0027 未 push）
- **#1335 作業分 = PR #1443**: 2026-09-01 に working tree へ置いたままだった `.claude/automation/` 6 ファイル + settings-unattended 2 本を、ユーザー裁定（PR にして出す）に従い `git diff` パッチ + 未追跡 2 本のコピーで一時 worktree `automation-1335` へ移して PR。docs-lint 緑
- **判断 4 件を AskUserQuestion で回収 → 台帳へ**: D-20260901-shared-fix-1 = **A**（ツアー再生は続きから・現状維持）/ D-20260901-shared-fix-2 = **B 相当**（揃える。PR #1395 / #1410 が merge 済みのため別 Issue #1442 で。提示ラベルとキュー原文のズレを D ファイルに注記）/ D-20260902-main-1 = **A**（#1440 は Todo 由来だけに寄せる。キュー未提出のまま回答が先行 — D-20260812-shared-fix-3 と同型）/ #1335 の着地先 = PR。ANSWERS.md へ 3 行転記・shared-fix キューから 2 件削除・#1440 に裁定コメント
- **未処理で残したもの**: #1442 の briefing-refine への `/goal`（起票直後で未配布）/ #1375 の 3 レーン分割起票（#1440 の裁定後に着手可能・未実施）/ mobile-refine からの #1400 / #1402 実機確認依頼（#1409 の実行セッションへ畳む）

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
