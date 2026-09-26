# Autonomous Development Routine

> life-editor の半自律運転（定期ルーチン）の SSOT。設計の正本 = [`../docs/vision/plans/2026-07-28-loop-engineering-harness.md`](../docs/vision/plans/2026-07-28-loop-engineering-harness.md)（Loop Engineering ハーネス親計画）。
> 旧 Mac 時代の Cloud Routine（`/schedule`・`trig_` 台帳）前提の設計は退役済み（親計画 Non-goals・2026-08-04 Phase 1 改訂）。旧本文は git 履歴を参照。

---

## ファイル構成

| ファイル                | 用途                                                               | 状態                          |
| ----------------------- | ------------------------------------------------------------------ | ----------------------------- |
| `README.md`             | このファイル。全体構造の入口                                       | 現行                          |
| `routine-digest.md`     | 朝 07:43 JST — 采配ダイジェスト生成（dev-digest スキルの薄い外枠） | **Phase 1・稼働中**（2026-09-02 登録・2026-09-26 時刻変更） |
| `routine-night-safe.md` | 朝 07:13 JST — 読み取り中心の安全レーン（docs / Issue / PR 監査）。名前は旧 22:33 枠の名残  | **Phase 1・稼働中**（2026-09-02 登録・2026-09-26 時刻変更） |
| `run-routine.ps1`       | headless 起動スクリプト（Task Scheduler / 手動の共通入口）。専用 worktree で走らせ、報告を日次 PR へ届ける | 現行（2026-09-26 改訂） |
| `register-routines.ps1` | Task Scheduler への登録（スリープ解除つき・何度流しても同じ状態になる） | 現行（2026-09-26 新設） |
| `reports/YYYY-MM-DD.md` | 当日の報告。launcher が追記して日次の報告 PR に載せる（merge すると main に残る） | 現行（2026-09-26 新設） |
| `settings-unattended-readonly.json`  | 無人レーンの permissions（digest / night-safe 用・commit も禁止） | 現行 |
| `settings-unattended-implement.json` | 無人レーンの permissions（night 用・commit 可 / push・PR・Issue 禁止） | 現行 |
| `routine-ids.md`        | 定期実行の登録台帳（何が・どこで・いつ動くか）                     | 現行                          |
| `routine-night.md`      | 夜 — 実装レーン（`/loop-implement` の薄い殻。commit までを claude、push と draft PR を launcher が行う） | **Phase 2・未登録**（手動起動のみ） |
| `goals.md`              | 夜のレーンの選定基準（今夜の 1 件をどう選ぶか。一覧は持たない）    | 現行                          |
| `routine-morning.md`    | 退役（後継 = `routine-digest.md`）                                 | **退役 — 2026-08-06**         |
| `dev-schedule.md`       | 週次開発スケジュール（schedule-management スキルが管理）           | 現行（本ハーネスとは独立）    |

---

## 動作モデル（Phase 1）

```
朝 07:13 JST（PC をスリープから起こす）: routine-night-safe.md
  → 読み取り中心の監査 4 本（docs 整合 / Issue 台帳 / PR conflict / 検証準備）
  → 検出は修正せず、最終メッセージとして出す
  → launcher が reports/YYYY-MM-DD.md へ追記 → 日次の報告 PR（chore/routine-report-YYYYMMDD）を作成

朝 07:43 JST（同上）: routine-digest.md
  → dev-digest スキルの手順で digest 生成
  → 当日の reports/YYYY-MM-DD.md（直前の監査）も収集源に含める
  → launcher が同じ報告 PR に追記し、PR 本文を報告ファイルの全文で更新する
  → 控えを .claude/comm/digest/YYYY-MM-DD.md（git 非追跡）にも置く

こうだいさん: 報告 PR を読む → 残すなら merge、要らなければ close → 起票依頼は chat-main で裁く
```

**報告ファイルを書くのは launcher であってレーンではない**（2026-09-02 実測）: headless の claude は `.claude/` 配下へ Write できず、allow ルールを足しても通らない。そのため各レーンは報告を**最終メッセージとして出力**し、`run-routine.ps1` が `--output-format json` の `result` を当日の報告ファイルへ追記する。ログも launcher が UTF-8 で保存する（PowerShell の `>` は UTF-16 で書くため）。

**報告は PR で届く**（2026-09-26 ユーザー決定）: launcher はレーン専用の worktree（`<repos-parent>/workspaces/life-editor/routine`、night は `routine-night`）を毎回 origin の最新へ合わせてから claude を走らせる。報告の commit・push・PR 作成は launcher が行い、claude 自身には引き続き許さない。メインのチェックアウトには digest の控え以外を書かないので、chat-main の作業ツリーが報告で汚れない。報告が空だった回も `FAILED` の節として PR に載るので、失敗が黙って消えない。1 回 1 行の実行台帳は `logs/runs.log`（git 非追跡）。

実装の自走（夜 1 Issue → commit まで = `routine-night.md`）は **Phase 2**。文書整備は 2026-08-06 に完了（ループカタログ定着の待ちはユーザー指示で前倒し・試験運用 0 件のまま着手）。**Phase 1 の 2 本（digest / night-safe）は 2026-09-02 に発火を有効化した**（#1335 — 台帳 = `routine-ids.md`）。Phase 2 の `night` は未登録で手動起動のみ。

**claude 自身は commit で止まり、push と draft PR 作成は launcher が行う**（2026-09-26 ユーザー決定「報告を PR にする」— `2026-08-06-autonomous-operation-endpoint.md` §3 第 1 段の push / draft PR 解放を、claude ではなく決定論的な launcher に持たせる形で実施）。merge は引き続き人の手番。**claude 側の抑止は runner 側 settings で担保している** — 2026-08-10 に対話セッション側の `permissions.ask` から `Bash(git push*)` / `Bash(gh pr create*)` を外した（ユーザー裁定 = #618）ため、プロンプトの禁止文だけでは止まらない。`run-routine.ps1` が routine ごとにプロファイルを選び `claude -p --settings` で渡す（2026-09-01 実測: readonly は `git commit` を拒否 / implement は commit 可・`git push` を拒否）。

### 実行基盤（D-20260804-main-1 = A・2026-09-02 登録済み・2026-09-26 スリープ解除つきで再登録）

採用 = **Windows Task Scheduler + `claude -p`（headless）**。2026-09-02〜25 の実測で、06:03 の digest は 24 日中 22 日、22:33 の night-safe は 14 日が PC のスリープ中で発火していなかった（タスクの WakeToRun が False・電源ログにタイマー復帰 0 件）。claude 本体は起動した回はすべて完走していた。そこで夜中を避けて朝 07:13 / 07:43 に PC を起こす設定へ切り替えた（`register-routines.ps1`）。セッション常駐が不要で、2026-07-16 の朝刊プロトタイプ（`2026-07-16-briefing-headless-claude-prototype.md`）で同型を E2E 検証済み。セッション内の CronCreate（scheduled tasks）は**セッション限定・7 日で期限切れ**（2026-08-04 実測）のため、常駐運用にしない限り使わない。

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
2. **報告 PR の処理**: 残すなら merge、要らなければ close（どちらでも次の日の報告は新しい PR になる）
3. **発火の有効化 / 停止**: Task Scheduler の登録・解除（`routine-ids.md` の手順）
4. **方針調整**: ルーチン本文への違和感は直接編集（PR 経由）

---

## 関連

- 設計の正本: `../docs/vision/plans/2026-07-28-loop-engineering-harness.md`
- ループカタログ（Phase 2 の前提）: `../docs/vision/plans/2026-08-04-loop-catalog.md`
- digest 手順の正本: `../skills/dev-digest/SKILL.md`
- CLAUDE.md §7.3 Plan Gate Convention / §7.4 Multi-chat Worktree Policy
