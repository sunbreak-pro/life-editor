# MEMORY.md - タスクトラッカー

## 進行中

### 🔧 クロスプラットフォーム移行 Phase 2 — コア機能のフロントエンド移植（着手日: 2026-05-16）

**対象**: `supabase/migrations/0003+`（ドメイン別本格スキーマ）/ `supabase/scripts/`（RLS ゲート）/ `shared/src/{components,context,hooks,i18n}/`（frontend から Tauri 非依存を移植）/ `web/`（配線）。`frontend/` `src-tauri/` `cloud/` 不可侵維持
**計画書**: `.claude/docs/vision/plans/2026-05-16-phase2-core-migration.md`

- 前回: **S3(Notes) コード完了 + ステップ2(0005 実DB検証)完了** — 0005 本番適用済(ユーザー手動 SQL Editor)。実DB検証: notes/note_links/note_connections の rowsecurity=true + 各4policy着地 / S0 RLS gate check-rls.sql 全文実行=offender0(sentinel のみ＝public 全テーブル clean) / PostgREST FK名 `note_links_source_note_id_fkey` 実DB一致(他3 FK も確認) / get_advisors(security)=RLS lint 0(WARN は auth_leaked_password_protection のみ＝0005無関係・完成後判断)
- 前回: PR1 実装(02c9045) + 循環ガード + 406 A-1 + known-issue 020、pathspec commit/push 済
- 現在: **PR1 を role-qa 別コンテキスト独立監査で正式クローズ(PASS / Blocker0 Major0 / ④子カスケード最重点検証クリア) + chat-refactor handoff の forward-port #1#2#3 を shared/ に適用**。FP#1=`getDescendantTasks.ts` visited ガード(KI-016 OOM 再発防止、`d62a2dc` 3 hunk をバイト一致適用) / FP#2=`wikiTag.ts` `entityType` "memo" 除去+`WikiTagEntityType` 参照化 / FP#3=`createContextHook.ts` `if(!value)`→`if(value==null)`。role-pm 分解→ユーザー判断(Q1 #1先行 / Q2 #1+#2+#3 / Q3 PR2 やらない / Q4 ④非対称=既知制約受容)→role-engineer 実装→role-qa 統合監査 PASS。shared/web `tsc -b`+eslint green、frontend/src-tauri/cloud diff0 非破壊。計画書 PR1 ①②③④ + Verification + FP#1#2#3 を [x] 化、Status=PR1 COMPLETE
- 次: **S4 Schedule 移植**(最大規模: routines/routine_groups/routine_group_assignments/schedule_items/calendars/calendar_tag_assignments + Schedule 3分割 Provider Routine→ScheduleItems→CalendarTags)。S3 同様ループ(migration→SupabaseDataService→context/hooks→web ミニ UI→検証)。S4 着手前に role-pm で要件分解(sync 区分判定/スキーマ依存順/Routine 生成仕様/曖昧点)。S4 以降も Option A 前提。**FP#4#5(型集約 Low・挙動不変)は今回スコープ外＝別フェーズ**。PR2 UX(⑤行内アクション収束 ⑥drop indicator ⑦間隔)+⑧subtree restore は Backlog(計画書記録済)

**S3/S4 申し送り（優先度順）**: ①**[✅ 完了 2026-05-17] 0005 本番 apply + 実DB検証済**: RLS gate offender0 / FK名一致 / advisor RLS lint0。残: (c)検索クエリ特殊文字 sanity は実ブラウザ確認(d)に統合、(d)実ブラウザ Notes CRUD/階層DnD/TipTap/password の動作確認はユーザー手動で実施中（PR1 適用後）。backlink はデータ層実装済だが lean web UI 未配線（roundtrip+FK名一致で担保、UI は Backlog） ②**[再発防止知見・厳守]** PostgREST `select=` に任意 SQL 式不可（カラム名 or generated column / DB 関数のみ）。computed boolean は generated column 化が定石。S4+ mapper でも厳守 ③**[アーキ・S4 前提] Option A 確定**: shared は UI フリー（context/hooks/services/types のみ）/ web/src/<domain>/ に新規ミニ UI。計画書「frontend→shared/components」文言は不正確（S1/S2/S3 実態へ補正済）。S4 Schedule も Option A・TipTap/dnd 等は web 側 ④**[既存債務・悪化なし]** plaintext password は RPC security-invoker 化が将来の正攻法（コード/SQL コメント既設、Medium-2）。Low-A: searchNotes の LIKE メタ %/\_ 非リテラル化は Tauri SQLite LIKE 同挙動＝移植方針上現状維持が正 ⑤**[インフラ候補]** shared/web に vitest 未配備で Gate3-4 SKIP。Phase 2 横断で一括整備候補（最優先=noteMapper/noteLinkMapper 純粋関数, useNoteTreeMovement 循環ガード）。designer 改善: prefers-reduced-motion 一括無効化 / NotesView 英語直書きの i18n テーブル化(Settings S-step) ⑥**[未解消・要ユーザー]** PAT 露出止血継続（MCP write 昇格前提未達でwrite凍結・SQL Editor 手動）/ upsert read-then-write LWW(S8) / SyncProvider 二重ラップ(S8) / `web/src/TasksScreen.tsx` dead code 要確認 / `get_advisors` `auth_leaked_password_protection` WARN(完成後判断) ⑦**[別チャット同居]** working tree に並行チャットの未コミット IME 安全化リファクタ(frontend/ ~30ファイル+imeSafe.ts/test+useSlashCommand.ts 等)が同居。**commit は frontend/ 全除外のパス指定必須**(`git add -A` 厳禁)。`.claude/HISTORY-archive.md.bak`・`.claude/2026-*.md`削除・`.mcp.json`・frontend-refactor plan の M も巻き込まず
**サブエージェント分担**: 設計=role-pm / 実装=role-engineer / 監査=role-qa+security-reviewer / 統括=メイン

## 直近の完了

- Phase 2 S3 Notes PR1 正式クローズ + forward-port #1#2#3 ✅（2026-05-17）— PR1(①②③④, 02c9045) を role-qa 別コンテキスト独立監査 PASS(Blocker0 Major0、④子カスケード最重点クリア)で正式クローズ。chat-refactor handoff の FP#1(getDescendantTasks visited ガード=KI-016 OOM 再発防止) /#2(wikiTag entityType "memo"除去) /#3(createContextHook null安全) を shared/ に適用、role-qa 統合監査 PASS(適用元 d62a2dc とバイト一致確認)。FP#4#5 はスコープ外。計画書 Status=PR1 COMPLETE。詳細 HISTORY 参照
- クロスプラットフォーム移行 Phase 2 S3(Notes) コード完了 ✅（2026-05-17）— Option A（shared UI フリー / web 新規ミニ UI）で notes/note_links/note_connections 0005 スキーマ+RLS / SupabaseDataService notes系25メソッド+mapper / NoteContext+hooks / web/src/notes(lean TipTap+password/lock UI)+配線。3監査(qa PASS-with-fixes Blocker0 / security Critical0 High0 Medium2 RLS clean / designer 致命0)→集中修正(B1/A2/A3/B2/Medium-1+searchNotes pgrstQuoteValue/Link protocols)+security 再確認妥当。0005 本番未apply＝実機確認は次セッション初手。パス指定 commit。詳細 HISTORY 参照
- .claude ドキュメント整理（archive 圧縮統合 / HISTORY-archive コンパクト化 / 矛盾修正 / known-issues 新規）✅（2026-05-16）— サブエージェント3並列（archive要約=general / HISTORY圧縮=general / 矛盾調査=general）。archive/ 50ファイル git rm（28プラン+TODO+docs/dropped/rules/vision-tauri）→ `archive/SUMMARY.md`(283行, 元601KB→22KB) に圧縮統合 + vision-tauri 恒久知見抽出。`HISTORY-archive.md` 1257→413行(69%減、`.bak` 退避・コミット対象外)。CLAUDE.md/MEMORY.md/移行SSOT/coding-principles の矛盾 Top3+#3 修正（vision-tauriリンク切れ→SUMMARY張替 / Phase1着手準備中→Phase2進行中 / IPC 3点→4点同期 / MCP 30→32ツール+dismiss系）。known-issues 017(calendar soft-delete/Routine再生成)・018(macOS WebKit button focus)・019(createPortal click-outside)新規 + INDEX更新。Claude Desktop に life-editor MCP 登録（config はリポジトリ外、node 絶対パス）。ブランチ refactor/web-first-v2、パス指定 `.claude/` のみコミット

## 予定

> **注**: 以下の予定タスクの大半は旧 Tauri / Cloudflare アーキテクチャ前提で書かれており、Web ファースト移行（refactor/web-first-v2）の進行に伴って **deprecated** になる可能性が高い。各タスクの存続判断は移行 Phase 1-2 進行時に再評価する。

### Point Graph (Connect/Node) 継続フィードバック反映

**対象**: `frontend/src/components/Ideas/Connect/PointGraph/`
**背景**: 2026-05-16 に Canvas+d3-force へ全面置換、手動 UI 検証ではバグ未検出。実運用で見つかる改善・不具合をここに集約する（都度起票せず本エントリに追記 → まとまったら 1 セッションで対処）
**洗い出し対象の観点**: ライト/ダーク配色の見やすさ / ノード多数時の FPS・レイアウト密度 / ドラッグ・ピンチ・スムーズパンの体感 / フィルタパネル開閉 UX / ConnectSidebar 連動の取りこぼし / ノード→エディタ遷移 / ラベル可読性（ズーム閾値）/ タグノード化による情報過多の有無
**未検出だが要観察**: keydown effect が `filters` 全体依存で毎レンダー再購読（機能影響なし・性能微）
**収集メモ**:

- （実運用で気づいた項目をここに追記）

### Mobile vs Desktop 設計方針の docs/vision/ への明文化

**対象**: 新規 `.claude/docs/vision/mobile-design.md`（仮名）
**背景**: 2026-05-12 セッションで CLAUDE.md §2 Platform に直接追記したが working tree から消失（並行チャットまたはリンターによる巻き戻しを推定）。CLAUDE.md は 400 行以下目標 + 「新機能は §8 + docs/requirements/」が原則のため §2 直接追記は不適切、`docs/vision/` 配下の独立ファイル化が筋。本セッションで取りまとめた内容:

- Desktop = クリエイティブ重視、Mobile = コンパクト重視
- Mobile 必須セクションは Schedule (予定/タスク/ルーティン) / Work (標準ミュージックのみ、カスタム音源追加は Mobile では非対応) / Notes (デイリー/ノート) / Settings の 4 つだけ
- Mobile は Desktop の縮小コピーではなく専用に再設計
- スラッシュコマンド・タグ付けは Mobile でも 1〜2 タップで到達できるよう設計

**手順**: `mobile-design.md` 新規作成 → CLAUDE.md §2 末尾に 1 行リンク追加 → `2026-05-04-cross-platform-migration.md` と相互リンク。並行チャットとの衝突回避のため、編集前に `.claude/comm/outbox/` で予告するか multi-session-coordinator でロック取得を検討

### ユーザー並行作業の TS エラー解消（別コミット）

**対象**: `App.tsx` / `CommandPalette.tsx` / `Schedule/ScheduleSection.tsx` / `Settings.tsx` / `Ideas/{Connect,Paper,Daily,Materials}Sidebar.tsx` / `useAppCommands.ts` / `useSectionCommands.ts` / 新規 `SearchTrigger.tsx` / `lucideIconRegistry.ts`
**背景**: 本セッションの Routine Tag→Group 移行とは独立して進行している検索トリガー refactor 由来の TS エラー: `sidebarSearchQuery is not defined` (ScheduleSection.tsx) / TS6133 unused vars 多数 / `searchPlaceholder` props 不整合
**手順**: 検索トリガーの refactor を一旦完成させ tsc -b clean に戻す → コミット

### Q2 機能パッチ Phase D / Phase A Cloud Sync の手動 UI 検証

**対象**: macOS app launch / 既定ブラウザ選択 / iOS Drawer 表示 / 双方向同期の動作確認
**前提**: D1 migration 0003/0004/0005/0006 全適用済 + Worker latest deploy 済 (2026-04-25 完了)
**手順**:

1. Desktop で Sync Now 実走 → `Last error` が消えて Connected 表示が維持されることを確認
2. Desktop V67 自動 apply 確認 → LeftSidebar に「Links」セクション表示 / `+` で URL/App リンク追加 / 既定ブラウザ切替で URL 起動先が変わる / `/Applications/*.app` 一覧から登録できる
3. iOS シミュレータ Drawer に `kind='app'` がグレーアウト + Toast 出ることを確認
4. Desktop ↔ iOS 双方向 sync で sidebar_links と calendar_tag_assignments が伝搬すること
5. **Known Issue 016 検討**: D1 0004 が transactional rollback 保証下にも関わらず `calendar_tag_assignments` rebuild 部分のみ未適用となった原因の調査・記録 (`docs/known-issues/_TEMPLATE.md` から起票)

### リファクタリング Phase 2-4 / 3-1 / 3-4 検証用実装計画の手動実施

**対象**: Desktop / iOS 実機での UI 回帰検証 + Cloud Sync round-trip
**計画書**: `.claude/2026-04-26-refactoring-verification-plan.md` (Status: AUTOMATED COMPLETE / MANUAL PENDING)
**前提**: 自動検証 (S-1 Rust build/test / S-7 calendarGrid 境界ケース 20/20 / S-8 fetch_tree benchmark 100ms 基準内 / S-9 plan ファイル反映) は 2026-04-26 完遂済。残るは手動 UI / Cloud Sync / docs 整理のみ
**手順**:

1. **S-2 IPC 統合**: Desktop 起動 → Tasks / Notes / Dailies / Schedule / Routines / Database / Wiki Tags / Paper Boards / Sound / Templates / Sidebar Links 全 11 ドメインの fetch 経路でエラー無し
2. **S-3 Cloud Sync round-trip**: 5 ドメイン変更 → push → 別端末 pull → 完走 + 5000 行超で `nextSince` cursor 進行確認
3. **S-4 Calendar Mobile**: Monday 始まり / 月遷移スワイプ / chip 表示 / Today ハイライト / 月境界 item
4. **S-5 Calendar Desktop**: Sunday 始まり / 6 行固定 / WeeklyTimeGrid / DayCell 描画 / Routine ハイライト
5. **S-6 Schedule View**: MobileScheduleView 週 dots / 週遷移 (`getMondayOf` 基準) / 月跨ぎラベル / Desktop ScheduleSection 4 タブ / DualColumn toggle
6. **S-9 docs 整理 (UI 検証完了後)**: `docs/known-issues/INDEX.md` で formatter / SQL whitelist / row_to_model 重複 を削除候補マーク / `docs/code-inventory.md` の Active/Duplicate セクション更新

### Realtime Sync Phase 1 実装 — foreground 可変 polling + 変更イベント駆動 push

**対象**: `frontend/src/context/SyncContext.tsx` / DataService mutation 呼出層
**背景**: 現状 30 秒間隔 polling で往復 60 秒ラグ。「DB 共有の実感」が薄い
**手順**: Visibility API 観測 → フォアグラウンド 3-5s / 非アクティブ 60s、主要 mutation 後に debounced `triggerSync()`
**参照**: `.claude/archive/SUMMARY.md`「vision-tauri 恒久知見 > Realtime 同期のレイテンシ目標」（旧 realtime-sync.md は 2026-05-16 削除、Supabase Realtime で再評価）

### Mobile Settings に Full Re-sync ボタン追加

**対象**: `frontend/src/components/Mobile/MobileSettingsView.tsx::MobileSyncSection` (line 159-183)
**背景**: Desktop `SyncSettings.tsx` には `fullDownload` ボタンがあるが Mobile 側は `triggerSync` + `disconnect` の 2 ボタンのみ。初回 pull が truncate した時に「Disconnect → Reconnect」の 3 手順が必要で UX が悪い

### Desktop パッケージ版の更新

**対象**: `/Applications/Life Editor.app`
**背景**: 現在の /Applications 配下は session 前の Rust バイナリ(V63 migration / create() guard / sync_engine 特別扱いを含まない)。V63 は DB に既適用済なので実害は限定的だが、新規 Routine 作成時の (routine_id, date) UNIQUE 違反を graceful に握りつぶす guard が無い
**手順**: `cargo tauri build` → `target/release/bundle/macos/Life Editor.app` を `/Applications/` 既存と置換

### 旧バンドル DB の orphan クリーンアップ

**対象**:

- `~/Library/Application Support/com.lifeEditor.app/life-editor.db` (user_version=59、旧 routine_tag_definitions / routine_tag_assignments / routine_group_tag_assignments を保持)
- `~/Library/Application Support/sonic-flow/life-editor.db` (user_version=0、空)

**背景**: bundle ID 変遷（旧 `sonic-flow` → `com.lifeEditor.app` → 現行 `com.lifeEditor.app.newlife`）の遺産。Known Issue 006 関連。現在の app は `~/Library/Application Support/life-editor/life-editor.db` (user_version=69) を使うため上記 2 つは orphan。実害はないが (a) ストレージを浪費 / (b) 検証時に grep で誤って旧 DB を引いて混乱する（実際 2026-04-29 の Routine Tag 廃止検証の際に発生）
**前提**: 削除前に rescue 価値のあるデータが無いことを確認。`sonic-flow/sonic-flow.db` は別プロジェクト(Sonic Flow アプリ本体)なので残す
**手順**:

1. `sqlite3 <旧 DB path> "SELECT COUNT(*) FROM routines WHERE is_deleted=0; SELECT COUNT(*) FROM tasks WHERE is_deleted=0; SELECT COUNT(*) FROM notes WHERE is_deleted=0"` で各テーブル行数を確認
2. 行があれば `~/Backups/orphan-life-editor-<bundle_id>-$(date +%Y%m%d).db` に退避（rsync ではなく `cp` で WAL 含めず単一ファイル退避）
3. `rm <旧 DB path>` （`life-editor.db-shm` / `life-editor.db-wal` も同時削除）
4. アプリ再起動して動作影響なし + `find ~/Library/Application\ Support -name 'life-editor.db'` の結果が `~/Library/Application Support/life-editor/life-editor.db` の 1 件のみになることを確認

### Part A 手動受入テスト（iOS 実機）

**対象**: iPhone 実機での Materials Notes 表示確認
**背景**: 2026-04-21 Phase A コード変更は品質ゲート通過済み、iOS 実機での NodeView レンダリング確認が未実施
**観点**: Callout / ToggleList / WikiTag / NoteLink / Table / TaskList が Desktop と同一構造で表示されること

### iOS 4G 同期検証

**対象**: iPhone 実機 / 4G 環境
**前提**: 004/005/008 修正完了 + V62 migration 適用

### Mobile Schedule & Work リデザイン 手動 UI 検証

**対象**: iPhone シミュレータ / Tauri build で Schedule 月カレンダー / Dayflow / Work 全項目を目視検証

### iOS 追加機能要件の残タスク（Phase 4 M-1 / Phase 5 / Phase 6.2 / Mobile C-3）

**対象**: `NoteTreeNode` (行スワイプ) / `components/Notes/extensions/SlashCommand.ts` (新規) / `MobileCalendarView` の filter UI / `MobileScheduleItemForm` (5-role 対応)
**背景**: 2026-04-24 Phase 8 完了時点で以下を次セッションに繰越:

- **M-1 行スワイプ (edit / pin / delete)**: 既存 `NoteTreeNode` が DnD + hover UI を抱えるため touch-UX 再設計が必要
- **M-2 / M-3 TipTap slash command + empty line hint**: `@tiptap/suggestion` 依存追加 + ポップオーバー UI 新規実装
- **C-2 Calendar filter / sort**: role multi-select + sort UI 設計が必要（drawer 内 filter sheet として実装予定）
- **Mobile C-3**: `MobileScheduleItemForm` を event 専用から 5-role 選択対応にリファクタ

**参照**: `~/.claude/plans/life-editor-note-ios-calm-moth.md` Phase 4-6

### Frontend 既存 lint 116 問題の一括解消

**対象**: `useTaskTreeCRUD.ts` / `databaseFilter.ts` / `holidays.ts` 他(session 外で蓄積)
**背景**: 2026-04-22 session-verifier で検出。Unused underscore-prefixed vars / React Compiler memoization 不整合 / exhaustive-deps missing が混在。本 session の変更範囲外のため touching 見送り、別セッションで一括対応

### 保留（将来再評価）

- **S-2**: Tauri IPC naming 方針 — ADR-0006 で規約のみ採択、150 コマンド一括 typed struct 移行は未着手
- **React Compiler 有効化**: S-4 Drop 判定時に切り離し

## バグの温床 / 今後の注意点(2026-04-23 更新)

以下は本 session で顕在化した構造的な脆弱性。同類のバグが再発する可能性が高い領域として記録。DB 系の再発防止ルールは [`docs/vision/db-conventions.md`](./docs/vision/db-conventions.md) に集約:

- **timestamp 形式混在（Known Issue 013）**: SQL 内 `datetime('now')` と `new Date().toISOString()` / `helpers::now()` が同じテーブルに書き込まれ、スペース区切り vs ISO 8601 の混在で sync 文字列比較が壊れる。ASCII 順 space(0x20) < T(0x54) のため一度 since が ISO になると同日 space 行が永久に push から漏れる。暫定対応は sync query の `datetime()` 正規化、恒久対応は書き込み側を ISO 8601 に統一
- **delta sync が updated_at 単調性に依存（Known Issue 014）**: Mobile 11:50 編集 v=372 と Desktop 13:30 編集 v=228 のような高 version + 古 updated_at が Cloud に居座ると `WHERE updated_at > since` では永久に pull されない。Full Re-sync が緊急弁。本命は Cloud D1 に `server_updated_at` 列を追加して delta cursor をそちらへ切り替え
- **Cloud D1 migration が Desktop migration と同一テーブル前提になりがち**: 0002 を流用しようとしたら `note_links` / `paper_nodes` が D1 に無く失敗。Desktop schema は superset、Cloud は subset という認識を migration 作成時に徹底
- **Cloud deploy と D1 migration の tai-ming**: Worker を deploy すると新 schema を前提に push INSERT を試み、D1 が未 migration だと batch 全ロールバック → sync 全体が silent に停止。deploy と migration を必ずセットで運用
- **論理的一意性を持つテーブルの UNIQUE 制約**: schedule_items で発覚したが、tasks / dailies / notes / routines も同じ「`id` PK のみで論理キー UNIQUE 無し」。特に `routine_tag_assignments (routine_id, tag_id)` のような複合キー relation は要再点検
- **sync 衝突解決が ID 単独**: `ON CONFLICT(id)` + version 比較の LWW は複合キー衝突(異 id 同 payload)を検知できない。今回は schedule_items に特別扱いを足したが、他の relation テーブルが同じ罠に嵌る可能性
- **pagination 半実装**: `/sync/changes` の LIMIT + `hasMore` は cursor が伴わず、client ループにも対応していない。暫定 LIMIT=5000 は応急措置で、テーブル成長で再発
- **D1 の compound SELECT 制限**: `UNION ALL` は 5 本まで。診断 SQL で 6 本以上繋ぐと `too many terms` エラー。個別 `--command` で回す
- **wrangler d1 execute の引数**: 相対パスは CWD 基準 / 長いコマンドを `\` で改行するとシェルによっては `--file=` 以降が別コマンド扱いで Unknown argument。1 行で書くのが確実
- **client / server 分散 flag**: `has_more` のように片方だけが使っている field は気づかず古びていく。片側更新時はもう片側の参照箇所を grep で確認する運用が必要
- **Mobile UI の機能欠落(Full Re-sync)**: Desktop SyncSettings と Mobile MobileSyncSection で実装差分があり、障害時の workaround が Mobile で取れない。014 のような状況で詰む
- **`tsc --noEmit` at frontend root は無意味**: `tsconfig.json` が solution-style(`files: []` + references のみ)なので実際の型チェックが走らない。Phase 0 verification では `tsc -b` または `npm run build` を使うべき(session-verifier skill には記録済)
- **Xcode GUI ⌘R は Tauri 2.x で動かない**: `cargo tauri ios xcode-script` は親プロセスが立てる JSON-RPC サーバに依存。Xcode 単独起動では `ConnectionRefused` で落ちる。必ず `cargo tauri ios build` or `dev --host` をターミナルから実行
- **Xcode の PATH に NVM / cargo が無い**: `/usr/local/bin/` への symlink(cargo/rustc/rustup)で解消済だが、他のマシンでセットアップする際に再発する。`ios-everywhere-sync.md` vision 更新案件
- **Desktop パッケージ版と HEAD 実装の乖離**: V64 migration は DB に適用される必要あり、`/Applications/Life Editor.app` の Rust バイナリは旧版のままだと Daily テーブル未対応で起動時 migration 走行 → dailies への rename を経験する。新規ビルドを置換推奨
- **iOS binary と Cloud schema の三者不整合**: Desktop / iOS / Cloud のどれか 1 つでも古いまま運用すると sync が silent に壊れる。V64 のような rename 系 migration は 3 端末同時更新が前提
