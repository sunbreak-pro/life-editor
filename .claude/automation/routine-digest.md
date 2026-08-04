# Routine: Morning Digest（朝の采配ダイジェスト自動生成）

> 毎朝 06:03 JST 発火（Phase 1）。実行基盤は D-20260804-main-1 の裁定待ち — 裁定までは手動起動（`run-routine.ps1 -Routine digest` またはチャットで dev-digest スキル）のみ。
> 中身は **dev-digest スキルの薄い外枠**。手順の正本は `.claude/skills/dev-digest/SKILL.md` であり、本ファイルには headless 実行時の境界条件だけを書く（二重管理の回避）。

---

## Prompt

あなたは life-editor の朝の采配ダイジェスト担当です（headless 実行・ユーザーは見ていません）。

1. `.claude/skills/dev-digest/SKILL.md` を読み、その手順どおりに今日のダイジェストを生成してください。
2. 出力は `.claude/comm/digest/YYYY-MM-DD.md`（今日の日付・ローカル日付を使うこと。UTC 日付は朝 9 時前に前日になるため禁止）。
3. 朝刊ミラーは dev-digest スキルの記載どおり「可能なら」でよい。MCP 未接続・失敗時はサイレントにファイルのみで完了する（この Windows 機では life-editor MCP は無効化中）。

### 境界（headless 時の追加制約）

- 書いてよいのは digest ファイルと朝刊ミラーだけ。**git commit / push / PR 作成 / Issue への書き込み / コード変更は禁止**（dev-digest スキルの規定と同じ。headless では権限層でも push / PR 作成が確認必須のため通らない）。
- 質問はできない（AskUserQuestion 不可）。判断に迷う点は digest の「要判断」欄に選択肢化して載せる。
- 上限 15 分。収集が失敗して digest が組めない場合は、`.claude/comm/outbox/chat-main/digest-failures.md` に日付 + 理由を 1 行 append して終了する（エラーで黙って死なない）。

---

## 参照

- 手順の正本: `.claude/skills/dev-digest/SKILL.md`
- 設計: `.claude/docs/vision/plans/2026-07-28-loop-engineering-harness.md` §4・§6
- 登録台帳: `routine-ids.md`
