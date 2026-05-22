# MEMORY.md - タスクトラッカー

## 進行中

### 🔧 Data Unification — Schedule items_meta + payload 再設計（着手日: 2026-05-21、ステータス: PLANNING・親計画書 v3 承認済み）

**対象**: `.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md`（親計画書 v3・承認済 `dcc8484`）/ 実装は `supabase/migrations/0007+`（0007_drop_legacy_item_tables + 0008_data_unification_schema）+ `shared/src/` + `web/src/`（DU-A 着手後）
**計画書**: `.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md`（v3、role-qa 3 周監査済）
**ブランチ**: `data-unification/items-meta-redesign`（`refactor/web-first-v2` から分岐・push 済）

- 前回: 親計画書 v3 完成（lead-pipeline 重ティアフルチェーン: session-manager→role-pm→計画書→role-qa 3 周監査 15+7+2 項全解消）+ Phase 2 を web-first-v2 に FF マージ + 新ブランチ作成
- 現在: **計画書策定完了・実装未着手**。Q1-Q15 確定。DB=ハイブリッド（items_meta + 5 payload + 7 専用/relation = 13 テーブル）/ role 5 種厳守（task/event/routine/note/daily、変更不可）/ Calendar=月+3 日 2 ビュー（Dayflow 廃止）/ RoutineGroup・WikiTag・wiki_tag_groups=専用テーブル / 既存データ破壊的リセット（calendars 系 3 テーブルは Phase 2 維持）
- 次: **DU-A（DB スキーマ apply）着手の最終承認**（= Supabase 破壊的 apply の二段承認）→ DU-A 子計画書を code-plan-editor で作成 → 実装。Phase 順: DU-A(DB)→DU-B(Tasks)/DU-C(Events+Routine)/DU-D(Notes+Daily)→DU-E(Calendar)→DU-F(WikiTag/Link)

**設計の核**: Schedule 系を unified-item モデルへ再設計。`items_meta`（共通メタ: id/role/title/timestamps/sync 列）+ 種別 payload（専用列厚く・JSONB は Notes/Daily content_json のみ）の 2 層。WikiTag/WikiLink を items_meta 上で一元グラフ化（Obsidian 思想）。Phase 2 S3/S4 コードは全捨て（Provider Pattern A 構造・routineFrequency/routineScheduleSync 純粋関数のみ流用）。
**申し送り**: ①MCP Server 16 ツール書き換えは本計画では凍結（後続「MCP catch-up plan」）②WikiLink グラフ可視化 UI も別計画（backlink list のみ実装）③`origin/refactor/web-first-v2` push は保留（並行 chat-refactor 共有ブランチ要調整）④S8 Realtime/delta sync 申し送りは Data Unification でも継承
**サブエージェント分担**: 設計=role-pm（計画書）→ code-plan-editor（子計画書ファイル化）/ 実装=role-engineer（Phase 進行時）/ 監査=role-qa+security-reviewer+life-editor-migration-validator（DU-A SQL 作成時）/ 統括=メイン

## 直近の完了

- Data Unification 親計画書策定（旧 Phase 3 改名）+ Phase 2 完全クローズ + ブランチ準備 ✅（2026-05-23）— Schedule 再設計の親計画書 v3 を lead-pipeline 重ティアフルチェーンで策定（role-qa 3 周監査 15+7+2 項全解消）。items_meta + payload ハイブリッド 13 テーブル / role 5 種統一 / Calendar 月+3 日 2 ビュー。Phase 2 を `refactor/web-first-v2` に FF マージ → 新ブランチ `data-unification/items-meta-redesign` 作成。計画書 `dcc8484` + HTML ビュー派生。実装未着手（DU-A 着手は破壊的 apply 二段承認後）。詳細 HISTORY 参照
- Phase 2 S4 完全クローズ（0006 apply 成功 + 実ブラウザ 2 バグ修正）✅（2026-05-19）— 0006 本番 apply 成功・手動確認 OK。実ブラウザ判明の 2 バグ修正: バグ1=Calendar FK 違反を folder-type task select 化(TaskTreeProvider 追加)で構造解消 / バグ2=Routine item 復活(Issue 017)を Delete/Trash 導線非表示+Dismiss 主導線化で構造的遮断。role-qa PASS、保護領域 diff0、vitest 71/71 非回帰。`297ead6`。詳細 HISTORY 参照 **注: Data Unification に吸収（コード全捨て、Provider/UI 構造は実装パターンだけ参考）。**
- Phase 2 S4 Schedule 移植 コード完了 ✅（2026-05-17）— 子ブランチ `phase-2/schedule-migration` で S4-0〜S4-6 の 7 サブステップ実装。0006(7テーブル)+mapper7+DataService7+Provider+Routine 生成器。各サブ role-qa PASS、vitest 71/71・非破壊。詳細 HISTORY 参照 **注: Data Unification に吸収（コード全捨て）。**

## 予定

> **注**: 2026-05-17 に旧 Tauri / Cloudflare 前提の陳腐化タスクを一括削除済（Q2 Cloud Sync 検証 / リファクタ検証計画 / Realtime Phase1(frontend SyncContext) / Mobile Full Re-sync ボタン(frontend) / Desktop パッケージ更新(cargo tauri) / orphan DB(実施済) / iOS 実機受入 / iOS 4G / Mobile Schedule 手動検証(新リデザイン計画へ) / frontend lint 一括 / Point Graph 継続FB / Tauri IPC naming。逐語は git 履歴）。残置は移行後も有効なもののみ。

### Mobile vs Desktop 設計方針の docs/vision/ への明文化

**対象**: 新規 `.claude/docs/vision/mobile-design.md`（仮名）
**背景**: 2026-05-12 セッションで CLAUDE.md §2 Platform に直接追記したが working tree から消失（並行チャットまたはリンターによる巻き戻しを推定）。CLAUDE.md は 400 行以下目標 + 「新機能は §8 + docs/requirements/」が原則のため §2 直接追記は不適切、`docs/vision/` 配下の独立ファイル化が筋。本セッションで取りまとめた内容:

- Desktop = クリエイティブ重視、Mobile = コンパクト重視
- Mobile 必須セクションは Schedule (予定/タスク/ルーティン) / Work (標準ミュージックのみ、カスタム音源追加は Mobile では非対応) / Notes (デイリー/ノート) / Settings の 4 つだけ
- Mobile は Desktop の縮小コピーではなく専用に再設計
- スラッシュコマンド・タグ付けは Mobile でも 1〜2 タップで到達できるよう設計

**手順**: `mobile-design.md` 新規作成 → CLAUDE.md §2 末尾に 1 行リンク追加 → `2026-05-04-cross-platform-migration.md` と相互リンク。並行チャットとの衝突回避のため、編集前に `.claude/comm/outbox/` で予告するか multi-session-coordinator でロック取得を検討

### Mobile 追加機能要件の残タスク（Capacitor Mobile・要再仕分け）

**性質**: Tauri-iOS 期に積んだ Mobile 機能要件。コンポーネント実体（旧 frontend `NoteTreeNode` 等）は移行で再実装されるため、**実装パスでなく「機能要件」だけを backlog として保持**。Capacitor Mobile 移行（移行 SSOT Phase 3）着手時に web/shared 文脈へ再仕分けする。
**保持する機能要件**:

- **行スワイプ (edit / pin / delete)**: Notes ツリー行の touch-UX。DnD と両立する操作設計が必要
- **TipTap slash command + empty line hint**: スラッシュコマンド + 空行ヒントのポップオーバー
- **Calendar filter / sort**: role multi-select + sort（drawer 内 filter sheet 想定）
- **ScheduleItemForm 5-role 対応**: event 専用から 5-role 選択対応へ

> 旧参照 `~/.claude/plans/life-editor-note-ios-calm-moth.md`（Tauri-iOS 期・user-global）は移行後の SSOT ではない。再仕分け時は移行 SSOT Phase 3 + `docs/vision/plans/` の Mobile リデザイン計画（01/02）に統合する。

### 保留（将来再評価）

- **React Compiler 有効化**: アーキ非依存（React 19 + Vite は移行後も継続）。移行後 shared/web で有効化するかは独立の技術判断。旧「S-4 Drop 判定で切り離し」文脈は失効（旧リファクタ計画）

## バグの温床 / 今後の注意点(2026-04-23 更新)

以下は本 session で顕在化した構造的な脆弱性。同類のバグが再発する可能性が高い領域として記録。DB 系の再発防止ルールは [`docs/vision/db-conventions.md`](./docs/vision/db-conventions.md) に集約:

> 整理メモ（2026-05-17）: Cloudflare D1 / wrangler / Tauri-Xcode 専用の陳腐化 10 項目を削除（旧 c=D1/Desktop 同一テーブル前提・d=Cloud deploy×D1 タイミング・g=/sync/changes pagination 半実装・h=D1 compound SELECT 5本・i=wrangler d1 引数・j=client/server has_more flag・m=Xcode ⌘R×Tauri・n=Xcode PATH cargo・o=Desktop パッケージ V64 乖離・p=iOS/Cloud 三者不整合）。逐語は git 履歴。残置は移行後も有効な恒久知見のみ。なお f/k は Supabase 文脈への書換候補（報告のみ・未着手）

- **timestamp 形式混在（Known Issue 013）**: SQL 内 `datetime('now')` と `new Date().toISOString()` / `helpers::now()` が同じテーブルに書き込まれ、スペース区切り vs ISO 8601 の混在で sync 文字列比較が壊れる。ASCII 順 space(0x20) < T(0x54) のため一度 since が ISO になると同日 space 行が永久に push から漏れる。恒久教訓: 書き込み側を ISO 8601 に統一（Supabase 移行後も timestamp 形式統一は厳守）
- **delta sync が updated_at 単調性に依存（Known Issue 013、旧 014 統合分）**: 高 version + 古 updated_at の行が居座ると `WHERE updated_at > since` では永久に pull されない。恒久教訓: delta cursor は client 時刻でなく server 側単調増加列（Supabase 移行後は `server_updated_at` 相当）に置く。※「Known Issue 014」は INDEX 統合履歴で 013 に吸収済の番号（2026-04-25）
- **論理的一意性を持つテーブルの UNIQUE 制約**: schedule_items で発覚したが、tasks / dailies / notes / routines も同じ「`id` PK のみで論理キー UNIQUE 無し」。特に複合キー relation（旧 `routine_tag_assignments (routine_id, tag_id)` 型）は要再点検。Supabase 0006 でも `schedule_items (routine_id,date)` partial UNIQUE として継承（Issue 011）
- **sync 衝突解決が ID 単独**【Supabase 文脈へ書換候補・未着手】: `ON CONFLICT(id)` + version 比較の LWW は複合キー衝突(異 id 同 payload)を検知できない。Supabase upsert-on-id でも該当（Issue 020 read-then-write レースと同根）
- **Mobile UI の機能欠落(Full Re-sync)**【Supabase 文脈へ書換候補・未着手】: Desktop と Mobile で sync workaround の実装差分があり障害時に Mobile で詰む。Supabase Mobile Settings 移植時に解消要（予定[7]と重複）
- **`tsc --noEmit` at frontend root は無意味**: solution-style tsconfig(`files: []` + references のみ)で実際の型チェックが走らない。`tsc -b` または `npm run build` を使う（アーキ非依存・shared/web でも同型。session-verifier skill / CLAUDE.md §7.1 に記録済）
