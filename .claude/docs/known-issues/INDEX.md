# Known Issues Index

未解決 Issue + 解決済みバグの Root Cause を一覧管理するインデックス。Claude / 開発者が再発時に最短で過去知見に辿り着くための入口。

**運用**: Issue を追加・更新したら本 INDEX も必ず更新する。詳細は各 Issue ファイルへ。

---

## Active（未解決）

| ID  | Title                                                                                                                           | Category | Since      |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| 028 | [Bash の `cd` が worktree を跨いで持続し、以降の相対パス操作が別 worktree に着地する](./028-bash-cwd-drift-across-worktrees.md) | Tooling  | 2026-05-26 |
| 027 | [Notes/Daily password が plaintext で保存される (N>1 化前に必須)](./027-notes-password-plaintext-debt.md)                       | Security | 2026-05-24 |
| 026 | [PostToolUse formatter が隣接する Markdown 見出しを削除する](./026-posttooluse-formatter-deletes-adjacent-heading.md)           | Tooling  | 2026-05-24 |

## Monitoring（すぐ対処しないが監視）

| ID  | Title                                                                                     | Category   | Since      |
| --- | ----------------------------------------------------------------------------------------- | ---------- | ---------- |
| 006 | [Desktop app_data_dir が bundle ID で分裂](./006-desktop-data-dir-bundle-id-migration.md) | Structural | 2026-04-18 |

## Fixed（Root Cause 参考、再発防止用）

| ID  | Title                                                                                                                                                         | Category            | Resolved   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------- |
| 029 | [並行チャットが W8 Schedule 週グリッドを二重実装 → merge で dead import が main を破壊](./029-parallel-chats-double-implemented-w8-dead-import-broke-main.md) | Structural/Tooling  | 2026-06-20 |
| 001 | [Cloud Sync 立ち上げ schema/FK 3 連戦（予約語 / FK 順序 / schema drift）](./001-cloud-sync-bootstrap-schema-fk.md)                                            | Bug/Schema          | 2026-04-18 |
| 004 | [sync_last_synced_at が空で毎回 1970 から fullpush](./004-sync-last-synced-at-not-persisted.md)                                                               | Bug                 | 2026-04-20 |
| 005 | [tasks.updated_at が NULL（Cloud Sync 対象除外）](./005-tasks-updated-at-null-on-creation.md)                                                                 | Bug/Schema          | 2026-04-20 |
| 007 | [XcodeGen 再生成で pbxproj 設定が消える](./007-xcodegen-pbxproj-config-drift.md)                                                                              | Tooling             | 2026-04-18 |
| 008 | [routine/group tag_assignments が delta sync に乗らず Desktop から消える](./008-routine-tag-assignments-delta-sync-invisible.md)                              | Bug/Sync            | 2026-04-20 |
| 009 | [Mobile 画面が Provider をバイパスして DataService 直呼び（データ伝播が非対称）](./009-mobile-data-parity-provider-bypass.md)                                 | Structural          | 2026-04-20 |
| 010 | [Notes 移動/並び替えと Memos 削除/復元が delta sync から脱落](./010-notes-memos-mutation-skipped-by-delta-sync.md)                                            | Bug/Sync            | 2026-04-20 |
| 011 | [schedule_items の (routine_id, date) 重複が Cloud D1 に蓄積](./011-schedule-items-routine-date-duplication.md)                                               | Bug/Schema/Sync     | 2026-04-21 |
| 012 | [/sync/changes LIMIT=500 + client hasMore 未処理で初回 pull が途切れる](./012-sync-changes-limit-500-truncates-large-initial-pull.md)                         | Bug/Sync            | 2026-04-22 |
| 013 | [delta sync cursor の 2 根本欠陥（timestamp 形式混在 + 非単調 LWW）](./013-delta-sync-cursor-design-flaws.md)                                                 | Bug/Sync/Structural | 2026-04-24 |
| 015 | [Mobile で `notion-*-primary` サフィックス誤用 / 27 箇所背景透明化](./015-mobile-invalid-tailwind-primary-suffix.md)                                          | Bug/Styling         | 2026-04-24 |
| 016 | [タスクツリー走査が循環 parentId で無限ループ → V8 OOM](./016-task-tree-traversal-cycle-oom.md)                                                               | Bug/Structural      | 2026-05-16 |
| 017 | [カレンダーに削除済みタスクが残る / Routine 削除後も schedule_items 再生成](./017-calendar-soft-deleted-task-and-routine-regeneration.md)                     | Bug/Structural      | 2026-05-15 |
| 018 | [macOS WebKit で button クリックが focus を奪わず autoFocus input の blur が先行](./018-macos-webkit-button-no-focus-shift.md)                                | Bug/Structural      | 2026-04-26 |
| 019 | [createPortal 配下 DOM 分離で click-outside 誤発火しパネル即閉じ](./019-createportal-clickoutside-misfire.md)                                                 | Bug/Structural      | 2026-04-26 |
| 020 | [Notes 保存で 406 Cannot coerce（楽観 create × `.single()` read-then-write レース）](./020-supabase-readthenwrite-single-zero-row-race.md)                    | Bug                 | 2026-05-17 |
| 021 | [PG generated stored 列 + composite FK + SET NULL 不可](./021-pg-generated-composite-fk-set-null-forbidden.md)                                                | Bug/Schema          | 2026-05-23 |
| 022 | [Supabase SQL Editor の postgres role で auth.uid() が NULL](./022-supabase-sql-editor-postgres-role-auth-uid-null.md)                                        | Tooling/Security    | 2026-05-23 |
| 023 | [Supabase CLI v2.101 の check-rls 出力が CSV 化され流し直し不能](./023-supabase-cli-v2-101-check-rls-csv-output-rejected.md)                                  | Tooling             | 2026-05-23 |
| 024 | [PG 2BP01 依存連鎖で migration 再 drop が止まる](./024-pg-2bp01-dependency-chain-on-redrop.md)                                                                | Schema/Tooling      | 2026-05-23 |
| 025 | [prototype+mobile-ui worktree の CLAUDE.md が per-chat 化前のスナップショット](./025-prototype-worktree-claude-md-pre-per-chat.md)                            | Structural          | 2026-05-24 |

---

## Category 別インデックス

- **Bug**: 001, 004, 005, 008, 010, 011, 012, 013, 015, 016, 017, 018, 019, 020, 021
- **Schema**: 001, 005, 011, 013, 021, 024
- **Sync**: 008, 010, 011, 012, 013
- **Structural**: 001, 006, 009, 013, 016, 017, 018, 019, 025
- **Tooling**: 007, 022, 023, 024, 026
- **Security**: 022
- **Styling**: 015

## Status 集計

- Active: 3 件 (028, 027, 026)
- Monitoring: 1 件 (006)
- Fixed: 21 件
- 合計: 25 件

## 統合履歴

- 2026-04-25 — 旧 002 (FK 制約) / 003 (template_id schema drift) を **001** に統合
- 2026-04-25 — 旧 014 (非単調 updated_at) を **013** に統合（同一系統「delta sync cursor 設計欠陥」）

---

## 新規 Issue の起票手順

1. `_TEMPLATE.md` をコピーして `NNN-<slug>.md` を作成（NNN は連番）
2. Status / Category / Severity / Discovered を記入
3. 本 `INDEX.md` の該当セクション（Active / Monitoring / Fixed）に 1 行追加
4. Fixed に移す際は Active から削除 + Resolved 日付付きで Fixed に追記
