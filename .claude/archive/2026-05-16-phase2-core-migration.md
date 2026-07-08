---
Status: COMPLETED — S0/S1/S2/S3/S4 コード完了。移行 SSOT が Phase 2 完了を宣言済みのため本計画書はクローズ。S5 WikiTags は後続 Data Unification レーンへ吸収（superseded）。S4 詳細・S8 申し送りは `2026-05-17-s4-schedule-migration.md`。アーキ実態は Option A（下記 S3 注記参照）
Created: 2026-05-16
Task: クロスプラットフォーム移行 Phase 2 — コア機能のフロントエンド移植
Project path: /Users/newlife/dev/apps/life-editor
Branch: refactor/web-first-v2
SSOT: .claude/2026-05-04-cross-platform-migration.md（Phase 2 節 = この計画書の親）
Depends on: Phase 1 完了済み（commit d1abd8a / ce6a5cb / tracker cefad9a 他、2026-05-16）
---

# Plan: クロスプラットフォーム移行 Phase 2（コア機能移植）

> これは次セッション開始時にこれを読めば文脈ゼロから再開できる引き継ぎ計画書。
> 全体 SSOT は `.claude/2026-05-04-cross-platform-migration.md`。本書はその Phase 2 を実行可能タスクに分解したもの。

## Context

### Phase 1 で確定した現状（再開時の前提）

- `refactor/web-first-v2` 上に新スタック土台が**コミット済み**:
  - `web/` — Vite + React 19 + TS + Tailwind 4。`npm run dev`(5173) / `tsc -b` / `eslint` / `vite build` すべて green
  - `shared/` — `@life-editor/shared`。`services/DataService.ts`（約200メソッド interface、`frontend/` から byte 一致 verbatim コピー）+ 依存型 23 ファイル + `SupabaseDataService.ts`（**tasks 4 メソッドのみ実装**、他は Proxy で `not implemented in phase 1` throw）+ `supabaseClient.ts`（モジュール単一インスタンス＝Auth と DataService が同一 JWT 共有）+ `SupabaseAuth.ts`
  - `supabase/migrations/` — `0001_initial.sql`（tasks + RLS deny-all）/ `0002_rls_tasks.sql`（owner-only 4 policy `to authenticated` + `user_id default auth.uid()`）。**Supabase 本番に適用済み・RLS 実証済み**
- `web/.env.local`（gitignore 済）に `VITE_SUPABASE_URL`(ホスト形式) / `VITE_SUPABASE_ANON_KEY` 配置済み、接続・Auth・RLS 動作確認済み
- 既存 `frontend/`（Tauri）/ `src-tauri/` / `cloud/` は**並立期間として不可侵で維持**。Phase 5 まで削除しない
- ブランチには別チャットの Point Graph 機能コミットが同居。**パス指定ステージ必須**（`git add -A` 禁止、`git add web shared supabase .claude/<file>` のように明示）

### Phase 1 からの申し送り（Phase 2 で先に対処）

1. **新テーブル RLS 漏れの CI 機械検証**（security Medium）: Phase 2 で Notes/Schedule 等のテーブルが増える。`enable row level security` または policy を 1 つでも書き忘れると anon key 公開前提のため全行流出（Critical）。`pg_catalog` 走査で「RLS 無効 or policy 無し」テーブルを検出するゲートを `db push` 前に置く
2. **tsconfig project references 化**（QA 中／将来）: 現状 `web/tsconfig.app.json` の `include: ["../shared/src"]` で shared 全体を web の型プログラムへ引き込む。shared が肥大化する Phase 2 でビルド時間・型エラー巻き込みが増えるため、`shared` を独立 build → `.d.ts` 参照へ移行
3. **signOut scope 堅牢化**（security Low）: `SupabaseAuth.signOut` / `web` のログアウトがネットワーク断時に localStorage セッション残留しうる。`signOut` 失敗を UI で扱う
4. **SupabaseDataService の `row.status as TaskNode["status"]` 型詐称**（QA Suggestion）: 本格スキーマ化時に CHECK 制約 or バリデーションへ
5. **23 型モジュールの frontend/shared 二重保持**: Phase 2 で「frontend → shared 一方向 or shared を frontend が import」の同期方針を決める（現状は意図的二重コピー、乖離検知機構なし）

### 制約

- 「完成まで $0 厳守」継続（Supabase 無料枠 / Apple Developer 等は完成後判断）
- 常時オンライン前提（オフライン編集なし、バナー表示のみ）
- Database(汎用 DB) は Phase 2 スコープ外（SSOT Non-goals、Postgres 動的テーブルは凍結）
- サブエージェント分担で進める（管理=multi-session-coordinator / 設計=role-pm / 実装=role-engineer / 監査=role-qa+security-reviewer / メイン=統括）。実装と QA は別コンテキスト

## Steps

> 着手順序は「小さい順」: Tasks → Daily → Notes → Schedule → WikiTags。各ドメインは「Postgres スキーマ migration → SupabaseDataService 実装 → component/context/hook 移植 → web/ 配線 → 動作確認」のループ。

- [x] **S0. 申し送り先行対処**: (a) RLS 漏れ検出スクリプト（`supabase/` 配下、`db push` 前ゲート）作成 (b) tsconfig project references 化の方針決定（Tasks 移植前に実施するか Phase 2 末か判断）

  > **S0(b) 決定**: Vite=`shared/src` 直 import / tsc=`shared/dist` `.d.ts` の二経路を維持（標準 composite パターン）。検証は web 側 `tsc -b` を正とする（project references が shared を cascade build するため src 編集は自動追従、QA が `shared/dist` 削除 → web `tsc -b`=0 で実証済）。`dist` を手動 stale させない運用前提。**stale 耐性**: `web` の build script を `tsc -b --force && vite build` に変更（references を毎回強制再ビルド = 削除/リネームした型定義の stale `.d.ts` を `dist` から拾わない）。さらに型定義を削除/リネームした場合は念のため `rm -rf shared/dist` 後に build すれば確実（sandbox で `rm -rf` がブロックされる環境では `--force` だけで十分）。

- [x] **S1. Tasks 移植**: `tasks` 本格スキーマ migration（parent_id / order / 階層・soft-delete カラム）→ `SupabaseDataService` の tasks 系を本実装に拡張（Phase 1 は最小4メソッド）→ `frontend/src/components/Tasks/` のうち Tauri 非依存を `shared/src/components/Tasks/` へ → TaskTree + DnD（@dnd-kit）動作確認
- [x] **S2. Daily 移植**: `dailies` スキーマ（単一テーブル、UPSERT 中心、`daily-<YYYY-MM-DD>` キー）→ DataService daily → `Daily/` 移植 → upsert 動作確認
- [x] **S3. Notes 移植**: `notes` + `note_links` + `note_connections` スキーマ → TipTap（`@tiptap/react`）依存確認 → `Notes/` 移植（階層 + リッチテキスト）→ 動作確認（コード完了。0005 本番未apply＝実ブラウザ動作確認は次セッション初手）

  > **【重要】S1/S2/S3 アーキ実態 = Option A（計画書文言「`frontend/components/X → shared/components/X`」は不正確）**: S1/S2 実装は意図的にこの文言から逸脱しており、**shared は UI フリー（context/hooks/services/types のみ）/ web/src/<domain>/ に shared データ経路を叩く目的特化の新規ミニ UI を記述**する方式が実態。S3 もこれに統一（2026-05-17 ユーザー承認）。S4 以降も Option A 前提。TipTap/@dnd-kit/lucide-react は shared でなく web に置く（移植でなくリーン新規実装）。S3 成果: `supabase/migrations/0005_notes_full_schema.sql`（notes/note_links=versioned, note_connections=relation, RLS owner-only 4policy×3 + `has_password` generated col）/ `shared/src/services/{noteMapper,noteLinkMapper,noteMapper.roundtrip}.ts` + SupabaseDataService notes系25メソッド / `shared/src/context/NoteContext`(Pattern A) + `hooks/{useNoteContext,useNoteTreeMovement,useNotesAPI}.ts` + `utils/generateId.ts` / `web/src/notes/{NotesView,RichTextEditor(lean TipTap),NotePasswordDialog,useNoteTreeDnd}` + MainScreen 配線。監査: qa PASS-with-fixes(Blocker0) / security Critical0 High0 Medium2(RLS clean・plaintext password 踏襲で悪化なし) / designer 致命AntiPattern0 → 集中修正で B1/A2/A3/B2/Medium-1/searchNotes(pgrstQuoteValue 統一)/Link protocols 解消、security 再確認で妥当

- [x] **S4. Schedule 移植**（2026-05-17 コード完了。詳細 SSOT `2026-05-17-s4-schedule-migration.md`）: 0006（7 テーブル: + `calendar_tag_definitions` 本体追加。RLS 4policy×7 + Issue 011 partial UNIQUE）+ mapper 7 + DataService 7 + Routine/ScheduleItems/Calendar/CalendarTags Provider（段階的・CalendarTags は Mobile Optional）+ Routine 生成器（frontend 純粋関数論理 diff ゼロ移植）。S4-0〜S4-6 全 role-qa PASS + security/sync-auditor PASS。残: 0006 本番 SQL Editor apply + 実ブラウザ確認（次セッション初手）。S8 delta 申し送り 6 項（rga 親 bump 削除 / cta tombstone / server_updated_at / cursor pagination / ctd full-replicate / version 振り直し）は S4 SSOT 記録済
- [ ] **S5. WikiTags 移植**: `wiki_tags` + `wiki_tag_assignments` + `wiki_tag_connections` スキーマ（relation テーブル、tag アサイン move）→ `WikiTags/` 移植 → tag 付与/検索確認
- [ ] **S6. 横断**: `context/`（Tauri 依存除く）/ `hooks/` / `i18n/`（en/ja）を `shared/src/` へ。Tauri 依存 4 ファイル（TitleBar / Settings 3 個）は Web 版新規実装 or 除外
- [ ] **S7. オフライン警告バナー**: `navigator.onLine` 監視 + 全画面共通（SSOT 必須項目）
- [ ] **S8. Supabase Realtime**: 他タブ変更反映（Phase 1 で polling 不採用、Realtime CDC 購読）。RLS フィルタ（関係カラム指定）に注意
- [ ] **S9. Mobile レスポンシブ確認**: Chrome DevTools で PC + Mobile レイアウト崩れなし

各ステップ完了時: session-verifier → task-tracker（パス指定 commit & push）。ドメイン単位で子ブランチ（例 `phase-2/tasks-migration`）も可。

## Files

| File / Dir                                                     | Operation | Notes                                                                                                              |
| -------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------ |
| `supabase/migrations/0003_*.sql` 以降                          | Add       | ドメインごとに本格スキーマ。**必ず RLS enable + 4 policy + `user_id default auth.uid()`**（S0 のゲートで機械検証） |
| `shared/src/services/SupabaseDataService.ts`                   | Edit      | Proxy throw を実装に順次置換（tasks → daily → notes → schedule → wikitags）                                        |
| `shared/src/components/{Tasks,Daily,Notes,Schedule,WikiTags}/` | Add       | `frontend/` の Tauri 非依存版を移植                                                                                |
| `shared/src/{context,hooks,i18n}/`                             | Add       | Tauri 依存除外して移植。Provider 順序は CLAUDE.md §6.2 準拠                                                        |
| `web/src/*`                                                    | Edit      | section 配線、shared コンポーネント mount                                                                          |
| `web/tsconfig.app.json` / `shared/tsconfig.json`               | Edit      | project references 化（S0 判断次第）                                                                               |
| `frontend/` `src-tauri/` `cloud/`                              | 不可侵    | Phase 5 まで触らない（読み取りのみ）                                                                               |
| `.claude/2026-05-04-cross-platform-migration.md`               | Edit      | Phase 2 完了判定 [x] 化（完了時。別チャット編集中なら競合回避）                                                    |
| `.claude/MEMORY.md` / `HISTORY.md`                             | Edit      | task-tracker 経由のみ                                                                                              |

## Verification（Phase 2 完了判定 = SSOT 準拠）

- [ ] Tasks / Schedule / Notes / Daily / WikiTags の CRUD が `web/` で動く（実ブラウザ確認）
- [ ] PC + Mobile 両方でレイアウト崩れなし（Chrome DevTools）
- [ ] Supabase Realtime 経由で他タブからの変更が反映される
- [ ] オフライン時にバナー表示
- [ ] `frontend/`(Tauri) `tsc -b`=0 で非破壊（並立維持の担保）
- [ ] 各ドメイン migration が RLS enable + owner-only policy を満たす（S0 ゲートが green）
- [ ] web `tsc -b` / `eslint` / `vite build` green、shared `tsc --noEmit` green

## 再開手順（次セッション最初の一手）

1. この計画書 + SSOT Phase 2 節を読む
2. `git log --oneline -5` で Phase 1 コミット（d1abd8a/ce6a5cb/cefad9a）が push 済みか確認
3. `cd web && npm run dev` で起動、`web/.env.local` 健在か（無ければユーザーに再配置依頼）、ログイン→tasks CRUD が通るか sanity check
4. multi-session-coordinator で並行チャット競合確認 → role-pm に S0+S1 を渡して分解 → role-engineer 実装 → role-qa/security 監査
5. Supabase の Phase 1 検証残骸（`rls.a@gmail.com` / `rls.b@gmail.com` / テスト行 "A-task"）が未削除なら掃除をユーザーに依頼
