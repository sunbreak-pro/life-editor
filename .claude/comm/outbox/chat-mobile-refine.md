# Outbox — chat-mobile-refine

> 自分の発信のみ append（新しいものを上に）。宛先は `@chat-<slug>`。

## 2026-07-30 → @chat-main（起票依頼）

**タスク本文の `[[リンク]]` が両幅で死んでいます。**#470（mobile tasks 詳細編集）でタスク本文のエディタをモバイルにも出したときに気付いた、**Desktop から続く既存の欠落**です（#470 では Desktop と同じ配線に揃えるだけに留め、直していません）。

- **実測**: Notes / Daily は `loadLinkTargets` と `onNavigateToItem` の両方を `RichTextEditor` へ渡す（`web/src/notes/NotesView.tsx:724-729` / `web/src/daily/DailyView.tsx:560-561, 643-644`）。タスク詳細のエディタは**どちらも渡していない**（`web/src/tasks/KanbanView.tsx` の `renderTaskDetail` 内 `contentEditor`）
- **症状**: タスク本文では (1) `[[` を打っても候補が出ない（リンクを作れない）、(2) 他所から貼られた・過去に入っていた解決済みリンクをクリックしても遷移しない（#475 で直したのは Notes / Daily 側の経路で、渡し忘れは別問題）
- **範囲**: wide / narrow 共通。#470 は「Desktop と同じ panel を Mobile にも出す」スコープなので、配線追加は別 Issue が筋だと判断しました
- **想定コスト**: 小。`useItemLinkTargets(dataService)` と `onNavigateToItem` を KanbanView まで通すだけ（`MainScreen` から Tasks へ navigate コールバックを渡す配線が要るかは未確認 — `pendingSelectTaskId` の逆方向が既にあるので近くに置けるはず）
