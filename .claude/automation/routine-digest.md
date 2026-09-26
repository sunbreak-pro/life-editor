# Routine: Morning Digest（朝の采配ダイジェスト自動生成）

> 毎朝 07:43 JST 発火（Phase 1。2026-09-26 に 06:03 から移設し、スリープを解除して走らせる）。実行基盤は D-20260804-main-1 = A（Windows Task Scheduler + `claude -p`）で裁定済み。無人用 permissions は night-safe と同じ `settings-unattended-readonly.json`。**Task Scheduler に登録済み（2026-09-02 登録・2026-09-26 再登録・台帳 = `routine-ids.md`）**。手動起動は `run-routine.ps1 -Routine digest` またはチャットで dev-digest スキル（追跡 = #1335）。
> 中身は **dev-digest スキルの薄い外枠**。手順の正本は `.claude/skills/dev-digest/SKILL.md` であり、本ファイルには headless 実行時の境界条件だけを書く（二重管理の回避）。

---

## Prompt

あなたは life-editor の朝の采配ダイジェスト担当です（headless 実行・ユーザーは見ていません）。

1. `.claude/skills/dev-digest/SKILL.md` を読み、その手順どおりに今日のダイジェストを生成してください。
2. **digest 本文は最終メッセージとして出力してください。ファイルには書きません** — headless の claude は `.claude/` 配下へ Write できないため（2026-09-02 実測）、`run-routine.ps1` が最終メッセージを当日の `.claude/automation/reports/YYYY-MM-DD.md` へ追記して日次の報告 PR に載せ、控えを `.claude/comm/digest/YYYY-MM-DD.md` にも置きます（日付は launcher 側のローカル日付）。
   - 30 分前に走った監査（night-safe）の報告は、同じ `.claude/automation/reports/YYYY-MM-DD.md` の `## night-safe` 節にあります。収集源に含めてください（旧 `comm/outbox/chat-night-safe/night-safe-report.md` は 2026-09-26 で更新を止めました）。
3. 朝刊ミラーは dev-digest スキルの記載どおり「可能なら」でよい。MCP 未接続・失敗時はサイレントにファイルのみで完了する（この Windows 機では life-editor MCP は無効化中）。

### 境界（headless 時の追加制約）

- ファイルへの書き込みは行わない（launcher が保存する）。朝刊ミラーだけは MCP 経由で可。**git commit / push / PR 作成 / Issue への書き込み / コード変更は禁止**（dev-digest スキルの規定と同じ。無人用 settings の deny でも止めている。commit・push・報告 PR は launcher の仕事）。
- 質問はできない（AskUserQuestion 不可）。判断に迷う点は digest の「要判断」欄に選択肢化して載せる。
- 上限 15 分。収集が失敗して digest が組めない場合は、最終メッセージの 1 行目に `FAILED: <理由>` と書いて終了する（エラーで黙って死なない）。ファイルへの追記はしない — headless では `.claude/` 配下へ書けないため、launcher がこの最終メッセージを報告 PR に載せる。

---

## 参照

- 手順の正本: `.claude/skills/dev-digest/SKILL.md`
- 設計: `.claude/docs/vision/plans/2026-07-28-loop-engineering-harness.md` §4・§6
- 登録台帳: `routine-ids.md`
