# Autonomous Development Routine

> life-editor の半自律運転（定期ルーチン）の SSOT。設計の正本 = [`../docs/vision/plans/2026-07-28-loop-engineering-harness.md`](../docs/vision/plans/2026-07-28-loop-engineering-harness.md)（Loop Engineering ハーネス親計画）。
> 旧 Mac 時代の Cloud Routine（`/schedule`・`trig_` 台帳）前提の設計は退役済み（親計画 Non-goals・2026-08-04 Phase 1 改訂）。旧本文は git 履歴を参照。

---

## ファイル構成

| ファイル                | 用途                                                               | 状態                          |
| ----------------------- | ------------------------------------------------------------------ | ----------------------------- |
| `README.md`             | このファイル。全体構造の入口                                       | 現行                          |
| `routine-digest.md`     | 朝 06:03 JST — 采配ダイジェスト生成（dev-digest スキルの薄い外枠） | **Phase 1・発火は裁定待ち**   |
| `routine-night-safe.md` | 夜 22:33 JST — 読み取り中心の安全レーン（docs / Issue / PR 監査）  | **Phase 1・発火は裁定待ち**   |
| `run-routine.ps1`       | headless 起動スクリプト（Task Scheduler / 手動の共通入口）         | 未実測 — 初回は手動実行で調整 |
| `routine-ids.md`        | 定期実行の登録台帳（何が・どこで・いつ動くか）                     | 現行                          |
| `routine-night.md`      | 夜 — 実装レーン（`/loop-implement` の薄い殻・commit 止まり）       | **Phase 2・発火は裁定待ち**   |
| `goals.md`              | 夜のレーンの選定基準（今夜の 1 件をどう選ぶか。一覧は持たない）    | 現行                          |
| `routine-morning.md`    | 退役（後継 = `routine-digest.md`）                                 | **退役 — 2026-08-06**         |
| `dev-schedule.md`       | 週次開発スケジュール（schedule-management スキルが管理）           | 現行（本ハーネスとは独立）    |

---

## 動作モデル（Phase 1）

```
朝 06:03 JST: routine-digest.md
  → dev-digest スキルの手順で digest 生成（.claude/comm/digest/YYYY-MM-DD.md）
  → 前夜の night-safe-report.md も収集源に含める
  → 朝刊ミラーは MCP 疎通後に有効化（それまでファイルのみ）

夜 22:33 JST: routine-night-safe.md
  → 読み取り中心の監査 4 本（docs 整合 / Issue 台帳 / PR conflict / 検証準備）
  → 検出は修正せず outbox/chat-night-safe/night-safe-report.md へ
  → 修正が要るものは起票依頼として列挙 → 翌朝 chat-main が裁く
```

実装の自走（夜 1 Issue → **commit 止まり** = `routine-night.md`）は **Phase 2**。文書整備は 2026-08-06 に完了（ループカタログ定着の待ちはユーザー指示で前倒し・試験運用 0 件のまま着手）。**発火はまだ有効化していない** — 実行基盤の裁定（D-20260804-main-1）待ち。

「draft PR 止まり」ではなく **commit 止まり**なのは、push と PR 作成を翌朝の人の手番に残すため（解放の可否 = `2026-08-06-autonomous-operation-endpoint.md` §3 第 1 段）。**この抑止は runner 側 settings で担保する** — 2026-08-10 に対話セッション側の `permissions.ask` から `Bash(git push*)` / `Bash(gh pr create*)` を外した（ユーザー裁定 = #618）ので、レーン有効化時は無人専用の permissions を起動コマンドで渡す（`claude -p --settings <無人用 settings>` or `--disallowedTools`）。

### 実行基盤（D-20260804-main-1 裁定待ち）

推奨 = **Windows Task Scheduler + `claude -p`（headless）**。セッション常駐が不要で、2026-07-16 の朝刊プロトタイプ（`2026-07-16-briefing-headless-claude-prototype.md`）で同型を E2E 検証済み。セッション内の CronCreate（scheduled tasks）は**セッション限定・7 日で期限切れ**（2026-08-04 実測）のため、常駐運用にしない限り使わない。裁定までは自動発火なし・手動起動のみ。

---

## 安全則

- **権限の二層**（親計画 §6）: 書き込みは acceptEdits で通し、**push / PR 作成は無人レーンでのみ抑止**する（担保は runner 側 settings — 2026-08-10 以降、repo の `permissions.ask` に残るのは `Bash(gh pr merge*)` だけ。#618）。main 保護の deny list は据え置き
- **時間 / 反復上限は bash で明示計測**（cap 設定だけでは信用しない — 親計画 §3 の暴走実例）。超過は失敗ではなく「スキップして報告」
- **ログ・長出力は会話に流さずファイルへ**（`.claude/automation/logs/` — git 非追跡）
- **質問経路は decision キュー / digest の要判断欄のみ**（headless では AskUserQuestion 不可）
- **merge と main への取り込みは常にこうだいさん**（POLICY P-001 — どの Phase でも解除しない）
- **`.mcp.json` の `${...}` 参照維持**は pre-commit hook が機械チェック

---

## 人間の責務

1. **朝**: digest を読む → 要判断に `ANSWERS.md` で答える → 起票依頼を chat-main で裁く
2. **発火の有効化 / 停止**: Task Scheduler の登録・解除（`routine-ids.md` の手順・ユーザー実行）
3. **方針調整**: ルーチン本文への違和感は直接編集（PR 経由）

---

## 関連

- 設計の正本: `../docs/vision/plans/2026-07-28-loop-engineering-harness.md`
- ループカタログ（Phase 2 の前提）: `../docs/vision/plans/2026-08-04-loop-catalog.md`
- digest 手順の正本: `../skills/dev-digest/SKILL.md`
- CLAUDE.md §7.3 Plan Gate Convention / §7.4 Multi-chat Worktree Policy
