---
Status: DONE — PR #47 マージ済（残務なし。2026-06-07 archive 対象）
Created: 2026-06-06
Branch: feat/web-phase2-s8-realtime
Owner-chat: main
Parent: .claude/2026-05-04-cross-platform-migration.md (Phase 2 完了判定の 1 項目)
Previous: .claude/docs/vision/plans/2026-05-16-phase2-core-migration.md
---

# Plan: Web Phase 2 — S8 Supabase Realtime（cross-tab live refetch）

> Phase 2 完了判定の残り 2 項目 (S8 Realtime / S9 モバイルレスポンシブ) のうち **S8 を単独 PR で確定**する。
> S9 は別計画 (`2026-06-xx-web-phase2-s9-mobile-responsive.md`) で静的修正 + ユーザー目視として分離。

---

## Context

- **動機**: web ビルドの Sync は S1 で no-op（`syncVersion` 固定）のまま。別タブ/別端末でデータを変えても画面に反映されない。Phase 2 完了判定「Supabase Realtime 経由で他タブからの変更が反映される」を満たす。
- **制約**: コスト $0（Supabase Realtime は無料枠内）/ N=1・常時オンライン前提なので Tauri 時代の双方向 delta sync は復活させず、**粗い全再取得（coarse full-refetch）** で十分 / RLS は既存の owner-only ポリシー（0006/0008）をそのまま使う（Realtime も RLS を尊重する）。
- **Non-goals**: delta pull の復活 / 行ペイロードの差分適用 / Presence・Broadcast（タイピング表示等）/ S9 モバイルレスポンシブ（別 PR）。

---

## Scope (Touchable Paths)

```
shared/src/context/SyncContext.tsx
shared/src/context/SyncContextValue.ts
shared/tests/syncRealtimeTables.test.ts
web/src/MainScreen.tsx
supabase/migrations/0017_realtime_publication.sql
.claude/docs/vision/plans/2026-06-06-web-phase2-s8-realtime.md
```

スコープ外（package.json の supabase-js floor bump 等）は今回持ち込まない（main の lockfile が既に 2.105.4 を固定済 = `^2.45.0` のまま動作）。

---

## 設計サマリ（実装済み WIP の確定）

- **SyncProvider を Realtime 化**: `getSupabaseClient().channel("db-changes")` を 1 本だけ張り、14 テーブル全てに `postgres_changes`（event: `*`）を購読。どのテーブルの変更でも 300ms debounce で `syncVersion` を +1。各ドメインの `*API` フックは `syncVersion` を load-effect の依存に持つので、1 回の bump で全マウント中ドメインが再取得する。
- **debounce の意味**: 複数行 DnD 並び替え等で UPDATE が連射されても 1 回の再取得にまとめる。
- **RLS**: 購読前に `supabase.realtime.setAuth(token)` で JWT を socket に渡す。これで「セッション復元直後に socket が auth より先に繋がり、RLS フィルタ済み行が配信されない」窓を塞ぐ（best-effort fast-path。無くても supabase-js が auth 解決後に自動付与するので correctness は保たれる）。
- **マウント位置**: `MainScreen` 最上位で 1 回だけマウント（section 切替の外）。section ごとにマウントすると切替のたびに channel が張り直され、再接続チャタリング + リーク懸念。
- **StrictMode 安全**: cleanup で `cancelled` フラグ + `removeChannel`。getSession を await している間に最初の effect が破棄されても channel を作らない。
- **lockstep 不変条件**: `REALTIME_TABLES`（TS）と 0017 の publication テーブル集合が一致しないと、その分のドメインが静かに更新追従しなくなる。`shared/tests/syncRealtimeTables.test.ts` が両者一致を機械検証する。

---

## Steps

| #   | Step                                                                  | Gate    | Acceptance                                                            |
| --- | --------------------------------------------------------------------- | ------- | --------------------------------------------------------------------- |
| 1   | SyncContext.tsx / SyncContextValue.ts を Realtime 化（WIP 確定）      | 🤖 自律 | `cd shared && npx tsc -b` exit 0                                      |
| 2   | MainScreen.tsx で SyncProvider を最上位に 1 回マウント                | 🤖 自律 | `cd web && npx tsc -b --force` exit 0                                 |
| 3   | 0017_realtime_publication.sql 追加（14 テーブル・冪等・publish のみ） | 🤖 自律 | ファイル存在 / SQL 構文上 idempotent（pg_publication_tables ガード）  |
| 4   | lockstep テスト追加（REALTIME_TABLES ↔ 0017）                         | 🤖 自律 | `cd shared && npx vitest run tests/syncRealtimeTables.test.ts` 緑     |
| 5   | shared 全テスト緑 + web 型検証                                        | 🤖 自律 | `cd shared && npm test` 緑 / `cd web && npm run build` exit 0         |
| 6   | 0017 を本番 Supabase へ適用                                           | 🛑 人手 | ユーザー `supabase db push`（or SQL Editor）。後で publication を確認 |
| 7   | publication / RLS の事後確認                                          | 🤖 自律 | `pg_publication_tables` に 14 テーブル / 各テーブル owner RLS 有効    |
| 8   | E2E: 2 タブで片方の変更がもう片方に反映                               | 👀 目視 | golden path を手で 1 周（Tasks 追加 → 別タブに数百 ms で出る）        |
| 9   | PR 作成 → main merge                                                  | 🛑 人手 | PR レビュー & merge ボタン                                            |

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npx tsc -b` exit 0
- [ ] `cd web && npx tsc -b --force` exit 0
- [ ] `cd shared && npm test` 全 pass（新規 lockstep テスト含む）
- [ ] PR diff が ±300 行以内（機能追加。現状 ~225 行 + migration + test）
- [ ] (適用後) Supabase の `supabase_realtime` publication に 14 テーブルが存在
- [ ] (適用後) 14 テーブル全てに owner-only RLS（`auth.uid() = user_id`）が有効

---

## DB Migration Notes

DDL = `alter publication supabase_realtime add table ...`（14 テーブル）。新規ポリシーは追加しない（既存 RLS をそのまま使う）。REPLICA IDENTITY も変更しない（粗い全再取得モデルなので DELETE が PK だけ流せば十分）。

**ローカルファイル先行ルール（MANDATORY）**:

1. ローカルに `supabase/migrations/0017_realtime_publication.sql` 作成済（Claude）
2. **ユーザーが** `supabase db push`（or Supabase SQL Editor に貼り付け）で適用 — `apply_migration` MCP の単独使用は禁止（schema drift 確定）
3. 適用後、Claude が `list_migrations` / `pg_publication_tables` 照会で確認しレポート

冪等性: 各 `add table` は `pg_publication_tables` 存在チェックでガード済。再実行・既存メンバーでも no-op（`relation is already member of publication` エラーにならない）。

ロールバック:

- 不要時は逆向き migration を別ファイルで作成（`alter publication supabase_realtime drop table ...`）。既存 0017 は編集しない。

---

## Risks / Known Issues 参照

- Realtime が RLS を尊重する前提が崩れると他人の行が配信される → 本 PR は新ポリシーを足さず既存 owner-only RLS に乗るだけ。`life-editor-sync-auditor` で 14 テーブルの RLS 有効性を再確認する。
- `REALTIME_TABLES` と 0017 のズレ → lockstep テストで防止。
- 将来テーブル追加時: 同期対象なら **両方**（`REALTIME_TABLES` と 0017）に足す。`db-migration` スキル / `life-editor-sync-auditor` が誘導する。

---

## References

- 移行 SSOT: `.claude/2026-05-04-cross-platform-migration.md`（Phase 2 完了判定）
- db 規約: `.claude/docs/vision/db-conventions.md`
- related skills: `db-migration`, `life-editor-sync-auditor`, `life-editor-migration-validator`

---

## Worklog

- 2026-06-06: 前セッションの WIP（`worktree-s8-realtime` ブランチ、PR #45 pre-squash コミット上）を発見。prototype ノイズを切り離すため main から `feat/web-phase2-s8-realtime` を切り直し、S8 の 3 ファイル + 0017 のみを移植。package.json の floor bump（`^2.45.0`→`^2.105.4`）は不要と判断し revert（main lockfile が既に 2.105.4 固定）。`REALTIME_TABLES` を export 化し lockstep テストを追加。
- 2026-06-06: 独立監査 2 本（`life-editor-sync-auditor` / `security-reviewer`）を別コンテキストで並列実行。**両者 BLOCKER/Critical ゼロ**。
  - sync 整合 OK: REALTIME_TABLES(14) = 0017 publication(14) = 現存 owned テーブル全集合（0007/0012 で DROP 済の旧テーブルの混入なし）。14 テーブル全てに owner-only RLS 有効。
  - security OK: 他ユーザー行の別タブ配信は **No**（owner-only RLS + JWT を socket に付与 + publication 追加は RLS を迂回しない）。REPLICA IDENTITY DEFAULT のままで `password_hash` 等を Realtime ワイヤに乗せない設計とも整合。
  - 取り込んだ軽微改善: lockstep regex を `[a-z0-9_]` に拡張（N1）/ `triggerSync` を `bumpRef` 経由の単一 bump 経路へ統一（N2）/ 自己エコー（自タブ書き込みも echo）を許容する旨のコメント追加（W2）。
  - **W1（長寿命タブのトークンリフレッシュ追従）は実装変更不要**と確定: security 側が realtime-js 実装を読み、supabase-js 2.105.4 は `onAuthStateChange` の `TOKEN_REFRESHED`/`SIGNED_IN` 時に `realtime.setAuth(token)` を自動呼出する（最悪でも RLS が古い JWT を拒否＝fail-closed で「他人の行が出る」方向には壊れない）ことを確認。手動先打ちと自動伝播の二重管理を避けるため現状維持。
- 2026-06-06: 最終ゲート緑。`shared tsc -b` exit 0 / `shared vitest` 244 passed（lockstep 3 件含む）/ `web tsc -b --force` exit 0。残: Step 6（ユーザー `supabase db push` で 0017 適用）→ Step 7 事後確認 → Step 8 目視 → Step 9 PR merge。
