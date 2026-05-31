# Autonomous Development Routine

> Anthropic Cloud Routine 2 本（夜 22:00 / 朝 06:00 JST）が life-editor の開発を半自律で前進させる仕組みの SSOT。
> 計画書: [`../docs/vision/plans/2026-05-26-autonomous-dev-routine.md`](../docs/vision/plans/2026-05-26-autonomous-dev-routine.md)

---

## ファイル構成

| ファイル                 | 用途                                                                  | 書込頻度                            |
| ------------------------ | --------------------------------------------------------------------- | ----------------------------------- |
| `README.md`              | このファイル。全体構造の入口                                          | 改訂時のみ                          |
| `goals.md`               | Goal Roadmap（Goal 1〜3）の現在状態 SSOT                              | 朝 Routine が更新、ユーザー手動可   |
| `routine-night.md`       | 夜 22:00 JST 発火の Engineer プロンプト本文                           | 改訂時のみ                          |
| `routine-morning.md`     | 朝 06:00 JST 発火の PM プロンプト本文（MVP 後追い登録）               | 改訂時のみ                          |
| `routine-ids.md`         | 登録済み Cloud Routine の `trig_<id>` 台帳                            | `/schedule` で登録/更新時のみ       |

---

## 動作モデル

```
夜 22:00 JST: Cloud Routine "night" 発火
  → Claude が routine-night.md を読み込み
  → goals.md から ACTIVE Goal を 1 つ確定
  → plans/ から該当 plan を 1 件 pick（or 起票）
  → worktree 作成 → lead-pipeline 重ティアで実装
  → iteration loop: engineer → verifier → qa を最大 5 回 / 90 分
  → 成功なら draft PR、未完了なら WIP draft PR + outbox 報告

朝 06:00 JST: Cloud Routine "morning" 発火（後追い登録）
  → Claude が routine-morning.md を読み込み
  → 前夜の draft PR レビュー結果 / コメント を取り込み
  → goals.md の Goal 状態を更新（DONE / BLOCKED / ACTIVE 遷移）
  → 今夜やる plan の優先順位を整理 → outbox に "today-plan.md" を残す
  → 古い worktree を prune
```

---

## 安全則

- **deny list**: `.claude/settings.json` の `permissions.deny` に main 直 push / force / hard reset / branch -D / git checkout main 等を構造的に禁止
- **`.mcp.json` 平文化チェック**: commit 前に `${...}` 参照形式が維持されているかを必須検査
- **worktree 規約**: `chat-auto-<YYYYMMDD>` 命名、§7.4 準拠（1 chat = 1 worktree = 1 branch）
- **iteration cap**: 暴走防止の上限（5 iter / 90 分）。超過は失敗ではなく「次回継続」として扱う
- **scope 宣言**: 個別 plan の Scope 外パスへの変更は scope drift として outbox に警告

---

## 人間の責務（最小化）

1. **draft PR レビュー**: 朝、前夜の draft PR を確認 → comment or merge
2. **方針調整**: Goal や Routine プロンプトに違和感があれば直接編集
3. **承認**: Cloud Routine 登録時、Apple Developer 等の人手必須項目到達時

それ以外の作業は Routine が自走する。

---

## 関連

- 計画書: [`../docs/vision/plans/2026-05-26-autonomous-dev-routine.md`](../docs/vision/plans/2026-05-26-autonomous-dev-routine.md)
- CLAUDE.md §7.3 Plan Gate Convention / §7.4 Multi-chat Worktree Policy
- 既存 Routine: `project_weekly_learning_routine` / `project_commute_mobile_dev_routine` (MEMORY)
- Skills: `schedule` / `lead-pipeline` / `execution-router` / `git-orchestrator`
