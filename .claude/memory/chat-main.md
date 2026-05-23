# MEMORY (chat-main)

## 進行中

（なし）

## 直近の完了

- Schedule 無限ループ修正（RoutineScheduleSync no-op 化）✅（2026-05-23）
- DU-C/D pending stubs（8 services 一時 no-op）✅（2026-05-23）
- DU-B-6 partial（db-conventions §10 + known-issues 021-024）✅（2026-05-23）

## 予定

- DU-C 本実装（Routines + RoutineGroups + ScheduleItems を items_meta + routines_payload / events_payload に乗せ替え、RoutineScheduleSync を復活）
- DU-D 本実装（Notes + Daily を items_meta + notes_payload / dailies_payload に乗せ替え）
- CLAUDE.md §4.3 一行追記（composite FK pattern。並行チャットの CLAUDE.md 編集完了同期後）
- DU-B 子計画書 + 詳細計画書の archive 移動（DU-B 全体クローズ時）
