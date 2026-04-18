# MEMORY.md - タスクトラッカー

## 進行中

（なし — Phase C 4 件完遂 + 今セッション 3 件完遂）

## 直近の完了

- Known Issues ディレクトリ新設（7 件 seed + CLAUDE.md §0/§12 参照追記、`.claude/docs/known-issues/` 運用開始）✅（2026-04-18）
- Cloud Sync 有効化完了（Workers/Rust の複数バグ修正 + Mac↔iPhone 双方向同期動作確認、Known Issues 001-007 として記録）✅（2026-04-18）
- iOS 実機ビルド対応完了（Xcode 署名 + Tauri CLI デプロイ + 手順 Note 保存 / `project.yml` 恒久修正）✅（2026-04-18）

## 予定

### CLAUDE.md ビジョン素案レビュー（任意、いつでも可）

**対象**: `.claude/CLAUDE.md` §1-5 / §8.3-8.4（「素案 — ユーザーレビュー待ち」マーク付与済み）
**レビュー観点**: Core Identity / Target User / Value Propositions / Non-Goals / AI Integration シナリオ

### Known Issues Active 2 件の調査

- **004 sync_last_synced_at が保存されない** — delta sync が機能せず毎回フル push。`src-tauri/src/commands/sync_commands.rs:87` 調査
- **005 tasks.updated_at NULL on creation** — task 作成パスで updated_at を set していない根本バグ。`src-tauri/src/db/task_repository.rs` 周辺調査

### 保留（将来再評価）

- **S-2**: Tauri IPC naming 方針 — ADR-0006 で規約のみ採択、150 コマンド一括 typed struct 移行は未着手
- **React Compiler 有効化**: S-4 Drop 判定時に切り離し（TaskTree 以外での効果は別途検証必要）
