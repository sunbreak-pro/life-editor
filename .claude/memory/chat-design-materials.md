# chat-design-materials — memory

> 単一書込者: design-materials チャットのみ。並行 design セッションとの worktree 共有競合のため task-tracker スキルを経由せず直書き（feedback_task_tracker_parallel_chat_override 準拠）。

## 直近完了

- [x] 2026-07-05: Materials クラスタ design brief 作成 — `.claude/docs/design/briefs/materials.md`（Tasks Kanban / Notes / Daily / Tags × Desktop/Mobile = 8 プロンプト）。branch `claude/design-brief-materials`・commit `4338afd2`・Draft PR #137

## 予定 / 引き継ぎ

- brief の Status: Draft → Ready の判定はユーザーレビュー後（ClaudeDesign 投入はユーザーゲート）
- `_COMMON-CONTEXT.md` の accent 系 + task チップ面色 + dark 値の tokens.css 乖離修正は別 PR（全 brief 一斉反映。コーディネータ側マター）
- `claude/design-brief-analytics` に混入した `4338afd2` の除去は analytics セッション側で rebase（outbox で依頼済み）
