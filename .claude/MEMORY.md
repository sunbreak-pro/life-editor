# MEMORY.md - タスクトラッカー

## 進行中

（なし）

## 直近の完了

- Notes / Memos Obsidian 風知識結晶化 Phase 1 ✅（2026-04-19） — DB V61 (`note_links` / `note_aliases`) + Rust repository/commands（IPC 4 点同期済）+ TipTap `NoteLink` Extension + `[[` auto-complete + `BacklinksPane`（ノート単位 + Unlinked Mentions タブ）+ WikiTag 記法分離（`[[…]]` → `#…`）+ i18n en/ja 同期。計画書: 外部 `~/.claude/plans/1-notes-memos-notes-2-binary-muffin.md`。Phase 2+（Properties / Embed / BlockRef / LocalGraph / MCP 5 ツール / V62-V64）は次セッション以降。Vitest 213 / Cargo test 8 全 pass。
- vision/ 整理 + Mobile 移植計画ドキュメント化 ✅（2026-04-19） — `.claude/docs/vision/` を「設計原則 + 次フェーズ計画」の 4 ファイル（coding-principles / core / mobile-porting / desktop-followup）に再編。Cognitive 構想（ai-integration.md）と役目終了テンプレを削除し、主戦場の Mobile 移植計画と Desktop 残課題メモを新設。CLAUDE.md の陳腐化参照を同時整理（341 行、400 行上限内）。
- ディスク容量削減（12GB → 3.7GB / -69%）✅（2026-04-19） — 孤立ワークツリー `jovial-shannon`（別プロジェクト sonic-flow 残骸 886MB）削除、`git gc` で loose 5547 個を pack 化（117MB → 79MB）、`src-tauri/target/{debug,release}`（7.0GB）と全 node_modules 削除 → frontend + mcp-server のみ再インストール。iOS target（aarch64-apple-ios + gen/apple 3.3GB）は保持。全操作をゴミ箱経由で実施し復元可能。

## 予定

### Mobile Schedule & Work リデザイン 手動 UI 検証

**対象**: iPhone シミュレータ / Tauri build で Schedule 月カレンダー / Dayflow / Work 全項目を目視検証
**参照**: `.claude/archive/2026-04-18-mobile-schedule-work-redesign.md` §Verification
**観点**: DayCell の chip 均等 grid / bottom sheet drag / FAB 位置アニメ / Dayflow now line / Work session pill + halo

### Known Issues Active 2 件の調査

- **004 sync_last_synced_at が保存されない** — delta sync が機能せず毎回フル push。`src-tauri/src/commands/sync_commands.rs:87` 調査
- **005 tasks.updated_at NULL on creation** — task 作成パスで updated_at を set していない根本バグ。`src-tauri/src/db/task_repository.rs` 周辺調査

### 保留（将来再評価）

- **S-2**: Tauri IPC naming 方針 — ADR-0006 で規約のみ採択、150 コマンド一括 typed struct 移行は未着手
- **React Compiler 有効化**: S-4 Drop 判定時に切り離し（TaskTree 以外での効果は別途検証必要）
