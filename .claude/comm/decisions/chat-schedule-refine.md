# Decision Queue — chat-schedule-refine

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

### D-20260812-sched-1: モバイルの Todo 一覧行にも削除の導線を足すか

- 背景: #775 / PR #784。詳細シート（`shared/src/components/TaskDetailPanel.tsx`）には削除を足したが、日リストの行そのものには足していない。行は `shared/src/components/schedule/AgendaList.tsx` で Desktop サイドバーと共用で、Desktop 側の Todo トレイ（`TodayTodoTray.tsx:138`）には既に行内ゴミ箱がある
- A: 現状維持（推奨 — 行内ゴミ箱は完了チェックボックスの親指 1 本分となりに破壊的操作を置くことになる。#761 で行タップが詳細シートを開くようになったので、削除は 1 タップ先の「確認を出せる面」にある）
- B: 行を左スワイプで削除を出す（iOS の標準作法。ただしこのアプリにスワイプ操作の前例が無く、`AgendaList` の DnD / 横スクロールとの当たり判定を新規に設計することになる）
- C: 行内に小さなゴミ箱を出す（Desktop トレイと同じ形。実装は最小だが誤爆が一番しやすい）
- 放置時: A のまま（PR #784 は A で出している）。この判断のために #775 を止めない
- 期限感: いつでも（#775 の merge を待たない）

（回答済みは `.claude/decisions/` 台帳へ昇格済み — D-20260801-sched-1（2026-08-09・chat-main 代行）/ D-20260810-sched-1〜5（2026-08-10・チャット回答を受けて当チャットが昇格）/ 2026-08-12 昇格分 = D-20260730-sched-1 / D-20260731-sched-2 / D-20260731-sched-3 / D-20260801-sched-2 / D-20260802-sched-1 / D-20260811-sched-1 / D-20260811-sched-2）
