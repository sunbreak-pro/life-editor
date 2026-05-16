# MEMORY.md - タスクトラッカー

## 進行中

### 🔧 クロスプラットフォーム移行 Phase 2 — コア機能のフロントエンド移植（着手日: 2026-05-16）

**対象**: `supabase/migrations/0003+`（ドメイン別本格スキーマ）/ `supabase/scripts/`（RLS ゲート）/ `shared/src/{components,context,hooks,i18n}/`（frontend から Tauri 非依存を移植）/ `web/`（配線）。`frontend/` `src-tauri/` `cloud/` 不可侵維持
**計画書**: `.claude/docs/vision/plans/2026-05-16-phase2-core-migration.md`

- 前回: **S2(Daily) 完了** — DAILY_SELECT_COLUMNS の PostgREST 非対応 SQL 式 `password_hash is not null as has_password` が 400 を誘発し Daily 全 read/upsert 全滅・本番 dailies 0行だった root cause を、0004 に `has_password` generated column 追加 + DAILY_SELECT_COLUMNS 素カラム名化で構造解消。0004 本番 SQL Editor 再適用済（MCP write 凍結維持）、RLS owner-only 4 policy + generated column ALWAYS を MCP read-only 実証、実機 parity green（is_pinned が version=9 まで content 編集で潰れず保持・リロード永続化・restore 機能）。実装=role-engineer / 監査=role-qa APPROVE W/C + security PASS W/N
- 現在: **S3 Notes 移植 着手準備**（notes + note_links + note_connections スキーマ → TipTap 依存確認 → `Notes/` 移植 → 動作確認）
- 次: S3 Notes → S4 Schedule → S5 WikiTags → S6 横断 → S7 バナー → S8 Realtime → S9 Mobile

**S2/S3 申し送り（優先度順）**: ①**[再発防止知見]** PostgREST `select=` に任意 SQL 式不可（カラム名 or generated column / DB 関数のみ）。computed boolean は generated column 化が定石。S3+ の mapper でも厳守。known-issues 起票は別チャット doc整理(`.claude/docs/known-issues/*`)衝突回避で見送り＝本 MEMORY が記録正本 ②**[軽微・別途修正候補]** 0004 冒頭コメントが「APPLY VIA SUPABASE MCP apply_migration — NOT manual SQL Editor paste」と実運用（MCP write 凍結＝SQL Editor 手動）に不整合 ③**[要ユーザー判断]** `get_advisors(security)` に `auth_leaked_password_protection` WARN（dailies 無関係の Supabase Auth 設定・HaveIBeenPwned 照合無効）。完成後/友達配布時判断 ④**[S3 申し送り]** password 設定/解除/lock UI は web DailyView 意図的未実装で S3(TipTap + password/lock dialog 横断)に移譲（ユーザー承認済）。upsertDaily payload 付近に partial-payload 意図コメント追記推奨(Suggestion) / plaintext-equality password の docs/known-issues 化は Phase 後段 / password verify の raw hash クライアント転送は既存債務(悪化なし・将来 RPC security invoker 化案) ⑤**[未解消・要ユーザー]** PAT 露出インシデント止血継続（MCP write 昇格前提=専用組織/write時のみ token/直後 check-rls/破壊的 DDL 人間目視/版固定 未達のため MCP write 凍結維持、migration は SQL Editor 手動）/ upsert read-then-write LWW(S8) / SyncProvider 二重ラップ(S8) / `web/src/TasksScreen.tsx` dead code 要確認 ⑥**[別チャット同居]** `.claude/HISTORY-archive.md.bak` 等は削除/保持ユーザー判断、HISTORY-archive ロール+`.claude/docs/*`+`.claude/2026-*.md`削除+`.mcp.json` は衝突回避で巻き込まず
**サブエージェント分担**: 設計=role-pm / 実装=role-engineer / 監査=role-qa+security-reviewer / 統括=メイン

## 直近の完了

- クロスプラットフォーム移行 Phase 2 S2(Daily) 完了 ✅（2026-05-16）— DAILY_SELECT_COLUMNS の PostgREST 非対応 SQL 式が 400 を誘発し Daily 全 read/upsert 全滅・本番 dailies 0行だった root cause を 0004 generated column 化で構造解消。サブエージェント分担（実装=role-engineer / 監査=role-qa APPROVE W/C + security PASS W/N）。0004 本番再適用済・RLS+generated column MCP 実証・実機 parity green。パス指定 commit（shared dailyMapper / 0004 / .claude tracker）。詳細 HISTORY 参照
- .claude ドキュメント整理（archive 圧縮統合 / HISTORY-archive コンパクト化 / 矛盾修正 / known-issues 新規）✅（2026-05-16）— サブエージェント3並列（archive要約=general / HISTORY圧縮=general / 矛盾調査=general）。archive/ 50ファイル git rm（28プラン+TODO+docs/dropped/rules/vision-tauri）→ `archive/SUMMARY.md`(283行, 元601KB→22KB) に圧縮統合 + vision-tauri 恒久知見抽出。`HISTORY-archive.md` 1257→413行(69%減、`.bak` 退避・コミット対象外)。CLAUDE.md/MEMORY.md/移行SSOT/coding-principles の矛盾 Top3+#3 修正（vision-tauriリンク切れ→SUMMARY張替 / Phase1着手準備中→Phase2進行中 / IPC 3点→4点同期 / MCP 30→32ツール+dismiss系）。known-issues 017(calendar soft-delete/Routine再生成)・018(macOS WebKit button focus)・019(createPortal click-outside)新規 + INDEX更新。Claude Desktop に life-editor MCP 登録（config はリポジトリ外、node 絶対パス）。ブランチ refactor/web-first-v2、パス指定 `.claude/` のみコミット
- クロスプラットフォーム移行 Phase 1 完了 ✅（2026-05-16）— サブエージェント分担（管理=multi-session-coordinator / 設計=role-pm / 実装=role-engineer / 監査=role-qa+security-reviewer / 統括=メイン）。新スタック土台 `web/`(Vite+React+TS+Tailwind4) / `shared/`(DataService+型23 verbatim + SupabaseDataService tasks) / `supabase/migrations/`(0001 tasks+RLS deny-all / 0002 owner-only 4 policy `to authenticated` + `user_id default auth.uid()`) / `supabaseClient.ts`(単一共有=Auth↔DataService 同一 JWT) / `SupabaseAuth.ts` / web/ session ゲート。**完了判定 5/5 達成**: probe 実証で 未認証 0 行 / USER A 自分の 1 行 CRUD / USER B は A の行 0 件・削除 0 件 / `frontend/`(Tauri) `tsc -b`=0 非破壊。0001/0002 は Supabase SQL Editor 適用（CLI 非対話制約回避、Phase5 で CLI 管理へ）。commit `d1abd8a`(R1) + `ce6a5cb`(R2) + tracker `ec540ec`、SSOT 完了判定チェック済。**Phase2 申し送り**: ①新テーブル RLS 漏れの CI 機械検証 ②tsconfig project references 化 ③signOut scope 堅牢化。ブランチ refactor/web-first-v2（別チャット Point Graph と同居・パス指定ステージで分離）

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
