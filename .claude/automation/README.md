# Autonomous Development Routine

> life-editor の半自律運転（定期ルーチン）の SSOT。設計の正本 = [`../docs/vision/plans/2026-07-28-loop-engineering-harness.md`](../docs/vision/plans/2026-07-28-loop-engineering-harness.md)（Loop Engineering ハーネス親計画）。
> 旧 Mac 時代の Cloud Routine（`/schedule`・`trig_` 台帳）前提の設計は退役済み（親計画 Non-goals・2026-08-04 Phase 1 改訂）。旧本文は git 履歴を参照。

---

## ファイル構成

| ファイル                | 用途                                                               | 状態                                    |
| ----------------------- | ------------------------------------------------------------------ | --------------------------------------- |
| `README.md`             | このファイル。全体構造の入口                                       | 現行                                    |
| `routine-digest.md`     | 朝 06:03 JST — 采配ダイジェスト生成（dev-digest スキルの薄い外枠） | **Phase 1・発火は裁定待ち**             |
| `routine-night-safe.md` | 夜 22:33 JST — 読み取り中心の安全レーン（docs / Issue / PR 監査）  | **Phase 1・発火は裁定待ち**             |
| `run-routine.ps1`       | headless 起動スクリプト（Task Scheduler / 手動の共通入口）         | 未実測 — 初回は手動実行で調整           |
| `routine-ids.md`        | 定期実行の登録台帳（何が・どこで・いつ動くか）                     | 現行                                    |
| `routine-night.md`      | 夜の実装レーン（Engineer）プロンプト                               | **未稼働 — Phase 2 改訂待ち**           |
| `routine-morning.md`    | 朝の PM プロンプト                                                 | **未稼働 — Phase 2 改訂待ち**           |
| `goals.md`              | Goal Roadmap（2026-05 起票）                                       | **陳腐化 — Phase 2 前提の全面改訂待ち** |
| `dev-schedule.md`       | 週次開発スケジュール（schedule-management スキルが管理）           | 現行（本ハーネスとは独立）              |

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

実装の自走（夜 1 plan → draft PR = `routine-night.md` 改訂版）は **Phase 2**。前提 = ループカタログ（`2026-08-04-loop-catalog.md`）の定着 + `goals.md` の全面改訂。着手可否は decision キューで裁定する。

### 実行基盤（D-20260804-main-1 裁定待ち）

推奨 = **Windows Task Scheduler + `claude -p`（headless）**。セッション常駐が不要で、2026-07-16 の朝刊プロトタイプ（`2026-07-16-briefing-headless-claude-prototype.md`）で同型を E2E 検証済み。セッション内の CronCreate（scheduled tasks）は**セッション限定・7 日で期限切れ**（2026-08-04 実測）のため、常駐運用にしない限り使わない。裁定までは自動発火なし・手動起動のみ。

---

## 安全則

- **権限の二層**（親計画 §6）: 書き込みは acceptEdits で通し、**push / PR 作成は `permissions.ask` で常に確認必須**（headless では確認できず失敗 → 報告へ degrade）。main 保護の deny list は据え置き
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
