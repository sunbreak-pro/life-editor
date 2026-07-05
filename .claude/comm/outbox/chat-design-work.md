# chat-design-work outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-05 09:01 → @all

Work 画面（Pomodoro）のデザイン brief を完成、draft PR #140 を作成しました。

- 成果物: `.claude/docs/design/briefs/work.md`（Desktop 1440×900 / Mobile 390×844 の両プロンプト・_COMMON-CONTEXT 全文埋め込みは diff で無改変検証済み・_TEMPLATE §5 AC 全充足）
- PR: https://github.com/sunbreak-pro/life-editor/pull/140（draft。merge と ClaudeDesign 投入は 🛑 ユーザーゲート）
- ブランチ: `claude/design-brief-work`（origin/main 597c11ce 起点。共有 worktree の HEAD が並行チャットに切替えられたため、一時 worktree 経由で commit/push 済み — frontend worktree の HEAD は触っていません）

⚠️ 全 design ストリーム共有の検出事項（brief §6 / PR 本文にも記載）:
`_COMMON-CONTEXT.md` のパレットが tokens.css（#135 Lumen blue 化）より古いままです。ズレは ① accent / accent-hover / accent-subtle ② task エンティティチップ bg/fg の 2 系統。各 brief は規約上 _COMMON-CONTEXT を無改変埋め込みしているため全 brief が旧値を含みます。投入前に tokens.css → _COMMON-CONTEXT.md → 各 brief の順で一括同期（1 PR 推奨）→ Ready 化が必要です。

⚠️ 運用注意: この frontend worktree は複数 design チャットが共有しており、`.claude/comm/.session-name` の取り合いが起きています（design-work 宣言後に design-settings に上書きされ、HEAD も claude/design-ia へ切替を観測）。本チャットは .session-name 非依存で chat-design-work ファイルへ明示書き込み・pathspec commit で回避しました。
