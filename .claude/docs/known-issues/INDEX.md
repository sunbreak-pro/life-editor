# Known Issues Index

未解決 Issue と解決済みバグの Root Cause を一覧管理するインデックス。Claude / 開発者が再発時に最短で過去知見に辿り着くための入口。

**運用**: Issue を追加・更新したらこの INDEX.md も必ず更新する。詳細記述は各 Issue ファイルへ。

---

## Active（未解決）

（なし）

## Monitoring（すぐ対処しないが監視）

| ID  | Title                                                                                     | Category   | Since      |
| --- | ----------------------------------------------------------------------------------------- | ---------- | ---------- |
| 006 | [Desktop app_data_dir が bundle ID で分裂](./006-desktop-data-dir-bundle-id-migration.md) | Structural | 2026-04-18 |

## Fixed（Root Cause 参考、将来の再発防止用）

| ID  | Title                                                                                                                                     | Category            | Resolved   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------- |
| 001 | [Cloud Sync SQL 予約語 `order` エスケープ漏れ](./001-cloud-sync-sql-reserved-word.md)                                                     | Bug/Schema          | 2026-04-18 |
| 002 | [Cloud Sync FK 制約違反（テーブル依存順）](./002-cloud-sync-fk-constraint-ordering.md)                                                    | Bug/Schema          | 2026-04-18 |
| 003 | [schedule_items.template_id の schema drift](./003-schedule-items-template-id-schema-drift.md)                                            | Schema/Structural   | 2026-04-18 |
| 004 | [sync_last_synced_at が保存されない](./004-sync-last-synced-at-not-persisted.md)                                                          | Bug                 | 2026-04-20 |
| 005 | [tasks.updated_at が NULL](./005-tasks-updated-at-null-on-creation.md)                                                                    | Bug/Schema          | 2026-04-20 |
| 007 | [XcodeGen 再生成で pbxproj 設定が消える](./007-xcodegen-pbxproj-config-drift.md)                                                          | Tooling             | 2026-04-18 |
| 008 | [routine/group tag_assignments が delta sync に乗らず Desktop から消える](./008-routine-tag-assignments-delta-sync-invisible.md)          | Bug/Sync            | 2026-04-20 |
| 011 | [schedule_items の (routine_id, date) 重複が Cloud D1 に蓄積](./011-schedule-items-routine-date-duplication.md)                           | Bug/Schema/Sync     | 2026-04-21 |
| 012 | [/sync/changes の LIMIT=500 と client hasMore 未処理で初回 pull が途切れる](./012-sync-changes-limit-500-truncates-large-initial-pull.md) | Bug/Sync            | 2026-04-22 |
| 013 | [updated_at の timestamp 形式混在で delta sync が同日編集を凍結する](./013-timestamp-format-mismatch-delta-sync-freeze.md)                | Bug/Sync/Schema     | 2026-04-23 |
| 014 | [delta sync が updated_at の非単調性に対応できず高 version 行が pull から漏れる](./014-delta-sync-nonmonotonic-updated-at.md)             | Bug/Sync/Structural | 2026-04-24 |
| 015 | [Mobile で `notion-*-primary` サフィックス誤用 / 27 箇所背景透明化](./015-mobile-invalid-tailwind-primary-suffix.md)                      | Bug/Styling         | 2026-04-24 |

---

## Category 別インデックス

- **Bug**: 001, 002, 004, 005, 008, 011, 012, 013, 014, 015
- **Schema**: 001, 002, 003, 005, 011, 013
- **Sync**: 008, 011, 012, 013, 014
- **Structural**: 003, 006, 014
- **Tooling**: 007
- **Styling**: 015

## Status 集計

- Active: 0 件
- Monitoring: 1 件 (006)
- Fixed: 12 件
- 合計: 13 件

---

## 新規 Issue の起票手順

1. `_TEMPLATE.md` をコピーして `NNN-<slug>.md` を作成（NNN は連番）
2. Status / Category / Severity / Discovered を記入
3. この `INDEX.md` の該当セクション（Active / Monitoring / Fixed）に 1 行追加
4. Fixed に移す際は Active セクションから削除 + Fixed セクションに Resolved 日付付きで追記
