# MEMORY (chat-main)

## 進行中

（なし）

## 直近の完了

- DU-C 全 7 ステップ完了（Routines + RoutineGroups + Assignments + ScheduleItems 全 Service 本実装 + RoutineScheduleSync 復活 + 0011 migration 本番適用）✅（2026-05-24）
- 並行作業基盤強化（Stop hook + Plan Gate Convention + 計画書テンプレ + CLAUDE.md §7.3）✅（2026-05-24）
- Schedule 無限ループ修正（RoutineScheduleSync no-op 化）✅（2026-05-23）

## 予定

- 👀 ユーザー実機確認待ち: DU-C-6 (Routine 作成/削除/復元 + 月またぎ ループ防止 + key duplicate 警告ゼロ)
- DU-D 本実装（Notes + Daily を items_meta + notes_payload / dailies_payload に乗せ替え）
- CLAUDE.md §4.3 一行追記（composite FK pattern。並行チャットの CLAUDE.md 編集完了同期後）
- DU-B 子計画書 + 詳細計画書の archive 移動（DU-B 全体クローズ時）
