# Known Issues Index

未解決 Issue + 解決済みバグの Root Cause を一覧管理するインデックス。Claude / 開発者が再発時に最短で過去知見に辿り着くための入口。

**運用**: Issue を追加・更新したら本 INDEX も必ず更新する。詳細は各 Issue ファイルへ。

---

## Active（未解決）

（なし）

## Monitoring（すぐ対処しないが監視）

| ID  | Title                                                                                     | Category   | Since      |
| --- | ----------------------------------------------------------------------------------------- | ---------- | ---------- |
| 006 | [Desktop app_data_dir が bundle ID で分裂](./006-desktop-data-dir-bundle-id-migration.md) | Structural | 2026-04-18 |

## Fixed（Root Cause 参考、再発防止用）

| ID  | Title                                                                                                                                 | Category            | Resolved   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------- |
| 001 | [Cloud Sync 立ち上げ schema/FK 3 連戦（予約語 / FK 順序 / schema drift）](./001-cloud-sync-bootstrap-schema-fk.md)                    | Bug/Schema          | 2026-04-18 |
| 004 | [sync_last_synced_at が空で毎回 1970 から fullpush](./004-sync-last-synced-at-not-persisted.md)                                       | Bug                 | 2026-04-20 |
| 005 | [tasks.updated_at が NULL（Cloud Sync 対象除外）](./005-tasks-updated-at-null-on-creation.md)                                         | Bug/Schema          | 2026-04-20 |
| 007 | [XcodeGen 再生成で pbxproj 設定が消える](./007-xcodegen-pbxproj-config-drift.md)                                                      | Tooling             | 2026-04-18 |
| 008 | [routine/group tag_assignments が delta sync に乗らず Desktop から消える](./008-routine-tag-assignments-delta-sync-invisible.md)      | Bug/Sync            | 2026-04-20 |
| 009 | [Mobile 画面が Provider をバイパスして DataService 直呼び（データ伝播が非対称）](./009-mobile-data-parity-provider-bypass.md)         | Structural          | 2026-04-20 |
| 010 | [Notes 移動/並び替えと Memos 削除/復元が delta sync から脱落](./010-notes-memos-mutation-skipped-by-delta-sync.md)                    | Bug/Sync            | 2026-04-20 |
| 011 | [schedule_items の (routine_id, date) 重複が Cloud D1 に蓄積](./011-schedule-items-routine-date-duplication.md)                       | Bug/Schema/Sync     | 2026-04-21 |
| 012 | [/sync/changes LIMIT=500 + client hasMore 未処理で初回 pull が途切れる](./012-sync-changes-limit-500-truncates-large-initial-pull.md) | Bug/Sync            | 2026-04-22 |
| 013 | [delta sync cursor の 2 根本欠陥（timestamp 形式混在 + 非単調 LWW）](./013-delta-sync-cursor-design-flaws.md)                         | Bug/Sync/Structural | 2026-04-24 |
| 015 | [Mobile で `notion-*-primary` サフィックス誤用 / 27 箇所背景透明化](./015-mobile-invalid-tailwind-primary-suffix.md)                  | Bug/Styling         | 2026-04-24 |

---

## Category 別インデックス

- **Bug**: 001, 004, 005, 008, 010, 011, 012, 013, 015
- **Schema**: 001, 005, 011, 013
- **Sync**: 008, 010, 011, 012, 013
- **Structural**: 001, 006, 009, 013
- **Tooling**: 007
- **Styling**: 015

## Status 集計

- Active: 0 件
- Monitoring: 1 件 (006)
- Fixed: 10 件
- 合計: 11 件

## 統合履歴

- 2026-04-25 — 旧 002 (FK 制約) / 003 (template_id schema drift) を **001** に統合
- 2026-04-25 — 旧 014 (非単調 updated_at) を **013** に統合（同一系統「delta sync cursor 設計欠陥」）

---

## 新規 Issue の起票手順

1. `_TEMPLATE.md` をコピーして `NNN-<slug>.md` を作成（NNN は連番）
2. Status / Category / Severity / Discovered を記入
3. 本 `INDEX.md` の該当セクション（Active / Monitoring / Fixed）に 1 行追加
4. Fixed に移す際は Active から削除 + Resolved 日付付きで Fixed に追記
