# 012: `/sync/changes` の LIMIT=500 と client 側 hasMore 未処理により大規模初回 pull が途切れる

**Status**: Mitigated (Worker 側 LIMIT 引き上げで暫定対応、client 側 pagination 実装が本命 fix)
**Category**: Bug / Sync
**Severity**: Important
**Discovered**: 2026-04-22
**Resolved (partial)**: 2026-04-22

## Symptom

新規インストールの iOS(または Desktop)で初回 Sync Now を実行すると、特定日付の schedule_items / notes / memos が UI に表示されない。ユーザー報告では 4/14〜4/22 の routine が iOS 側で欠落。

Cloud D1 と Desktop SQLite は完全一致(schedule_items 796 active / notes 26 / tasks 82 / ... が両端で同値)、つまり Desktop ↔ Cloud 同期は健全だが、**iOS ↔ Cloud だけが不完全**。

診断クエリで確認:

- 初回 pull の `since = 1970-01-01` で `/sync/changes` が返すのは **updated_at 昇順の先頭 500 行のみ**
- 500 行目は `updated_at = 2026-04-11 07:58:44`
- それ以降に更新された 4/14〜4/22 の行(routine 由来 schedule_items, notes の編集など)が丸ごと欠落
- レスポンスに `hasMore: true` が含まれるが、Rust client は使わずに一度で終了

## Root Cause

**2 層の設計ミスマッチ**:

### 1. Cloud Worker 側 — ページングしない LIMIT

`cloud/src/routes/sync.ts:102` で `/sync/changes` 全テーブル共通 `LIMIT = 500`:

```ts
const LIMIT = 500;
// ...
.prepare(`SELECT * FROM ${table} WHERE updated_at > ?1 ORDER BY updated_at ASC LIMIT ?2`)
.bind(since, LIMIT + 1)
```

- 500 を超えたら `hasMore = true` を返すが、cursor / next-since を返さない
- クライアントが次回クエリを組み立てられない作りだった(hasMore を見ても「続きがある」としか分からない)

### 2. Rust client — hasMore を無視

`src-tauri/src/sync/types.rs:50` で `has_more: bool` フィールドは定義済み。しかし `sync_engine.rs` / `sync_client.rs` のいずれでも参照されていない(grep で使用箇所 0 件)。

→ クライアントは 500 行だけ受信して「完了」と判定し、`last_synced_at` を `response.timestamp`(現在時刻)に更新 → 次回以降は残り 296 行が永久に pull されない。

## Impact

- **新規端末**: 初回 pull で最新のデータほど欠落しやすい(updated_at 古い順に切れるため、最近の編集が丸ごと落ちる)
- **既存端末**: last_synced_at が最近なら delta が小さいので 500 行上限に触れにくく、普段は顕在化しない
- **iOS 再インストール**: 本件の直撃ケース

## Fix / Workaround

### 即時対応(Worker 側 LIMIT 引き上げ)

`cloud/src/routes/sync.ts` で `LIMIT = 500 → 5000` に引き上げ、redeploy。現行データ量(各テーブル 1,000 行以下)では 5000 で全件カバー。

CF Workers レスポンスサイズ制限(100MB)や D1 メモリに対しても余裕あり。

### 本命対応(後日、別セッション)

**Cloud Worker 側**:

- `/sync/changes` のレスポンスに `nextSince` (最後に返した行の updated_at) を含める
- client はこれを次のリクエストの `since` として使い、hasMore=false まで loop

**Rust client 側**:

- `sync_engine::apply_remote_changes` 呼び出しを `while has_more { ... }` ループ化
- `last_synced_at` は **全ページ完了後** にのみ更新
- 中途半端に止まった場合は次回の Sync Now で再開できるよう、現在の `since` を永続化せず in-memory で保持

## References

- 修正コミット(Worker 側 LIMIT 5000): (次コミット)
- 関連 Known Issue:
  - #011 schedule_items 重複: 本件と同じ「sync エンジン設計の漏れ」系統
  - #010 Notes/Memos mutation delta 脱落: sync エンジン改修案件
- Cloud Worker コード:
  - `cloud/src/routes/sync.ts:64-87` `/sync/full`(全件取得、LIMIT 無し。代替経路としてこちらを使う手も)
  - `cloud/src/routes/sync.ts:92-198` `/sync/changes`(delta, LIMIT あり)
- Rust client:
  - `src-tauri/src/sync/types.rs:50` `has_more: bool` field
  - `src-tauri/src/sync/sync_engine.rs` / `src-tauri/src/sync/sync_client.rs` — 呼び出し実装

## Lessons Learned

- **client と server で分散した flag** は片方が使い忘れると静かに壊れる。`has_more` を server が返し始めた時点で client 側の受け皿も同時に必要だった
- **delta sync の cap 設計は cursor ベースが正解**。単純 LIMIT + hasMore は pagination の半実装にしかならない
- **初回同期だけは /sync/full を強制する選択肢も検討価値あり**。delta クエリは small-delta 向け、初回は full fetch 固定のほうが設計が単純
- **検索キーワード**: `sync limit 500`, `hasMore truncate`, `pagination next-since`, `initial full pull missing recent`
