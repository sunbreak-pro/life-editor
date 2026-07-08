# Archive SUMMARY — 圧縮統合インデックス

> **役割（2026-07-08 再定義）**: このファイルは **2026-05-23 以前に `.claude/archive/` 入りした完了済み実装プラン群の索引**。
> 2026-05-24 以降に archive 入りしたファイル（約 30 本）はここには index しない — 各ファイル冒頭の Status 行と git 履歴が正本であり、
> 新規 archive 入りのたびに本索引へ追記する運用は採らない（末尾の「2026-07-05 追加分」等の限定的な追記のみ例外）。
> 各プランの「なぜやったか・どうなったか・恒久知見」のみを残し、実装手順・コードブロック・ファイル表は破棄。
> 詳細な作業履歴は per-chat history（`.claude/history/`）+ git 履歴が担う（旧 `.claude/HISTORY-archive.md` は削除済み）。
> 生成日: 2026-05-16 / 対象: 直下 28 .md + TODO.md + サブディレクトリ (docs/ dropped/ rules/ vision-tauri/)。

凡例: 結果/採否 = `採用` / `却下(Drop)` / `部分採用` / `上書きされた(Superseded)` / `統合済み(Merged/Consumed)`。

---

## グループ A: メタ計画 / 設計定義の統合（最重要 — 現行 SSOT の起源）

### 2026-04-18-integrated-design-roadmap (2026-04-18)

- 目的: 散在していた設計定義（CLAUDE.md / rules / ADR / life-editor-v2 / README / TODO）を CLAUDE.md 13 章へ統合し、全 26 機能を Tier 1-3 で要件定義する 3-Phase ロードマップ。
- 結果/採否: 採用・完遂。Phase A（CLAUDE.md 133→805 行）/ Phase B（requirements/tier-1〜3 作成）/ Phase C（plan 棚卸し + 保留 5 件 Verdict）。**現行の CLAUDE.md・requirements/ 構造の生みの親**。
- Lessons: 「Claude Code が auto-load する唯一のファイル = CLAUDE.md 自体を SSOT にする」「ADR は時点判断で陳腐化するため vision/ に一元化」が確立。

### 2026-04-18-app-redefinition-roadmap (2026-04-18)

- 目的: 「定義 → 要件 → 差分評価」の 3 ステップ戦略の初版。
- 結果/採否: 上書きされた（integrated-design-roadmap に発展統合、枠組みは継承）。

### 2026-04-18-deferred-items-reevaluation (2026-04-18)

- 目的: コードレビュー由来の保留 5 件（I-1/S-2/S-4/S-5/S-6）を「実装 TODO ではなく判断すべき問い」として整理。
- 結果/採否: 統合済み（Consumed）。全 5 件 Verdict 確定 → 後続 Plan/ADR へ移管（I-1 Keep計測→Drop / S-2 Modify ADR-only / S-4 Keep計測→Drop / S-5 Keep / S-6 Keep Option A）。
- Lessons: 「このアプリを半年後に捨てる人が困るか」で Drop 判定する決定フレームワーク。

### TODO.md (2026-03-17)

- 目的: 旧 Roadmap（In Progress / Completed リスト）。
- 結果/採否: 統合済み（CLAUDE.md §13 / §8 に吸収、Phase A-1-7 で廃止確定）。

---

## グループ B: 大規模技術移行（プラットフォーム戦略の変遷）

### 2026-04-29-web-first-migration (2026-04-29)

- 目的: Tauri 2 + Cloudflare → Vite + React + Supabase + Capacitor への Web ファースト移行。
- 結果/採否: 上書きされた（Superseded）。2026-05-04 に `2026-05-04-cross-platform-migration.md`（Electron + Capacitor + Web + Supabase の 3 包装構成）へ全面移行。SSOT は移行 SSOT 側。

### 2026-04-15-tauri-migration (2026-04-15)

- 目的: Electron + Capacitor → Tauri 2.0 移行。SQLite Everywhere / 単一フレームワーク / DataService 統一。
- 結果/採否: 採用・完遂（Phase 0-6 全完了）。ただし現在は web-first 移行で全面的に上書き予定（参考のみ）。
- Lessons: 「rusqlite (raw) > tauri-plugin-sql（prepared statements / PRAGMA / Tx 制御が必要）」「並行ビルド方式で移行期間中も両方動かす」。

### 2026-03-16-mobile-phase2-realtime-sync (2026-03-16)

- 目的: Electron + Hono server 前提の REST 全エンティティ API + WebSocket リアルタイム同期 + Tailscale 外出先アクセス。
- 結果/採否: 統合済み（Merged → tier-1-core.md §Cloud Sync）。基盤が Tauri+CF Workers に変わり、WebSocket push の要点のみ Future Enhancements に記録。

### 2026-03-16-mobile-phase3-offline-standalone (2026-03-16)

- 目的: IndexedDB オフラインキュー + 競合解決 UI + Raspberry Pi 常時稼働 server。
- 結果/採否: 統合済み（Merged → tier-1-core.md §Cloud Sync）。Tauri SQLite ローカル SSOT でオフライン自動達成、conflict resolution(LWW) のみ記録。

### vision-tauri/mobile-porting.md / mobile-data-parity.md / ios-everywhere-sync.md / realtime-sync.md / README.md

- 目的: Tauri iOS 移植・データパリティ・無料署名運用・Cloud Sync リアルタイム化の旧 vision 群。
- 結果/採否: 上書きされた（web-first 移行で前提消滅、Capacitor / Supabase Realtime で置換）。README.md が失効理由を一覧化済み。
- Lessons（mobile-data-parity）: 「Provider 経由 vs DataService 直呼びの二系統化」が Desktop/Mobile 非対称バグの構造的原因。単一データソース原則 + Repository 関数名にフィルタ条件を込める規約として後続実装で結実。

---

## グループ C: Mobile / iOS 実装（Tauri 時代、現在 web-first で上書き予定）

### 2026-04-22-memos-to-daily-rename (2026-04-23)

- 目的: `memos` テーブル含む全層を Daily に統一リネーム（DB V64 / IPC / MCP Hard break / Cloud D1 / Frontend）。
- 結果/採否: 採用・完遂。`time_memos`（task 補足メモ）とは別概念として境界明示。MCP `get_memo`/`upsert_memo` → `get_daily`/`upsert_daily`。
- Lessons: 「DB 境界で naming flip 許容（`daily_repository` が `FROM memos` する）でコード認知改善の 9 割を低コスト達成」→ 後に完全リネームへ昇格。

### 2026-04-21-memos-to-daily-rename (2026-04-22)

- 目的: 上記の前身（DB と time_memos を除外、コードシンボルのみ rename する保守版）。
- 結果/採否: 上書きされた（DB 含む完全版 2026-04-22 版に発展）。

### 2026-04-22-ios-refactor (2026-04-22)

- 目的: iOS sync 反映不具合の root cause 特定 + Phase B Provider 統一の再適用 + MobileNoteView/NotesView 重複抽出。
- 結果/採否: DRAFT（Phase B 一度ロールバック commit 43eedf8 → 再 land 計画）。後続の phase-c-d で実質消化。
- Lessons: 「iOS で Desktop 変更が同期されない不具合は Provider 統一の土台を壊す → sync 修正と Provider 統一は同一 PR で land」。

### 2026-04-21-ios-refactor-phase-c-d (2026-04-22)

- 目的: Mobile Data Parity Phase C（Repository 命名整理）+ Phase D（再発防止 Lint）+ 肥大コンポーネント分割。
- 結果/採否: 採用・完遂。`fetch_by_date`→`fetch_by_date_active` 等の命名規約、Mobile 配下 `getDataService()` 直呼び検出 ESLint ルール、経路差分統合テスト。
- Lessons: Repository 関数名にフィルタ条件（active/all/dismissed）を込める規約を coding-principles.md §5 に恒久化。

### 2026-04-20-mobile-data-parity-phase-a-b (2026-04-20)

- 目的: Schedule/Notes/Memos の Desktop/Mobile 取得経路の非対称を観測 → Provider 経由統一。
- 結果/採否: 採用・完遂。Known Issue 009 起票→Fixed。`fetch_by_date_range` に `is_dismissed=0` 追加で Desktop と対称化。
- Lessons: 「観測 → 定量化 → 是正」順を徹底（先に差分を数値化しないと修正方針が曖昧化）。

### 2026-04-21-routine-dup-fix (2026-04-22)

- 目的: iOS で同一 Routine が同時間帯に複数重複表示されるバグ（Cloud D1 に 1,180 行重複蓄積）の根本修正。
- 結果/採否: 採用・完遂。Known Issue 011 起票。
- Lessons（重要）: 多段 root cause — (1)`schedule_items` に `UNIQUE(routine_id, date)` 欠落 (2)Sync 衝突解決が `id` 単独 (3)Frontend 冪等性不足 (4)Rust create() ガードなし。**部分 UNIQUE index（`WHERE is_deleted=0`）+ destructive 操作は SELECT プレビュー必須**。

### 2026-04-18-mobile-schedule-work-redesign (2026-04-18)

- 目的: Claude Design 配布バンドル基準で Mobile Schedule/Work を chip インライン + ボトムシート + タイムグリッドへ刷新。タブ 4 統合（Calendar 廃止→Schedule 配下）。
- 結果/採否: 採用・完遂（コード + 自動検証完了、手動 UI 検証は別途）。

### 2026-04-17-ios-safe-area (2026-04-18)

- 目的: iOS の status bar / home indicator がヘッダー/タブバーと重なる問題を `env(safe-area-inset-*)` で解消。
- 結果/採否: 採用・完遂（Step 1-3 実装、Step 4 CSS 変数 fallback は不要と判断 Skip）。
- Lessons: Desktop ブラウザでは `env()` が `0px` fallback するためデスクトップ無影響。

### dropped/2026-04-14-capacitor-ios-standalone (2026-04-14)

- 目的: Capacitor + WKWebView で iOS スタンドアロン化（StandaloneDataService）。
- 結果/採否: 却下（Drop）。Tauri 2.0 Mobile 採用でコード一本化できるため不採用。

---

## グループ D: リファクタリング / 構造改善

### 2026-04-25-refactoring-plan (2026-04-26)

- 目的: 構造的負債（1000+ 行コンポーネント 5 件 / migrations.rs 2431 行 / Provider 16 層）の Phase 0-3 段階リファクタ。
- 結果/採否: 採用・完遂（Phase 0-3 全 Step）。migrations.rs 6 分割 / TauriDataService 1502→52 行 / row_to_model FromRow trait 化 / Issue 012 pagination 本実装 / Schedule→ScheduleList rename。
- Lessons: 「計画の前提（formatter 18 箇所 / UNIQUE 不足）が古い情報のことが多い → 着手前に実コード精査」。完全 UI 統合より純粋ロジック抽出の保守的アプローチを採用（regression リスク回避）。

### 026-comprehensive-frontend-refactoring (2026-04-05)

- 目的: dead code 除去 + Schedule 構造整理 + Context Pattern A 統一 + ScheduleProvider 3 分割。
- 結果/採否: 採用・完遂。**現行の Pattern A / Schedule 3 分割（Routine/ScheduleItems/CalendarTags）/ shared/ 配置規約の起源**（当時 ADR 0002-0004、現 CLAUDE.md §6.3-6.5）。

### 2026-04-11-app-optimization (2026-04-11)

- 目的: 機能整理 + パフォーマンス改善（セクション切替の遅延解消）。
- 結果/採否: 採用・完遂。Tips 削除（15 ファイル）/ React.lazy セクション遅延ロード / useScheduleItems 4 分割。Provider 遅延初期化のみ Skip（機能破壊リスク）。

### 024-task-memo-tree-refactor (2026-03-08)

- 目的: タスクツリー DnD 改善 + Inbox/Projects 二分割廃止 + MemoTree 新設。
- 結果/採否: 採用・完遂。DnD zone 比率 25/50/25 統一。

### 2026-04-18-context-hook-optional (2026-04-18, S-6 由来)

- 目的: `createOptionalContextHook` 新設で Mobile 省略 6 Provider の共有コンポーネント呼び出しをクラッシュさせない。
- 結果/採否: 採用・完遂。**現行 CLAUDE.md §6.3 Optional バリアント規約の起源**。
- Lessons: 必須 hook は Provider 外で throw / Optional hook は null 返し + `if(!ctx)return null` ガード。

### 2026-04-18-service-error-handler-hook (2026-04-18, S-5 由来)

- 目的: 分散した `catch{console.warn}` を `useServiceErrorHandler()` に統一（silent failure 解消）。
- 結果/採否: 採用・完遂。rate limit 5 秒 dedup + i18n `errors.*` + TimerContext/SyncContext/MobileCalendarView 移行。

### dropped/2026-04-18-folder-progress-batch-memo (2026-04-18, S-4 由来)

- 目的: `computeFolderProgress` の O(n^2) 一括計算化（計測前提）。
- 結果/採否: 却下（Drop）。実測 F=100xT=50 で max 4.58ms（しきい値 50ms の 1/10）。React Compiler も不要。
- Lessons: 再計測トリガー（総ノード 10,000 超 / Profiler 50ms 超）を明記して Drop。

### dropped/2026-04-18-tasks-fetch-by-range (2026-04-18, I-1 由来)

- 目的: sync 完了時の `fetchTaskTree()` 全件取得を range fetch 化（計測前提）。
- 結果/採否: 却下（Drop）。実測 n=3000 で max 25ms、iOS 5x 補正でも ~125ms（しきい値 500ms 未達）。
- Lessons: 再計測トリガー（実タスク 5000 超 / row_to_node 重処理追加時）を明記して Drop。

---

## グループ E: 機能追加 / バグ修正

### 2026-05-13-point-graph-connect-node (2026-05-16)

- 目的: Connect/Node タブの React Flow `TagGraphView`(1438 行) を d3-force Canvas `PointGraphView` へ置換。タグも独立ノード化。
- 結果/採否: 採用・完遂（全 12 ステップ + パネル閉じる/Connect廃止/perf HUD 削除の追補）。
- Lessons: Canvas 2D は CSS クラス不可 → `getComputedStyle` で notion-\* CSS 変数を描画前解決 + MutationObserver でテーマ追従。daily id 形式不整合（`daily-` vs `memo-`）に注意。

### 2026-05-12-calendar-display-integrity (2026-05-13)

- 目的: Calendar の isDeleted filter 漏れ + Routine 同期削除導線不足 + Progress 月次集計の 3 修正。
- 結果/採否: 採用・完遂。
- Lessons: `useCalendar.ts:tasksByDate` が status のみ filter で soft-deleted task が残存（`!isDeleted` 追加）。Routine 削除し忘れると `ensureRoutineItemsForDateRange` が schedule_items を再生成して「消えない」現象。

### 2026-04-25-routine-group-migration (2026-04-25)

- 目的: Routine ↔ Tag ↔ Group の三角関係を廃止し Routine→Group 直接所属（V69）に再設計。`frequencyType="group"` 追加。
- 結果/採否: 採用・完遂。複数 Group 所属時は OR 評価。**現行 V69 migration の起源**。

### 2026-04-25-sidebar-tags-free-pomodoro (2026-04-25)

- 目的: Sidebar Links（URL/Mac アプリ快速リンク）+ CalendarTags UI 化 1:1 + Pomodoro Free モード + WikiTag 未登録フィルタ の 4 件同時着手（V65/V66/V67）。
- 結果/採否: 採用・完遂（Phase A/B/C/D 全完）。**現行 sidebar_links / calendar_tag_assignments 1:1 / timer_sessions.label の起源**。

### 2026-04-24-014-server-updated-at-cursor (2026-04-24)

- 目的: Cloud D1 に `server_updated_at` 列を導入し delta cursor を client 時計から切り離す（Issue 014 本命修正）。
- 結果/採否: 採用・完遂。Worker `/sync/push` を 2 文構成（UPSERT + 常時 server_updated_at UPDATE）に変更。
- Lessons（重要）: **「version LWW で push が棄却されても server_updated_at は常に更新する」=「rejected push でも cursor を進める」**。これがないと棄却後の次回 pull で永久に同期されないデッドロックが発生。

### 023-cmux-terminal-features (2026-03-08)

- 目的: cmux 参考の Socket API / 通知 / マルチエージェント / ブラウザペインの 4 フェーズ ターミナル強化。
- 結果/採否: 統合済み（Merged → tier-1-core.md §Terminal Future Enhancements）。分割ペイン/タブ UI のみ中期項目化、Socket API 系は Tier 1 Boundary と矛盾のため別扱い。

### 025-life-editor-ui-ux-refactor (2026-03-09)

- 目的: Obsidian/Notion 風 UI/UX 洗練（Modern Monochrome テーマ / タグ UI / タイポ統一）。
- 結果/採否: 統合済み（Merged → CLAUDE.md §1-5 / tier-2-supporting.md の Theme/Shortcuts/Toast）。Electron 版時代の分析のため単独 Plan は重複。

### 2026-04-29-claude-desktop-style-chat-ui (2026-04-29)

- 目的: アプリ内 Terminal の CLI を Claude Desktop 風チャット UI（吹き出し + ツール折り畳みカード）に置換するコンセプト。
- 結果/採否: 上書きされた（CONCEPT のまま archive。web-first 移行で旧 Vision 前提が反転）。
- Lessons: Subscription-First（鍵を預からない）/ CLI-as-Backend / 構造化ストリーム優先（ANSI パースは設計負債）/ 既存資産再利用 の 4 原理。

### dropped/019〜022-phase1〜4 (2026-02-22 起案、2026-04-18 Drop)

- 目的: コードレビュー由来の security/data-integrity/architecture/quality の 4 Phase 修正（Electron アーキテクチャ前提）。
- 結果/採否: 却下（Drop）。Tauri 2.0 migration で対象ファイル消失、3 ヶ月放置（commit 1 件）。論点は CLAUDE.md §6/§9 + コードレビュー（Blocking 3/Important 5 修正済）に吸収。

---

## サブディレクトリ評価

### `docs/life-editor-v2/`（5 ファイル: 00-vision / 01-terminal / 02-mcp-server / 03-claude-setup / 04-ui-adjustment）

- 中身: life-editor v2 化の Phase A 計画書群（Wails v1 の教訓、Terminal/MCP/Claude セットアップ/UI 調整の設計案）。
- 推奨アクション: **SUMMARY に統合済みで削除可**（要点は integrated-design-roadmap 経由で CLAUDE.md §6.5/§8.1 に吸収済み、本 SUMMARY グループ A で経緯記録済み）。歴史的価値はあるが現役参照不要、git 履歴でカバー可能。

### `dropped/`（7 ファイル: 019〜022 / capacitor-ios-standalone / folder-progress-batch-memo / tasks-fetch-by-range）

- 中身: Phase C / 計測判定で Drop 確定したプラン。各ファイル冒頭に Drop reason 明記済み。
- 推奨アクション: **SUMMARY に統合済みで削除可**（グループ C/D/E に Drop 根拠 + 計測しきい値 + 再計測トリガーまで圧縮済み）。

### `rules/`（3 ファイル: project-debug / project-patterns / project-review-checklist）

- 中身: 旧プロジェクトローカル rules。
- 推奨アクション: **SUMMARY に統合済みで削除可**（integrated-design-roadmap Phase A-1 で CLAUDE.md §6.3-6.5/§7.2/§7.5 に全文吸収済みと明記、現行 CLAUDE.md が上位互換）。

### `vision-tauri/`（5 ファイル: mobile-porting / mobile-data-parity / ios-everywhere-sync / realtime-sync / README）

- 中身: web-first 移行で前提消滅した旧 Tauri vision 群。README.md が失効理由を一覧化。
- 推奨アクション: **削除済み**（2026-05-16、ユーザー判断で全削除）。Tauri 固有手順は web-first 移行で完全に失効。アーキ非依存の恒久知見のみ下記「## vision-tauri 恒久知見（削除前抽出）」に圧縮済み。逐語原文が要る場合は git 履歴（`git show HEAD~:.claude/archive/vision-tauri/<file>`）から復元可能。

---

## vision-tauri 恒久知見（削除前抽出）

Tauri/Cloudflare 固有部分は破棄。web-first（Supabase + Capacitor）後も生きる設計原則・プラットフォーム制約のみ残す。

### 単一データソース原則（mobile-data-parity.md §4 — アーキ非依存）

- 画面コンポーネントは **Provider を Single Source of Truth** として `useXxxContext()` 経由で購読する。データ層の直呼びは Mobile 省略 Provider 領域に限定。
- 同一論理データの取得経路を二系統化しない（Desktop=Provider 経由 / Mobile=直呼び の非対称が Schedule Events 欠落・編集反映ズレを生んだ実例あり）。
- 取得要件（`is_deleted` / `is_dismissed` / routine 由来除外 等）は**関数名で明示**し、コメント依存にしない。経路差分は fixture 同一の統合テストで検知する。
- → known-issues 化候補 #5。Supabase 単一実装で構造的には消えるが「Provider を SSOT に」「経路を増やさない」は移行後も再発防止知見として有効。

### 無料 Apple ID 署名の制約（ios-everywhere-sync.md — Capacitor iOS でも有効）

- 無料 Apple ID（Personal Team）: 署名有効期限 **7 日** / 同時 **3 App ID/端末** / 新規 **10 App ID/7日** クールダウン / 配布不可（自分の端末のみ）/ Bundle ID 固定必須（頻繁変更で 10/7日 枠を消費し再署名が詰まる）。
- Apple Developer Program 非加入（コスト $0 方針）を続ける限り「7 日ごと再署名」は Capacitor iOS でも残る運用前提。TrollStore は iOS 17.0.1+ で不可のため非採用。

### Realtime 同期のレイテンシ目標（realtime-sync.md — Supabase Realtime で再評価）

- 旧 polling 30s（往復最悪 60s）の体感ラグが課題だった。**体感目標: 編集 → 相手端末で 2〜5 秒以内**（往復 6〜10s 以内）。
- 旧案（foreground 可変 polling + mutation 後 debounced trigger）は Supabase Realtime 採用で根本不要。ただし上記の達成目標値は移行後の Realtime 実装でも判定基準として流用可。CRDT 共同編集は N=1 では過剰（Non-Goal 維持）。

---

## ⚠️ 要 known-issues 化候補

各プラン内の Root Cause / 再発防止知見のうち、`.claude/docs/known-issues/` に未収載と思われるもの。知見喪失防止のため列挙（親が INDEX.md と照合して判断）。

1. **2026-04-24-014-server-updated-at-cursor**: 「version LWW で push 棄却 → server_updated_at 未更新だと棄却後の次回 pull で永久に同期されない」デッドロック。→ Issue 014 として既存（Status Fixed のはず、確認推奨）。
2. **2026-04-21-routine-dup-fix**: schedule_items の `UNIQUE(routine_id, date)` 欠落 + Sync 衝突解決 id 単独 + Frontend 冪等性不足の多段 root cause。→ Issue 011 として既存（確認推奨）。
3. **2026-05-12-calendar-display-integrity**: `useCalendar.ts:tasksByDate` が status のみ filter で soft-deleted task 残存 / Routine 削除し忘れで `ensureRoutineItemsForDateRange` が schedule_items 再生成し「消えない」現象。→ **未収載の可能性が高い。新規 known-issue 化候補**。
4. **2026-04-20-mobile-data-parity / phase-c-d**: Provider 経由 vs DataService 直呼びの二系統化による Desktop/Mobile 非対称バグ。→ Issue 009/010 として既存（確認推奨）。
5. **vision-tauri/mobile-data-parity.md §2**: 同上の構造的非対称（Provider バイパス / クエリ語彙不一致 / is_dismissed フィルタ差）。設計原則 §4 が known-issues の再発防止知見として未抽出の可能性。→ **vision/ または known-issues への移管検討候補**。
6. **2026-04-15-tauri-migration**: 「rusqlite raw > tauri-plugin-sql」の判断根拠。→ web-first 移行で陳腐化のため known-issues 化は不要（参考のみ）。

> 注: 1/2/4 は対応する Known Issue 番号が各プラン冒頭で参照されており既収載の可能性が高いが、SUMMARY 作成時点で INDEX.md 本体未照合のため候補として残置。3 と 5 は新規収載を強く推奨。

---

## 2026-05-23 追加分（cleanup-and-consolidation Phase 1 で archive）

> 追加日: 2026-05-23 / 追加者: `refactor/cleanup-and-consolidation` ブランチ
> 経緯: Web ファースト移行（refactor/web-first-v2）進行中に蓄積した完了済み plan のうち、`.claude/docs/vision/plans/` に残置されていたものを定期整理。
> 詳細手順は `archive/2026-05-23-cleanup-and-consolidation.md`（本計画書、本セッション完了後に archive 予定）参照。

### 2026-05-17-notes-web-parity (2026-05-17)

- 目的: Phase 2 S3 Notes（lean web 版）の実ブラウザ評価で判明したバグ 4 件修正（①タイトルフォーカス ②Trash 表示 ③PW ゲート ④Folder 削除）+ forward-port #1#2#3 適用。
- 結果/採否: 採用・完遂（PR1 COMPLETE）。実装 commit=02c9045 / role-qa 独立監査 PASS=2026-05-17。PR2 以降の Backlog (⑤-⑧) は本ファイル内に記録のまま archive。
- Lessons: 「並行チャット同居時の forward-port は親計画書 + 自レーン SSOT の二重化で守る」「実ブラウザ評価でしか拾えないバグの存在（フォーカス管理 / モーダルガード）」。

### 2026-05-17-s4-schedule-migration (2026-05-17)

- 目的: Phase 2 S4 — Schedule ドメイン Web 移植（最大規模・最後）。6 テーブル + Routine→schedule_items 生成器 + Schedule 3 分割 Provider。Option A アーキ（shared は context/hooks/services/types/utils のみ UI フリー）。
- 結果/採否: 採用・完遂（COMPLETE — S4-0〜S4-6 全完了 + 0006 本番 apply 成功・手動確認 OK / 2026-05-17）。Verification 全項目クリア。次フェーズは Data Unification (旧 S5 WikiTags は DU 計画に吸収)。
- Lessons: 「MCP write 凍結中はユーザー手動 SQL Editor + MCP read-only で検証可能」「Known Issue 008/011/017/020 が再発しない設計（UNIQUE 論理キー + 冪等 generator + ロール識別）」「Schedule 3 分割 Provider は web/ 側のリーン UI と接続するときの境界が hooks/services レベル」。S8 delta 申し送り 6 項は archive ファイル本体に保持。

### 計画書状況スナップショット (2026-05-23 時点)

`.claude/docs/vision/plans/` 現役 13 plan + 1 (本計画書):

| 計画書                                             | Status (実態)                             | Branch                               | 種別         |
| -------------------------------------------------- | ----------------------------------------- | ------------------------------------ | ------------ |
| 2026-05-16-phase2-core-migration.md                | NOT STARTED                               | refactor/web-first-v2                | 移行本体     |
| 2026-05-16-phase5-giant-component-decomposition.md | Carry-over 未着手                         | refactor/web-first-v2                | 品質清算     |
| 2026-05-16-frontend-refactor-pre-migration.md      | In-progress (Phase 3-1/3-2 着手)          | refactor/web-first-v2                | 品質清算     |
| 2026-05-16-reminders-rich-editor-connect.md        | IN PROGRESS (要件3完了 / UI 系保留)       | claude/plan-reminders-editor-LzZ8E   | 機能追加     |
| 2026-05-17-ui-ux-quality-remediation.md            | In-progress (M0 完 / M1 進行)             | refactor/web-first-v2                | UI 清算      |
| 2026-05-21-data-unification-items-meta.md          | PLANNING v3                               | data-unification/items-meta-redesign | DU 親        |
| 2026-05-23-data-unification-b-tasks.md             | DRAFT v3-rev3 (再 apply 待ち)             | data-unification/items-meta-redesign | DU-B 子      |
| 2026-05-23-data-unification-b3-onwards-impl.md     | DRAFT (次セッション着手用 SSOT)           | data-unification/items-meta-redesign | DU-B 詳細    |
| 2026-05-23-filechanged-comm-watch.md               | DRAFT (Phase 0 着手前)                    | 未定                                 | comm 拡張    |
| 2026-05-23-memory-history-per-chat-split.md        | DRAFT (Phase 0 着手前)                    | 未定                                 | tracker 拡張 |
| 01*要件定義書*プロトタイプ環境.md                  | SPECIFICATION                             | prototype/mobile-ui                  | プロトタイプ |
| 02*実装計画書*プロトタイプ環境.md                  | NOT_STARTED                               | prototype/mobile-ui                  | プロトタイプ |
| 2026-05-23-cleanup-and-consolidation.md            | IN PROGRESS (Phase 1-4 完了 / Phase 5 残) | refactor/cleanup-and-consolidation   | 整理レーン   |

---

## 2026-07-05 追加分（W-parity roadmap closeout・#154）

- **W-parity ロードマップ + 子計画 6 本を archive**（`2026-06-07-web-desktop-parity-roadmap` 親 / `2026-06-14-web-parity-w4-analytics-connect`・`-w4-analytics`・`-w4-connect`・`2026-06-15-web-parity-w5-app-shell`・`2026-06-18-web-parity-w7-task-detail`・`2026-06-19-web-parity-w8-schedule-calendar`）。全 Status = COMPLETED。
- 結果/採否: 採用・完遂（W0–W8 実装マージ済）。W4 の並行 2 レーン（-analytics / -connect）は -analytics-connect に統合実装（Superseded）。**Web/Mobile UI の追跡正本は後継の ClaudeDesign fan-out 計画（`docs/vision/plans/2026-07-04-claudedesign-screen-design-fanout.md`）へ一本化**し、parity Epic #121 / W4 #127 を決着（二重管理の解消）。
