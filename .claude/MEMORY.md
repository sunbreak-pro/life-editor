# MEMORY.md - タスクトラッカー

## 進行中

### 🔧 クロスプラットフォーム移行 Phase 2 — コア機能のフロントエンド移植（着手日: 2026-05-16）

**対象**: `supabase/migrations/0003+`（ドメイン別本格スキーマ）/ `supabase/scripts/`（RLS ゲート）/ `shared/src/{components,context,hooks,i18n}/`（frontend から Tauri 非依存を移植）/ `web/`（配線）。`frontend/` `src-tauri/` `cloud/` 不可侵維持
**計画書**: `.claude/docs/vision/plans/2026-05-16-phase2-core-migration.md`

- 前回: S3(Notes) コード完了 + 0005 実DB検証 + PR1 正式クローズ + forward-port #1#2#3 適用（pathspec commit/push 済）
- 現在: **S4 Schedule 移植 コード完了**（子ブランチ `phase-2/schedule-migration`、`d809f06` push 済）。S4-0 調査→S4-1 0006(7テーブル: calendars/routines/routine_groups/rga/schedule_items/**calendar_tag_definitions(cta FK 先・本体追加)**/cta + RLS4policy×7 + Issue011 partial UNIQUE)+mapper7+roundtrip→S4-2 DataService schedule 系→S4-3 RoutineProvider→S4-4 ScheduleItemsProvider→S4-5 Routine 生成器(frontend 純粋関数 `routineScheduleSync`/`routineFrequency` を**論理 diff ゼロ忠実移植**+生成器フック DI+web トリガー)→S4-6 Calendar+CalendarTags(Mobile Optional バリアント)+cta 孤児化対策。各サブ role-qa 独立監査 PASS、S4-1 security-reviewer PASS(Critical0)、S4-5/S4-6 sync-auditor PASS(Critical0、High は全て S8 申し送り)。vitest 71/71、frontend/src-tauri/cloud diff0 非破壊。Issue 011/017/020/008 全ガード実証
- 次: **0006 本番 SQL Editor apply + 実ブラウザ確認(次セッション初手)** → S4 SSOT Verification クローズ → `phase-2/schedule-migration` を `refactor/web-first-v2` へマージ → **S5 WikiTags**。S8(Realtime/delta)申し送り 6 項(rga 親 bump 削除/cta tombstone 化/server_updated_at 追加/cursor pagination/ctd full-replicate 維持/Tauri→Supabase version 振り直し)は S4 SSOT `2026-05-17-s4-schedule-migration.md` 記録済＝S8 着手者必読

**S3/S4 申し送り（優先度順）**: ①**[✅ 完了 2026-05-17] 0005 本番 apply + 実DB検証済**: RLS gate offender0 / FK名一致 / advisor RLS lint0。残: (c)検索クエリ特殊文字 sanity は実ブラウザ確認(d)に統合、(d)実ブラウザ Notes CRUD/階層DnD/TipTap/password の動作確認はユーザー手動で実施中（PR1 適用後）。backlink はデータ層実装済だが lean web UI 未配線（roundtrip+FK名一致で担保、UI は Backlog） ②**[再発防止知見・厳守]** PostgREST `select=` に任意 SQL 式不可（カラム名 or generated column / DB 関数のみ）。computed boolean は generated column 化が定石。S4+ mapper でも厳守 ③**[アーキ・S4 前提] Option A 確定**: shared は UI フリー（context/hooks/services/types のみ）/ web/src/<domain>/ に新規ミニ UI。計画書「frontend→shared/components」文言は不正確（S1/S2/S3 実態へ補正済）。S4 Schedule も Option A・TipTap/dnd 等は web 側 ④**[既存債務・悪化なし]** plaintext password は RPC security-invoker 化が将来の正攻法（コード/SQL コメント既設、Medium-2）。Low-A: searchNotes の LIKE メタ %/\_ 非リテラル化は Tauri SQLite LIKE 同挙動＝移植方針上現状維持が正 ⑤**[一部解消 2026-05-17]** shared に vitest 配備済（`shared/vitest.config.ts`、tests を src/ 外に分離し dist 非汚染、`npm run test`=vitest run）。安全網 Top5 追加（useNoteTreeMovement.isDescendantOf 循環停止 / pgrstQuoteValue 注入境界+M1 %_ ギャップ記録 / getDescendantTasks visited / noteUpdatesToPatch password clobber / walkAncestors visited、計 30 テスト緑）。**H1=`useNoteTreeMovement` ローカル `isDescendantOf` 循環ガード欠落（KI-016 同型 DoS/OOM 退行・FP#1 が `getDescendantTasks.ts` だけ直し forward-port 監査が「判定対象外」と明記した別ヘルパ）を正本 visited パターン忠実移植で修正済**（security-reviewer 監査 H1 → role-engineer 修正 → session-verifier PASS → role-qa 独立監査 APPROVE Blocker/Major/Minor 全0）。残: web 側 vitest 未配備（対象が web に出たら配備）/ noteMapper・noteLinkMapper の roundtrip 以外の純粋関数は追加余地 / M1（searchNotes LIKE `%`/`_`非エスケープ）は既知ギャップとしてテストで挙動固定（未修正・申し送り④と整合）。designer 改善: prefers-reduced-motion 一括無効化 / NotesView 英語直書きの i18n テーブル化(Settings S-step) ⑥**[未解消・要ユーザー]** PAT 露出止血継続（MCP write 昇格前提未達でwrite凍結・SQL Editor 手動）/ upsert read-then-write LWW(S8) / SyncProvider 二重ラップ(S8) /`web/src/TasksScreen.tsx`dead code 要確認 /`get_advisors` `auth_leaked_password_protection` WARN(完成後判断) ⑦**[別チャット同居]** working tree に並行チャットの未コミット IME 安全化リファクタ(frontend/ ~30ファイル+imeSafe.ts/test+useSlashCommand.ts 等)が同居。**commit は frontend/ 全除外のパス指定必須**(`git add -A` 厳禁)。`.claude/HISTORY-archive.md.bak`・`.claude/2026-\*.md`削除・`.mcp.json`・frontend-refactor plan の M も巻き込まず
**サブエージェント分担**: 設計=role-pm / 実装=role-engineer / 監査=role-qa+security-reviewer / 統括=メイン

## 直近の完了

- Phase 2 S4 Schedule 移植 コード完了 ✅（2026-05-17）— 子ブランチ `phase-2/schedule-migration` で S4-0〜S4-6 の 7 サブステップ実装。0006(7テーブル+RLS4policy×7+Issue011 partial UNIQUE)+mapper7+DataService7+Routine/ScheduleItems/Calendar/CalendarTags Provider(段階的・CalendarTags Mobile Optional)+Routine 生成器(frontend 純粋関数論理 diff ゼロ移植)。各サブ role-qa PASS、S4-1 security PASS、S4-5/6 sync-auditor PASS(High は全 S8 申し送り)。cta 孤児化対策実装。vitest 71/71・非破壊。残=0006 本番 apply+実ブラウザ(次セッション)。S8 申し送り 6 項を S4 SSOT 記録。詳細 HISTORY 参照
- 移行 SSOT 復元 + MEMORY/CLAUDE ドキュメント陳腐化一掃 + orphan DB 削除 ✅（2026-05-17）— general-purpose で MEMORY 予定/保留/バグ温床を移行 SSOT・コード実体・git・KI INDEX と突合棚卸し。移行 SSOT 誤削除(60f5f63)を git から完全復元。MEMORY 予定 11 項目+バグ温床 10 項目の陳腐化削除、クロス参照ドリフト修正。orphan DB 退避削除。詳細 HISTORY 参照
- shared+web セキュリティ監査 → H1 循環ガード退行修正 + 安全網テスト整備 ✅（2026-05-17）— security-reviewer 監査(Critical0 High1)+H1=`useNoteTreeMovement` 循環ガード欠落を正本 visited パターン忠実移植。shared vitest 配備+安全網 30 テスト。role-qa APPROVE(全0)。詳細 HISTORY 参照

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
