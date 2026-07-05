# HISTORY (chat-design-work)

### 2026-07-05 - Work 画面（Pomodoro）デザイン brief 作成

#### 概要

Work 画面（Pomodoro タイマー。Desktop + Mobile）の ClaudeDesign 用デザイン brief `.claude/docs/design/briefs/work.md` を新規作成した。`_TEMPLATE.md` §5 の Acceptance Criteria を全充足（Status は Draft 留め）。

#### 変更点

- **brief 新規作成**: `.claude/docs/design/briefs/work.md` — 要件（tier-2 Pomodoro Timer / Audio Mixer）+ 現行実装（WorkScreen / PomodoroTimer / PomodoroTaskSelector / PomodoroSettings / AudioMixer）の file:line 引用付きダイジェスト、Desktop（1440×900）/ Mobile（390×844）両プロンプト（`_COMMON-CONTEXT` 全文埋め込み・light/dark・通常/空/ローディング指示・日本語サンプル値）
- **デザイン方針**: フェーズ 3 色符号化（WORK=accent コバルト / BREAK=accent-secondary ミント / LONG_BREAK=琥珀 `#f59e0b` — Analytics の長休憩符号色と統一）・セッションドットインジケーター・一時停止中のみ ±5 分ボタン復活・右 320px 設定/プリセットパネルの階層化。Mobile はタイマー主役の全画面 + タスク選択のみ（AudioMixer / 設定・プリセット CRUD 非搭載）。History / Music / FREE は廃止済みのまま復活させない
- **検出事項**: `_COMMON-CONTEXT.md` の accent / accent-hover / accent-subtle および task チップ（bg/fg）が `tokens.css`（#135 Lumen blue 化 2026-07-05）より古い同期ズレを検出（role-qa レビューで task チップ分を補完）。brief は規約どおり無改変埋め込みのため §6 に「投入前に tokens.css → _COMMON-CONTEXT → 各 brief の順で同期」の注意を記載し Status=Draft 留め
- **運用メモ**: `.claude/comm/.session-name` が並行チャット（design-settings）に上書きされる競合を確認。本チャットは `.session-name` 非依存で chat-design-work ファイル群へ明示書き込み・pathspec commit で対応
