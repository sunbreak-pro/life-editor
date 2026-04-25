# 012: `/sync/changes` の LIMIT=500 + client hasMore 未処理で初回 pull が途切れる

**Status**: Mitigated（Worker 側 LIMIT 引き上げで暫定対応、本命は client pagination）
**Category**: Bug / Sync
**Severity**: Important
**Discovered**: 2026-04-22
**Resolved (partial)**: 2026-04-22

## Symptom

新規インストール iOS で初回 Sync Now を実行すると 4/14〜4/22 の routine 由来 schedule_items / notes / memos が UI に欠落。Desktop ↔ Cloud は完全一致だが iOS ↔ Cloud だけ不完全。

診断: 初回 `since=1970-01-01` で `/sync/changes` が `updated_at` 昇順の先頭 500 行のみ返す（500 行目 = `2026-04-11 07:58:44`）。それ以降の 296 行が欠落。レスポンスに `hasMore: true` 含むが Rust client は使わず一度で終了。

## Root Cause

**2 層の設計ミスマッチ**:

### 1. Cloud Worker — ページングしない LIMIT

`cloud/src/routes/sync.ts:102` で全テーブル共通 `LIMIT = 500`。500 超過で `hasMore=true` を返すが **cursor / next-since を返さない** → クライアントが続きをクエリできない作りだった。

### 2. Rust client — hasMore を無視

`src-tauri/src/sync/types.rs:50` で `has_more: bool` フィールド定義済みだが `sync_engine.rs` / `sync_client.rs` の **どこでも参照されていない**（grep で 0 件）。クライアントは 500 行受信して「完了」と判定 → `last_synced_at = response.timestamp`（現在時刻）に更新 → 残り 296 行は永久に pull されない。

## Impact

- 新規端末: 初回 pull で `updated_at` 古い順に切れるため、最近の編集が丸ごと落ちる
- 既存端末: last_synced_at が最近で delta 小なら 500 上限に触れず顕在化しない
- iOS 再インストール: 直撃ケース

## Fix / Workaround

### 即時（適用済）

`cloud/src/routes/sync.ts` で `LIMIT = 500 → 5000` に引き上げ + redeploy。現行データ量（各テーブル 1,000 行以下）で全件カバー。CF Workers 100MB / D1 メモリ余裕あり。

### 本命（後日、別セッション）

**Worker 側**: `/sync/changes` レスポンスに `nextSince`（最後に返した行の updated_at）を含める。

**Rust client 側**:

- `sync_engine::apply_remote_changes` を `while has_more { ... }` ループ化
- `last_synced_at` は **全ページ完了後** にのみ更新
- 中途停止時は次回 Sync Now で再開できるよう `since` を永続化せず in-memory 保持

## References

- `cloud/src/routes/sync.ts:64-87`(`/sync/full`、LIMIT 無し代替経路)/ `:92-198`(`/sync/changes`)
- `src-tauri/src/sync/types.rs:50` `has_more: bool` / `sync_engine.rs` / `sync_client.rs`
- 関連: #011（同じ「sync エンジン設計漏れ」系）

## Lessons Learned

- **client/server 分散 flag** は片方が使い忘れると静かに壊れる。`has_more` を server が返し始めた時点で client 側受け皿も同時に必要だった
- **delta sync の cap 設計は cursor ベースが正解**。単純 LIMIT + hasMore は半実装
- **初回同期だけ `/sync/full` を強制する選択肢**も検討価値あり。delta は small-delta 向け、初回 full fetch 固定の方が単純
- 検索: `sync limit 500`, `hasMore truncate`, `pagination next-since`, `initial full pull missing recent`
