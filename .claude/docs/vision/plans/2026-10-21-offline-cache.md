---
Status: Draft
Created: 2026-10-21
Branch: docs/offline-plan-main-20261021
Owner-chat: refactor-core
Parent: .claude/docs/vision/plans/2026-08-10-core-refactor.md
---

# Plan: 取りこぼしを防ぎ、取ったデータを端末に置き、一部をオフラインで使えるようにする

> 2026-10-21 のこうだいさんの決定（D-20261021-main-1）で、「常時オンライン前提・オフライン不要・端末への保存はしない」（移行 SSOT §3・§9、D-20260818-refactor-1 の A-2 却下）を置き換える計画です。
> 根拠は origin/main `bcb8f670` の file:line です。実測していないことは **未確認** と書きます。
> 下書きは chat-main のサブエージェントが作り、chat-main が主な根拠（`itemsMeta.ts:158-170`・`SupabaseTodosService.ts:344-371`・`useTodoTreeCRUD.ts:77-108`）を読み直して確かめました。

---

## Context

- **動機**: 次の 3 つです。
  - Realtime が切れていたあいだの変更を取り直す処理がありません。`ch.subscribe()` に状態のコールバックがないためです（`shared/src/context/SyncContext.tsx:216`）。
  - 読み直すたびに、全領域を全件取り直します（`syncDomains.ts:17-20`）。
  - 圏外では Web 版を開けず、書けません。
- **制約**: コスト $0 です。使うのは IndexedDB・Service Worker・MIT ライセンスの開発時の依存だけです。データには `getDataService()` 経由でだけ触ります（CLAUDE.md §3.1）。DDL はローカルの migration ファイルを先に置き、`supabase db push` はこうだいさんが行います。
- **Non-goals**:
  - すべての画面のオフライン書き込み。対象は Daily・Todo の追加・Notes の一部だけです。
  - 予定・タグ・タイマーなどの差分取得。`items_meta` を持たないか、日付の範囲で読むためです。
  - Electron での保存の保証。file:// の保存場所が安定しないため（`supabaseAuthStorage.ts:11-14`）、できる範囲で扱います。
  - CRDT（同時編集を自動で合わせる仕組み）。

### 今の実装でわかっていること

| 項目                                | 事実                                                                                                                                                     | 根拠                                                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| キャッシュ                          | メモリだけに置き、キーごとに 1 件を持ちます。DataService の同一性で照合します                                                                            | `shared/src/state/domainSnapshotStore.ts:17-19,80-91`                                                                    |
| 読み出しは同期                      | `useState` の初期化で読むので、非同期の IndexedDB をそのまま差し込めません                                                                               | `shared/src/hooks/useDomainLoad.ts:153-157,194-197`                                                                      |
| キャッシュへの書き込み              | 読み出しが成功したあとに `writeDomainSnapshot` を呼びます                                                                                                | `useDomainLoad.ts:210-213`                                                                                               |
| `updated_at` は端末の時計           | `toItemsMetaPatch(fields, now)` の `now` は端末で作った時刻です                                                                                          | `shared/src/services/itemsMeta.ts:158-170`・`SupabaseDailiesUnifiedService.ts:185`                                       |
| `updated_at` を進めるトリガーはない | 0008 で列とインデックスを作っただけです                                                                                                                  | `supabase/migrations/0008_data_unification_schema.sql:76-92`                                                             |
| 一覧の読み出し                      | role と `is_deleted` で絞り、id 順にページを送ります。`updated_at` では絞りません                                                                        | `shared/src/services/itemsMetaJoin.ts:108-123`                                                                           |
| 物理削除                            | 作成に失敗したときの後始末・ゴミ箱からの完全削除・ノート削除に伴う表アイテムの削除で起きます。`SupabaseTodosService.ts:259,445` はまだ詳しく見ていません | `SupabaseDailiesUnifiedService.ts:169,328-337`・`SupabaseNotesUnifiedService.ts:121`・`SupabaseNoteTablesService.ts:282` |
| role の付け替え                     | 変換のときに payload を物理削除して role を変えます                                                                                                      | `SupabaseItemConversionService.ts:283-294,429-436`                                                                       |
| Todo の追加                         | 未完了の兄弟の並び順を全部 +1 し、全ノードを `syncTodoTree` に渡します。全行が `updated_at: now` で upsert されます                                      | `useTodoTreeCRUD.ts:77-108`・`SupabaseTodosService.ts:344-371`                                                           |
| Daily の保存                        | 1 回の保存で 6 本の通信になります                                                                                                                        | `SupabaseDailiesUnifiedService.ts:91-108,126-143,193-236`                                                                |
| ノートの作成                        | id は端末で作ります（`generateId("note")`）。meta・payload・本文の順に書きます                                                                           | `useNotesUnifiedCRUD.ts:87,113-125`・`SupabaseNotesUnifiedService.ts:95-131`                                             |
| ピン留め                            | `updateNoteUnified(id, {isPinned})` で付け外しします                                                                                                     | `useNotesUnifiedCRUD.ts:346-362`                                                                                         |
| 版を比べてから書く                  | `update_note_content` RPC があり、`updated_at` を `greatest(now(), old+1ms)` にします                                                                    | `0032_update_note_content.sql:63-106`・`SupabaseNotesUnifiedBodySave.ts:46-69`                                           |
| 競合の画面と 3-way merge            | 「自分の版 / 相手の版 / 両方残す」のバナーと、ブロック単位の 3-way merge があります                                                                      | `shared/src/components/materials/NoteConflictBanner.tsx`・`shared/src/utils/blockMerge.ts:170`                           |
| Daily のエディタ                    | Notes と同じ TipTap なので、blockMerge をそのまま使えます                                                                                                | `web/src/daily/DailyView.tsx:49,212`                                                                                     |
| 起動時の判定                        | `getSession()` が返るまで「Loading…」を出します。圏外で返らない恐れがあります（未確認）                                                                  | `web/src/App.tsx:81-95,115-118`                                                                                          |
| 配信                                | Cloudflare Workers の静的配信で、CSP は `script-src 'self'` です                                                                                         | `web/wrangler.jsonc`・`web/public/_headers`                                                                              |
| iOS の殻                            | `web/dist` を同梱していて `server.url` はありません。殻のファイルはすでに端末にあります                                                                  | `mobile/capacitor.config.ts`                                                                                             |

---

## 検討した代替案（必須）

| 案                                                                                 | 採否               | 却下理由                                                                                 | 復活条件                                                  |
| ---------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 段階を分けて入れる（P0 → P1a → P1b → P1c → P2）                                    | ✓                  | —                                                                                        | —                                                         |
| localStorage に保存する（D-20260818 の A-2）                                       | ✗                  | 容量の上限が約 5MB で、読み書きのあいだ画面が止まります                                  | —                                                         |
| 差分の基準に今の `updated_at` を使う（DDL なし）                                   | ✗                  | 端末の時計で書かれるので、時計が遅れた端末の書き込みが基準より過去になり、取りこぼします | 全部の書き込みがサーバーの時計を使う RPC 経由になったとき |
| トリガーで `updated_at` 自体をサーバーの時計にする                                 | ✗                  | 今の楽観的な画面更新と版の比較（#607・#2057）の前提が全部変わります                      | `changed_at` の方式で問題が出たとき                       |
| **`changed_at`（トリガーでサーバーの時計を書く）と削除記録の表を足す**             | ✓                  | —                                                                                        | —                                                         |
| 物理削除を、全 id の突き合わせで見つける（DDL なし）                               | △ 安全網として併用 | 1 回ごとに全 id 分を送ります（件数は未確認）                                             | 削除記録の DDL を見送るとき                               |
| 競合: サーバーに後から届いたほうが勝つ（今の形）                                   | ✗                  | 数時間後に届いたオフラインの編集が、新しい編集を黙って上書きします                       | —                                                         |
| 競合: 端末の時刻が新しいほうが勝つ                                                 | ✗                  | 時計がずれます。オフラインの編集はいつも古い時刻になり、黙って負けます                   | —                                                         |
| **競合: 元の版を比べる → 3-way merge → 合わせられない箇所だけ別ノート / 両方残す** | ✓ 推奨             | —                                                                                        | —                                                         |
| 競合: いつも別ノートを作る                                                         | ✗                  | 片方しか変えていなくても別ノートが増えて煩わしいです                                     | merge が誤って動いたとき                                  |
| Service Worker を手で書く                                                          | ✗                  | 遅延読み込みのファイルを含む一覧を自前で保つのは割に合いません                           | vite-plugin-pwa が Vite の更新に追いつかなくなったとき    |
| **vite-plugin-pwa（generateSW・開発時の依存・MIT）**                               | ✓                  | —                                                                                        | —                                                         |

---

## Issue 分割と依存順（すべて refactor-core）

| Phase  | Issue                                                         | 依存        | DDL     |
| ------ | ------------------------------------------------------------- | ----------- | ------- |
| D      | 本計画書の PR（決定の記録・移行 SSOT・`core.md` の書き換え）  | —           | —       |
| P0     | #2329 回線が戻ったら、切れていたあいだの変更を取り直す        | #2290 の PR | —       |
| P1a    | #2331 取ったデータを IndexedDB に保存する                     | D           | —       |
| P1b-0  | #2332 Todo を足したときに、変わった行だけを保存する           | —           | —       |
| P1b    | #2333 前回から変わった分だけを取る（P1b-ddl を含む）          | P1a・P1b-0  | 🛑 0043 |
| P1c    | #2334 Service Worker で圏外でも見られるようにする             | P1a         | —       |
| P2-ddl | #2325 Daily の保存を RPC 1 本にまとめる（版の比較を持たせる） | —           | 🛑      |
| P2a    | #2335 送信待ちの箱と、圏外での Todo の追加                    | P1c・P1b-0  | —       |
| P2b    | #2336 圏外での Daily                                          | P2a・#2325  | —       |
| P2c    | #2337 圏外でのノート（ピン留めと新規作成だけ）                | P2a         | —       |

P0・P1b-0・D は並行できます。P1b と P1c も並行できます。migration の番号は着手時に origin/main と突き合わせて決めます。下の 0043・0044 は仮の番号です。

---

## Scope (Touchable Paths)

```
shared/src/context/SyncContext.tsx
shared/src/context/syncResume.ts                      (新規)
shared/src/state/domainSnapshotStore.ts
shared/src/state/persistentCache.ts                   (新規: IndexedDB の薄い包み・依存は足さない)
shared/src/state/noteBodyStore.ts
shared/src/state/outbox.ts                            (新規)
shared/src/hooks/useDomainLoad.ts
shared/src/hooks/useTodoTreeAPI.ts / useTodoTreeHistory.ts / useTodoTreeCRUD.ts
shared/src/hooks/useDailiesUnifiedAPI.ts / useNotesUnifiedAPI.ts / useNotesUnifiedCRUD.ts
shared/src/services/itemsMetaJoin.ts
shared/src/services/itemChanges.ts                    (新規: 差分取得と領域ごとの反映)
shared/src/services/offlineDataService.ts             (新規: DataService を包む層)
shared/src/services/dataServiceFactory.ts
shared/src/services/DataService.ts
shared/src/services/SupabaseTodosService.ts / SupabaseDailiesUnifiedService.ts / SupabaseNotesUnifiedService.ts
shared/src/services/SupabaseAuth.ts
shared/src/utils/blockMerge.ts                        (読むだけ。必要なら export を足す)
shared/src/i18n/**（オフラインの文言）
shared/tests/**  web/tests/**
web/src/App.tsx  web/src/main.tsx  web/src/components/OfflineBanner.tsx  web/src/hooks/useOnlineStatus.ts
web/src/notes/**（圏外の一覧の絞り込みと競合の通知だけ）
web/vite.config.ts  web/package.json  web/public/_headers  web/public/manifest.webmanifest
supabase/migrations/<番号>_items_meta_changed_at_tombstones.sql
.claude/docs/requirements/tier-1-core.md  .claude/docs/vision/db-conventions.md  .claude/CLAUDE.md（§3.3 の 1 行）
.claude/docs/vision/plans/2026-10-21-offline-cache.md
```

---

## Steps（Phase ごと = Issue ごと）

### D — 決定と docs の反映（本計画書の PR で済み）

| #   | Step                                                                                                                         | Gate | Acceptance                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------- |
| D1  | `.claude/decisions/D-20261021-main-1.md` に決定を記録し、`ANSWERS.md` に行を足す                                             | 🤖   | `node .claude/scripts/records.mjs check` が OK                                              |
| D2  | 移行 SSOT の §3 表「オフライン」行と §9 Non-goals の 2 項目を書き換える。`:530` の要件の記録は経緯として残す                 | 🤖   | `git grep -c "Service Worker 不採用" -- .claude/2026-05-04-cross-platform-migration.md` = 0 |
| D3  | `core.md` の冒頭の注記と §3 の注記に、一部オフライン対応への再転換を書く                                                     | 🤖   | `git grep -c "D-20261021-main-1" -- .claude/docs/vision/core.md` ≥ 2                        |
| D4  | `tier-1-core.md` の Sync 節・`db-conventions.md` §10・`.claude/CLAUDE.md` §3.3 の書き換えは、実装に合わせて P1b の PR で行う | —    | P1b の Acceptance に含める                                                                  |
| D5  | PR の merge                                                                                                                  | 🛑   | merge                                                                                       |

### P0 — 再接続での取り直し（#2329・DDL なし）

| #   | Step                                                                                                                                                                                                                  | Gate | Acceptance                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `ch.subscribe((status) => …)` にする。途中で `CHANNEL_ERROR`・`TIMED_OUT`・`CLOSED` を挟んだあとの `SUBSCRIBED` で、全領域を 1 回取り直す（今の `triggerSync` と同じ動き = `SyncContext.tsx:254-256`）                | 🤖   | `shared/tests/syncResume.test.tsx`: 偽のチャンネルで SUBSCRIBED → CLOSED → SUBSCRIBED を流すと全領域の版が 1 だけ進む。最初の SUBSCRIBED では進まない |
| 2   | `online` と、30 秒以上裏に回ったあとの `visibilitychange` でも全領域を取り直す。今の 300ms のまとめ（`SyncContext.tsx:177-182`）に通す。iOS の殻にアプリ復帰のプラグインがないので、`visibilitychange` で代わりにする | 🤖   | 同じテストで、`online` を 3 回続けても取り直しは 1 回                                                                                                 |
| 3   | realtime-js が自動で再接続したときに、コールバックがもう一度呼ばれるかを確かめる（未確認）                                                                                                                            | 👀   | DevTools で回線を切って戻すと、Network に取り直しが出る                                                                                               |

### P1a — IndexedDB への保存（#2331）

| #   | Step                                                                                                                                                                                                                                                                                                                                                                | Gate | Acceptance                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | `persistentCache.ts`: DB 名は `life-editor-cache:<userId>`。store は `meta`（データの形の版と基準時刻）と `snapshots`。`CACHE_SCHEMA_VERSION` が違えば DB を消す                                                                                                                                                                                                    | 🤖   | `fake-indexeddb`（開発時の依存・Apache-2.0）を使うテストで、版が違うと空になり、別のユーザーの分は見えない                   |
| 2   | 読み出しを同期のまま保つため、起動時にまとめて読み込む。`App.tsx` でセッションが決まったあとに `await hydrateDomainSnapshots(userId)` を呼び（300ms で打ち切って空のまま進む）、そのあと MainScreen を描く。保存分は DataService の同一性の代わりに `owner=userId` で照合する（`domainSnapshotStore.ts:87` を「メモリ由来なら同一性、保存由来なら owner」に広げる） | 🤖   | `shared/tests/domainSnapshotPersist.test.tsx`: 読み込み後の最初の表示で `isLoading=false` になり、保存済みのデータで描かれる |
| 3   | 書き込みは `writeDomainSnapshot` から 1 秒まとめて IndexedDB へ流す。最初に保存するのは 7 つの領域の枠（`domainSnapshotStore.ts:43-50`）だけで、画面ごとの枠は対象外                                                                                                                                                                                                | 🤖   | 同じテスト                                                                                                                   |
| 4   | 読み戻すときに形を検査し（配列か・要素の数）、反映を try/catch で囲む。失敗したらその枠を捨てる                                                                                                                                                                                                                                                                     | 🤖   | 壊れた値を入れても例外が出ず、取り直しで戻る                                                                                 |
| 5   | 版の上げ忘れを防ぐ。代表の行を `rowsTo*Node` に通したときのキーの集まりを vitest の snapshot に固定し、キーが変わったらテストを落として `CACHE_SCHEMA_VERSION` を上げるよう促す                                                                                                                                                                                     | 🤖   | snapshot のテストがある                                                                                                      |
| 6   | サインアウト（`SupabaseAuth.ts:169-170` と `SIGNED_OUT`）で、そのユーザーの DB とメモリを消す。送信待ちがあれば先に確認する（P2a でつなぐ）                                                                                                                                                                                                                         | 🤖   | サインアウト後に DB がない（テスト）                                                                                         |
| 7   | 読み直した直後に前回の一覧が出ることを確かめる                                                                                                                                                                                                                                                                                                                      | 👀   | Daily・Notes・Todo で骨組みが出ない                                                                                          |

### P1b-0 — Todo の差分保存（#2332）

| #   | Step                                                                                                                                          | Gate | Acceptance                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------- |
| 1   | `syncToDb` の前で直前のノードと比べ、変わった行だけを `syncTodoTree` に渡す。Todo を足したときは、新しい 1 行と並び順が変わった兄弟だけになる | 🤖   | `shared/tests/todoTreeDiffSync.test.tsx`: 100 件の木に 1 件足すと、渡る行が「1 + 未完了の兄弟の数」になる |

### P1b-ddl と P1b — 差分の取得（#2333）

| #   | Step                                                                                                                                                                                                                            | Gate | Acceptance                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------- |
| 1   | migration を作る（下の「DB Migration Notes」）                                                                                                                                                                                  | 🤖   | ファイルがある                                             |
| 2   | こうだいさんが `supabase db push` を行う                                                                                                                                                                                        | 🛑   | push が成功する                                            |
| 3   | `items_meta.changed_at` と `items_meta_tombstones` があることを確かめる                                                                                                                                                         | 🤖   | `list_tables` で両方ある                                   |
| 4   | `itemChanges.ts`: `items_meta` を role でも `is_deleted` でも絞らずに `changed_at > 基準 − 60 秒` で取り、role ごとに payload を id のまとまりで取る（`fetchByIdChunks` を使う）。削除記録も `deleted_at > 基準 − 60 秒` で取る | 🤖   | 偽のクライアントで、クエリに `changed_at=gt.` が入っている |
| 5   | Daily・Notes（本文なしの一覧）・Todo（`[active, deleted]` の組）について、差分を今の一覧へ反映する処理を書く。今の `keep`（旧フォルダとテンプレートの除外）と `rowsTo*` を使う。role が変わった id は元の領域から外す           | 🤖   | 追加・更新・論理削除・物理削除・role の変更の単体テスト    |
| 6   | `useDomainLoad` に差分のオプションを足す。保存側に基準時刻があれば差分、なければ全件を取る。基準時刻は受け取った `changed_at` の最大値（サーバーの時計）                                                                        | 🤖   | 変更がないときの再検証で、payload へのリクエストが 0 本    |
| 7   | 安全網として、基準時刻が 7 日より古いときと、起動 20 回に 1 回は全件を取る                                                                                                                                                      | 🤖   | テスト                                                     |
| 8   | migration が未適用の環境で `42703` や `PGRST` を受けたら全件の取得に戻す（`SupabaseNotesUnifiedBodySave.ts:33-38,63-67` と同じ形）                                                                                              | 🤖   | テスト                                                     |
| 9   | `tier-1-core.md` の Sync 節・`db-conventions.md` §10・`.claude/CLAUDE.md` §3.3 に `changed_at` と削除記録を書く                                                                                                                 | 🤖   | `git grep -c "changed_at" -- .claude/CLAUDE.md` ≥ 1        |

### P1c — Service Worker と、見るだけのオフライン（#2334）

| #   | Step                                                                                                                                                                                                                                                                        | Gate | Acceptance                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------- |
| 1   | `vite-plugin-pwa` を generateSW で入れる。`web/dist` 全体（遅延読み込みのファイルを含む）を端末に置き、画面の遷移は `index.html` に戻す。Supabase への通信はキャッシュしない（データは IndexedDB が持つ）                                                                   | 🤖   | `cd web && npm run build` が exit 0 で `web/dist/sw.js` がある。端末に置く一覧に `assets/*.js` が全部入っている |
| 2   | Service Worker の登録は Web だけにする（`isNativeMobile()` でも Electron でもないとき）。`_headers` に `/sw.js` の `Cache-Control: no-cache` を足す                                                                                                                         | 🤖   | `grep -c "sw.js" web/public/_headers` ≥ 1                                                                       |
| 3   | 圏外で開いたときに、`getSession()` がネットワークエラーで null を返すか返らない場合でも、保存済みのセッションの user id と保存分があれば、見るだけの状態で MainScreen を出す（supabase-js の圏外での振る舞いは未確認なので最初に確かめる）                                  | 🤖   | `getSession` を null・圏外にすると、見るだけの印付きで MainScreen が描かれる（テスト）                          |
| 4   | 圏外のあいだは `useDomainLoad` が取得を走らせず、エラーの表示も出さない                                                                                                                                                                                                     | 🤖   | テスト                                                                                                          |
| 5   | 圏外のノート一覧は、`isPinned` か「オフラインで作成」の印があるものだけにする。ピン留めしたノートの本文はつながっているときに先に読み、`noteBodyStore` に IndexedDB の層を足して保存する。パスワード付きのノートは保存しない。上限は 50 件か 20MB（実際のデータ量は未確認） | 🤖   | テスト                                                                                                          |
| 6   | `navigator.storage.persist()` を求める。バナーの文言を「オフライン — 見るだけ」にする                                                                                                                                                                                       | 🤖   | i18n のキーがある                                                                                               |
| 7   | 機内モードの iPhone で、Safari・ホーム画面のアプリ・iOS の殻の 3 つを確かめる                                                                                                                                                                                               | 👀   | どれも起動し、前回の Daily・Todo・ピン留めしたノートが見える                                                    |

### P2-ddl — Daily の保存 RPC（#2325 に統合）

`upsert_daily_content(p_date, p_content, p_expected_updated_at)` です。行がなければ meta と payload を作ります（id は `daily-<日付>`）。版が一致すれば保存し、ずれていれば `saved=false` と今の本文と版を返します。書き方は 0032 にそろえます（SECURITY INVOKER・`search_path=''`・authenticated だけに grant）。通信量の削減で Daily の保存を RPC 1 本にまとめる #2325 と同じ関数になるので、#2325 で作ります。

### P2a — 送信待ちの箱と、圏外での Todo の追加（#2335）

| #   | Step                                                                                                                                                                                                                                                                | Gate    | Acceptance                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------- |
| 1   | `outbox.ts`: IndexedDB の `outbox` store に、データの保存とは別の版（`OUTBOX_SCHEMA_VERSION`）を持たせる。**データの保存の版を上げても送信待ちは消さない**。1 件は `{opId, kind, itemId, baseUpdatedAt, baseContent?, payload, createdAt, attempts}`                | 🤖      | テスト                                 |
| 2   | `offlineDataService.ts`: 対象の操作（`createTodo`・`upsertDailyByDateUnified`・`createNoteUnified`・`saveNoteBodyUnified`）だけを包む。圏外か fetch の失敗（TypeError）なら箱に積み、うまくいった前提の結果を返す。`dataServiceFactory.ts` で包み、hooks は変えない | 🤖      | テスト                                 |
| 3   | 送信: 回線が戻ったとき・SUBSCRIBED・起動・画面復帰のたびに、`navigator.locks.request("le-outbox")` で 1 つのタブだけが古い順に送る。セッションが有効になるまで待つ。競合以外の 4xx は「送れなかった変更」の箱に移し、画面から本文をコピーできるようにする           | 🤖      | 2 タブ相当でも二重に送らない（テスト） |
| 4   | 圏外での Todo の追加は、兄弟の並び順を動かさず、`sort_order = 未完了の兄弟の最小値 − 1` で 1 行だけ作る。作成は何度送っても 1 行になる形にする（`upsert(..., {onConflict:"id", ignoreDuplicates:true})`）                                                           | 🤖      | 同じ操作を 2 回送っても行は 1 つ       |
| 5   | 送信待ちの件数をバナーに出す。サインアウトの前に件数を出して確認する                                                                                                                                                                                                | 🤖 / 👀 | —                                      |

### P2b — Daily（#2336）

| #   | Step                                                                                                                                                                                                                                                                                                               | Gate | Acceptance                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | -------------------------------------------------------------------- |
| 1   | 同じ日付の送信待ちは 1 つにまとめる。最初の元の版を残し、本文は最新にする                                                                                                                                                                                                                                          | 🤖   | テスト                                                               |
| 2   | 送信は #2325 の RPC で行う。`saved=false` なら `mergeDocBlocks(base, mine, theirs)`（`blockMerge.ts:170`）で合わせて送り直す。同じブロックを両方で変えていた場合は、両方を並べた結果をそのまま保存する。Daily は 1 日 1 行なので別のノートを作れないためで、今の「両方残す」と同じ意味になる。終わったら通知を出す | 🤖   | 別の段落を編集したら自動で合わさり、同じ段落なら両方が残る（テスト） |
| 3   | 2 つの端末がそれぞれ圏外で同じ日の Daily を新しく作った場合は、元の版がない競合として 2 と同じに扱う                                                                                                                                                                                                               | 🤖   | テスト                                                               |

### P2c — Notes（#2337）

| #   | Step                                                                                                                                                                                                                                                                                                                                                      | Gate | Acceptance                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| 1   | 圏外での作成: id は端末で作るまま（`useNotesUnifiedCRUD.ts:87`）。作成と本文を 1 件として積み、何度送っても 1 つになる形で送る。送るまでは「オフラインで作成」の印を付けて一覧に出す                                                                                                                                                                      | 🤖   | テスト                                                            |
| 2   | ピン留めしたノートの本文の編集: 包む層が `saveNoteBodyUnified` を受け、元の版（IndexedDB の本文と版）を付けて積み、`{status:"saved", updatedAt: base}` を返す。以後の保存は同じ 1 件にまとめる                                                                                                                                                            | 🤖   | テスト                                                            |
| 3   | 送信は今の `update_note_content`（0032）で行う。`conflict` なら `mergeDocBlocks` で合わせ、ぶつかる箇所がなければ合わせた結果を新しい版で送り直す。**ぶつかる箇所があれば、別のノートを作る**（新しい id・題「<元の題>（オフライン編集 YYYY-MM-DD HH:mm）」・本文は自分の版）。サーバーの版は変えない。ノートを開いていれば今の NoteConflictBanner を出す | 🤖   | そのまま保存・自動で合わせる・別のノートを作る、の 3 通りのテスト |
| 4   | 圏外のあいだは、題の変更・ピンの付け外し・削除をできなくする。対象を絞って、競合の種類を増やさない                                                                                                                                                                                                                                                        | 🤖   | テスト                                                            |
| 5   | 実機での往復: iPhone を圏外にして編集し、PC で同じノートを編集してから iPhone の回線を戻す                                                                                                                                                                                                                                                                | 👀   | 別のノートができ、どちらの本文も消えていない                      |

---

## 競合ルール（推奨・こうだいさんの承認待ち）

1. **作成**（Todo・Note）は、id を端末で作り一意なので、ぶつかりません。何度送っても 1 つになる形で送ります。
2. **更新**（Daily・Note の本文）は、元の版（`baseUpdatedAt` と `baseContent`）を付けて積みます。サーバー側の版を比べる RPC で、一致すれば保存します。
3. 版がずれていれば、3-way merge（今の `mergeDocBlocks`）で合わせます。片方だけの変更は自動で取り込みます。
4. 同じブロックを両方で変えていた場合、Notes はサーバーの版を守り、自分の版を別のノートに残します。Daily は両方を本文に並べます（自分の版が先で、今の「両方残す」と同じです）。どちらでもデータは消えません。
5. 時刻（端末でもサーバーでも）で勝ち負けを決めません。

---

## Acceptance Criteria（計画全体）

- [ ] CI の `verify` ジョブと `docs-lint` ジョブが、各 Phase の PR で緑
- [ ] `cd web && npm run build` が exit 0 で、`web/dist/sw.js` がある
- [ ] `shared/tests/syncRealtimeTables.test.ts` が緑（publication は変えない。削除記録の表は購読しない）
- [ ] Supabase に `items_meta.changed_at`・`items_meta_tombstones`・`upsert_daily_content` がある（`list_tables`）
- [ ] PR の差分は 1 Issue あたり ±500 行以内（docs の PR を除く）
- [ ] 終わったら本計画書と per-chat の memory の Status を更新する

---

## DB Migration Notes

**`<番号>_items_meta_changed_at_tombstones.sql`**（begin / commit・何度流しても同じ結果）

- `alter table public.items_meta add column if not exists changed_at timestamptz not null default clock_timestamp();`
- BEFORE INSERT OR UPDATE のトリガーで `new.changed_at := clock_timestamp()` にします（SECURITY INVOKER・`search_path=''`）。**`updated_at` には触れません**。今の LWW と版の比較を変えないためです。
- `create index ... on public.items_meta (user_id, changed_at);`
- `create table public.items_meta_tombstones (id text primary key, user_id uuid not null, role text not null, deleted_at timestamptz not null default clock_timestamp());` に、owner の select だけを許す RLS と、`(user_id, deleted_at)` のインデックスを付けます。
- `items_meta` の AFTER DELETE トリガーで、`insert ... values (old.id, old.user_id, old.role) on conflict (id) do update set deleted_at = excluded.deleted_at` を行います。owner 自身の削除で RLS の insert を通すか、security definer にするかは実装時に決めます。MCP サーバーがどのロールで削除するかは未確認です。
- 今ある行の `changed_at` は default で埋まります。publication は変えません。
- 古い削除記録の掃除は、行が小さいので当面しません。基準時刻が 7 日より古い端末は全件を取ります。

**Daily の保存 RPC** は #2325 の migration に入ります（P2-ddl を参照）。

ロールバックは、逆向きの migration を別のファイルで作ります（列・トリガー・表・関数を drop）。

---

## Risks

- **iOS Safari が保存分を消す**: Safari のタブで開いているサイトは、7 日使わないと IndexedDB・Service Worker の登録・localStorage（ログインのセッションを含む）が消されることがあります。ホーム画面に追加したアプリは対象外です（WebKit の公開している仕様で、この repo では未確認です）。**送っていない送信待ちが消える恐れ**があります。対策は、つながるたびに送ること・送信待ちの件数を出すこと・ホーム画面への追加を案内すること・`storage.persist()` です。iOS の殻（WKWebView）は 7 日の決まりの対象外とされますが、空き容量が足りないときに消される可能性はあります（未確認）。
- **古い形のデータが残る**（D-20260818 の却下理由）: 版が変わったら全部消す・読み戻すときに形を検査する・キーの snapshot テスト、の 3 つで防ぎます。それでも版の上げ忘れは人の注意に頼ります。
- **payload だけを書いて meta を更新しない経路**: `changed_at` は `items_meta` のトリガーでしか動きません。DB-Q2（`db-conventions.md` §10.2）に反する経路があると、差分の取得で漏れます。全件を取る安全網で回収します。反する経路がないかは未確認です。
- **commit の順と時刻のずれ**: `clock_timestamp()` は文を実行した時刻で、commit の順と一致しません。60 秒さかのぼって取り、id で重なりを除きます。
- **Todo の全件 upsert**: P1b-0 で直します。直さないまま圏外の送信を流すと、古い兄弟の値で上書きしかねません。
- **Electron の file://**: IndexedDB が残らない可能性があり、保存はできる範囲で扱います。
- **圏外で開いたときのログイン**（未確認）: P1c の手順 3 が成り立たなければ、見るだけの状態に入れません。
- **データの量**: 件数と本文の大きさは測っていません（Supabase MCP が未認証のため）。P1a の着手前に測ります。
- **Service Worker の更新**: 古いアプリ本体が残り続ける恐れがあります。新しい版を見つけたら再読み込みを促します。

---

## References

- 決定: `.claude/decisions/D-20261021-main-1.md`（本計画の元）・`.claude/decisions/D-20260818-refactor-1.md`（A-2 の却下を置き換えた）
- 移行 SSOT `.claude/2026-05-04-cross-platform-migration.md` §3 表「オフライン」行・§9
- `.claude/docs/vision/core.md`・`.claude/docs/requirements/tier-1-core.md` の Sync 節・`.claude/docs/vision/db-conventions.md` §10
- 先行: #1101（メモリのキャッシュ）・#1407（本文のキャッシュ）・#2057（版を比べる保存と競合の画面）・#499（領域ごとの取り直し）・#2290（通信量の計測）
- skills: `db-migration`・`test-writing`・`add-feature`

---

## Worklog

（実装時に追記します。終わったら、計画と実際のずれを 3 行で書きます）
