# 010: Notes 移動/並び替えと Memos 削除/復元が Cloud Sync の delta から脱落する

**Status**: Fixed
**Category**: Bug / Sync
**Severity**: Important
**Discovered**: 2026-04-20
**Resolved**: 2026-04-20 （コード修正のみ。既存の壊れた状態はユーザー側の手動再操作で復旧する方針で確定）

## Symptom

Desktop で行った以下の操作が iOS に反映されない（逆も同様）:

- **Note のフォルダ移動 / 並び替え（DnD）**: 移動先が他端末に伝わらない
- **Memo のゴミ箱削除**: 削除済みなのに他端末の一覧に残る
- **Memo のゴミ箱からの復元**: 復元したのに他端末の一覧に戻らない

一方、Note の本文/タイトル編集や isPinned トグルは正常に同期される。ユーザーからは「Note の一部だけ反映される」という見え方になる。

Cloud Sync 自体は動作しており、`pushed: 6, pulled: 6` のように双方向に流れているが、特定の操作だけが delta から抜け落ちる。

## Root Cause

Cloud Sync の delta 収集クエリは `WHERE updated_at > since`（`src-tauri/src/sync/sync_engine.rs:157-173`）。つまり `updated_at` が bump されない mutation はすべて sync から脱落する。

以下の 3 箇所で `updated_at` / `version` が bump されていなかった:

### Bug 1: `src-tauri/src/db/note_repository.rs` `sync_tree`（L138-150）

DnD で parent_id / order_index を UPDATE するが、`updated_at` / `version` を触らない:

```rust
// Before
tx.execute(
    "UPDATE notes SET parent_id = ?1, order_index = ?2 WHERE id = ?3",
    params![parent_id, order, id],
)?;
```

### Bug 2 & 3: `src-tauri/src/db/helpers.rs` `soft_delete_by_key` / `restore_by_key`（L49-76）

Memos が主キーとして `date` を使うため `_by_key` 版 helpers を経由する。これらは `updated_at` / `version` を触らない:

```rust
// Before
"UPDATE \"{table}\" SET is_deleted = 1, deleted_at = datetime('now') WHERE \"{key_col}\" = ?1"
```

対照的に integer-id 版 `helpers::soft_delete` / `helpers::restore`（Notes が使用）は正しく `updated_at` / `version` を bump している。key_col ベースの helpers だけが抜けていた。

## Impact

- **ユーザー**: Desktop ↔ iOS で「Note を整理したのに他端末で散らかる」「削除したメモがゾンビ化する」「復元したメモが行方不明になる」
- **開発者**: Cloud Sync のテスト時に pushed/pulled の数字だけ見ていると気付かない（数字上は流れているため）
- **頻度**: DnD / メモ削除を使うたびに発生

Issue #005（tasks.updated_at NULL）と同じ構造的カテゴリ: **mutation 経路ごとに `updated_at` を bump する責任が分散している**。

## Fix / Workaround

### コード修正（2026-04-20 実施）

1. `helpers::soft_delete_by_key` / `restore_by_key` に `version = version + 1, updated_at = datetime('now')` を追加
2. `note_repository::sync_tree` に同上を追加

以降の新規 DnD 移動・メモ削除は delta sync に乗る。

### バックフィル migration は作らない（方針確定）

**migration は追加しない**方針で確定（2026-04-20、ユーザー選択 (A)）。理由:

- 別セッションで V63 が既に commit + Desktop/D1 適用済（`f8b77c5`、Issue #011 対応）。V63 の内容変更は既存環境には反映されないため不可
- V64 を新規追加して全 Notes/Memos の `updated_at = now()` を bump する案もあったが、**iOS 側に Desktop に無い最近の編集があった場合、last-write-wins で失われるリスク**がある
- 壊れた実体は「Note フォルダ位置ズレ」「ゾンビメモ数件」程度で、手動復旧コストが十分低い
- migration 追加は別セッションとの rebase コストも増やす

### 復旧手順（ユーザー側）

コード修正を iOS に deploy した後:

- **位置がズレている Note**: 一度目的のフォルダに DnD 移動し直す → 以降は正常同期
- **ゾンビ化している Memo**: もう一度 delete / restore を toggle する → 以降は正常同期

これで以降の新規操作は確実に delta sync に乗る。過去の「壊れた」状態は操作時点で自動的に上書きされる。

## References

- 関連ファイル:
  - `src-tauri/src/db/helpers.rs:49-76`（修正済み）
  - `src-tauri/src/db/note_repository.rs:138-150`（修正済み）
  - `src-tauri/src/db/memo_repository.rs:67-80`（呼び出し元、変更不要）
  - `src-tauri/src/sync/sync_engine.rs:157-173`（delta クエリ）
- 関連 Issue:
  - `005-tasks-updated-at-null-on-creation.md` — 同じ構造カテゴリ
  - `008-routine-tag-assignments-delta-sync-invisible.md` — 同じ「delta 脱落」カテゴリ
- 関連 Plan: `.claude/docs/vision/plans/2026-04-20-mobile-data-parity-phase-a-b.md`（Phase B 実装時に sync_engine を調査して発見）

## Lessons Learned

- **全 UPDATE 経路は `updated_at` を bump する責任を負う**。Repository 層の helper 関数でも例外なし。key_col 版とデフォルト id 版で挙動を揃える
- **`pushed: N, pulled: N` の数字だけでは sync 健全性は判断できない**。「どの操作が delta に乗っているか」を UPDATE 文単位で確認する必要がある
- 類似バグ検索用キーワード: "sync_tree updated_at", "soft_delete_by_key version", "delta sync skipped", "WHERE updated_at > since", "DnD 反映されない", "メモ 削除 同期 残る"
- チェックリスト: 新規 Repository 関数を書くとき「この UPDATE は Cloud Sync 対象テーブルか？ Yes なら `updated_at = datetime('now'), version = version + 1` を忘れていないか？」
